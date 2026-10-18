// Claude Code PreToolUse hook: refuse Bash commands that merge or approve a pull request, or push to main.
//
// Claude prepares changes, runs checks, pushes its branch and opens the PR; merging is the
// owner's act on GitHub (owner decision, 2026-10-09). The deny rules in .claude/settings.json
// match command prefixes, which a different spelling slips past, so this hook reads each
// command part. It is a heuristic backstop, not a sandbox: the owner's review is the control.
import { readFileSync } from "node:fs";
import { EXIT_OK, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { isRecord } from "../lib/record.ts";

/** Claude Code reads exit 2 from a PreToolUse hook as "block", and shows stderr to the model. */
export const HOOK_BLOCK = 2;

const MERGE_ENDPOINT = /\bpulls\/\d+\/merge\b/;
const PUT = /(?:-X\s*|--request[=\s]+|--method[=\s]+)PUT\b/i;
const MERGE_MUTATION = /\b(?:mergePullRequest|enablePullRequestAutoMerge)\b/;
// Approving is the owner's act too: a review endpoint or mutation counts when its event is APPROVE,
// or when the body comes from a file the hook cannot read (--input).
// The GraphQL endpoint counts as a review endpoint: a query read from a file may be an approval.
const REVIEW_ENDPOINT = /\bpulls\/\d+\/reviews\b|\b(?:addPullRequestReview|submitPullRequestReview)\b|\bgraphql\b/;
// A body read from a file (--input, -F x=@file, curl -d/--data*/--json [name]@file, -T/--upload-file)
// cannot be inspected, so it counts too. Heuristic: a body built by command substitution is not seen.
const APPROVE_EVENT = /\bevent\b\W{0,3}APPROVE\b|--input\b|=@|\s-(?:d|-data[\w-]*|-json)\s*\w*@|\s-T|--upload-file\b/i;
// In a short-flag bundle, -b and -F take the rest of the word as their value (-bapprove is a body).
const VALUE_FLAGS = new Set(["b", "F"]);

// gh pr review --approve, --approve=..., -a, or a short-flag bundle such as -ab.
function isApproveFlag(word: string): boolean {
  if (word.startsWith("--approve")) return true;
  if (!/^-[A-Za-z]+$/.test(word)) return false;
  for (const flag of word.slice(1)) {
    if (flag === "a") return true;
    if (VALUE_FLAGS.has(flag)) return false;
  }
  return false;
}
// bash -c '...', eval '...' and env -S '...' run their argument, so it is lifted out as a command.
const SHELL_PAYLOAD = /\b(?:bash|sh|zsh)\s+(?:-[a-z]+\s+)*-[a-z]*c(?:\s+--)?\s+(["'])([\s\S]*?)\1|\b(?:eval|env\s+-S)\s+(["'])([\s\S]*?)\3/g;
// Heredoc bodies are data. A quoted string is joined into its word with only word characters kept,
// as the shell joins it: "gh" is still gh and 'HEAD:main' still a refspec, while a quoted commit
// message becomes one harmless word and its separators split nothing.
// A here-string (<<<) is not a heredoc.
const OPENER = /(?<!<)<<(?!<)-?[ \t]*(["']?)(\w+)\1/;
const CLOSER = /^\t*(\w+)$/;
// Two heredocs on one line are not parsed: their bodies are read as commands rather than risk
// stripping a command as data.
const TWO_HEREDOCS = /(?<!<)<<(?!<)[^\n]*(?<!<)<<(?!<)/;
// Except shell input: a heredoc or here-string a shell reads (bash <<EOF, cat <<EOF | sudo sh,
// bash <<< '...') is code, and so is what echo or printf pipes into a shell. Whether a command
// runs a shell is decided by programOf, which skips wrappers and NAME=value words; `sh -n` only
// parses. Lines and pipelines are split, never matched with nested patterns, so a long command
// costs linear time.
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
const PIPE = /(?<!\|)\|(?!\|)/;
const COMMAND_SEPARATOR = /[;&(]/;
const SOURCE = /(?:^|[;&(])[ \t]*(?:echo|printf)\b/;
const SOURCE_PREFIX = /^[\s\S]*?(?:^|[;&(])[ \t]*(?:echo|printf)\b/;
const HERE_STRING = /<<<[ \t]*('[^']*'|"(?:\\.|[^"\\])*"|[^\s;&|]+)/;
// Outside quotes a backslash only escapes the next character (me\rge is merge).
const ESCAPE = /\\(?=[\w.:/+@^~-])/g;
const QUOTED_OPENER = /(?<!<)<<(?!<)-?\s*(["'])(\w+)\1/;
const QUOTED = /'[^']*'|"(?:\\.|[^"\\])*"/g;
const NOT_WORD = /[^\w.:/+@^~-]/g;
const BACKTICKS = /`([^`]*)`/g;
// $(...) runs its content as a command, inside double quotes too, so each one is also judged as a
// command line of its own. Not when it cannot run: escaped (\$), single-quoted or in a heredoc.
const SUBSTITUTION = /(?<!\\)\$\(([^()]*)\)/g;
const SINGLE_QUOTED = /'[^']*'/g;
// An unquoted heredoc expands $(...) and backticks in its body, inside quotes too. An odd run of
// backslashes escapes them; an even run is escaped backslashes (\\$(x) still runs x).
const BODY_SUBSTITUTION = /(?<=(?:^|[^\\])(?:\\\\)*)\$\(([^()]*)\)|(?<=(?:^|[^\\])(?:\\\\)*)`([^`]*)`/g;
// Separators: &&, ||, ;, |, newline, brackets, and a lone & (background; not 2>&1 or &>).
const SEPARATOR = /&&|\|\||[;|\n(){}]|(?<![&>])&(?![&>])/;
// Words that run a later word as the command, with the options each takes a value for and how many
// plain arguments come before the command (timeout's duration).
const WRAPPERS = new Set(["sudo", "env", "command", "nohup", "exec", "time", "if", "elif", "while", "until", "then", "do", "else", "!", "timeout", "nice", "xargs", "setsid", "stdbuf", "doas"]);
const WRAPPER_VALUE_FLAGS: Record<string, ReadonlySet<string>> = {
  sudo: new Set(["-u", "-g", "-h", "-p", "-C"]), doas: new Set(["-u", "-C"]), env: new Set(["-u", "-C"]), nice: new Set(["-n"]),
  timeout: new Set(["-s", "-k", "--signal", "--kill-after"]), xargs: new Set(["-I", "-n", "-L", "-P", "-d", "-E", "-s", "-a"]),
};
const WRAPPER_ARGUMENTS: Record<string, number> = { timeout: 1 };
const GH_FLAGS_WITH_VALUE = new Set(["-R", "--repo", "--hostname"]);

// A backslash-newline joins two lines with nothing between them (ec\<newline>ho is echo), except
// in the body of a heredoc with a quoted delimiter, which the shell keeps as written.
function joinContinuations(command: string): string {
  const lines: string[] = [];
  let pending = "";
  let quotedEnd: RegExp | null = null;
  for (const line of command.split(/\r?\n/)) {
    if (quotedEnd !== null) {
      lines.push(line);
      if (quotedEnd.test(line)) quotedEnd = null;
      continue;
    }
    if (line.endsWith("\\")) {
      pending += line.slice(0, -1);
      continue;
    }
    const joined = pending + line;
    pending = "";
    lines.push(joined);
    const tag = QUOTED_OPENER.exec(joined)?.[2];
    if (tag !== undefined) quotedEnd = new RegExp(`^\\t*${tag}$`);
  }
  return [...lines, pending].join("\n");
}

// Whether the first command of a fragment runs a shell that executes its input.
function runsShell(fragment: string): boolean {
  const first = fragment.split(COMMAND_SEPARATOR)[0] ?? "";
  const { program, rest } = programOf(first.trim().split(/[ \t]+/).filter(Boolean));
  return program !== undefined && SHELLS.has(program) && !rest.includes("-n");
}

const lastCommand = (text: string): string => text.split(/[;&|(]/).pop() ?? "";

// What one line feeds a shell: a here-string a shell reads, and what echo or printf sends down a
// pipeline that reaches a shell. Stages are walked from the end, so each line is read once.
function shellInputOf(line: string): string[] {
  const stages = line.split(PIPE);
  const fed: string[] = [];
  let shellLater = false;
  for (let index = stages.length - 1; index >= 0; index--) {
    const stage = stages[index] ?? "";
    const hereString = HERE_STRING.exec(stage);
    if (hereString !== null && runsShell(lastCommand(stage.slice(0, hereString.index)))) fed.push(hereString[1] ?? "");
    else if (shellLater && SOURCE.test(stage)) fed.push(stage.replace(SOURCE_PREFIX, ""));
    if (runsShell(stage)) shellLater = true;
  }
  return fed.flatMap((source) => [source, ...[...source.matchAll(QUOTED)].map((quoted) => quoted[0].slice(1, -1))]);
}

type Heredoc = { line: number; close: number; quoted: boolean; before: string; after: string; body: readonly string[] };

const firstAtOrAfter = (sorted: readonly number[], from: number): number | undefined => {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((sorted[middle] ?? 0) < from) low = middle + 1;
    else high = middle;
  }
  return sorted[low];
};

// The heredocs of a text, each closed by its delimiter on a later line. Delimiter lines are indexed
// first, so an opener that is never closed costs a lookup, not a scan to the end: a long command
// costs linear time. An unclosed opener is not a heredoc, so what follows it is read as commands.
function heredocsIn(lines: readonly string[]): Heredoc[] {
  const closers = new Map<string, number[]>();
  lines.forEach((line, index) => {
    const tag = CLOSER.exec(line)?.[1];
    if (tag === undefined) return;
    const indexes = closers.get(tag);
    if (indexes === undefined) closers.set(tag, [index]);
    else indexes.push(index);
  });
  const found: Heredoc[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const opener = OPENER.exec(line);
    const close = opener === null ? undefined : firstAtOrAfter(closers.get(opener[2] ?? "") ?? [], index + 1);
    if (opener === null || close === undefined) continue;
    const before = line.slice(0, opener.index);
    found.push({ line: index, close, quoted: opener[1] !== "", before, after: line.slice(opener.index + opener[0].length), body: lines.slice(index + 1, close) });
    index = close;
  }
  return found;
}

// Rewrites each heredoc, opener line to delimiter, with what replace returns; undefined keeps it.
function replaceHeredocs(text: string, replace: (heredoc: Heredoc) => string | undefined): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let next = 0;
  for (const heredoc of heredocsIn(lines)) {
    const replacement = replace(heredoc);
    if (replacement === undefined) continue;
    for (let index = next; index < heredoc.line; index++) out.push(lines[index] ?? "");
    out.push(replacement);
    next = heredoc.close + 1;
  }
  for (let index = next; index < lines.length; index++) out.push(lines[index] ?? "");
  return out.join("\n");
}

// Shell input becomes command lines of its own; other heredocs are left to be stripped as data. A
// line ending in a pipe continues on the next, as in the shell.
function liftShellInput(command: string): string {
  const heredocs = replaceHeredocs(command, ({ before, after, body }) =>
    runsShell(lastCommand(before)) || after.split(PIPE).slice(1).some(runsShell) ? `${before} ${after}\n${body.join("\n")}` : undefined);
  const lines = heredocs.replace(/\|[ \t]*\n/g, "| ").split("\n").flatMap(shellInputOf);
  return [heredocs, ...lines].join("\n");
}

function heredocSubstitutions(text: string): string[] {
  return heredocsIn(text.split("\n")).filter((heredoc) => !heredoc.quoted).flatMap((heredoc) =>
    [...heredoc.body.join("\n").matchAll(BODY_SUBSTITUTION)].map((match) => match[1] ?? match[2] ?? ""));
}

function commandParts(command: string): string[][] {
  const joined = joinContinuations(command);
  const dropData = (text: string): string => TWO_HEREDOCS.test(joined) ? text : replaceHeredocs(text, ({ before }) => `${before} `);
  const lifted = liftShellInput(joined)
    .replace(SHELL_PAYLOAD, (_match, _q1, first: string | undefined, _q2, second: string | undefined) => `\n${first ?? second ?? ""}\n`);
  const runnable = dropData(lifted).replace(SINGLE_QUOTED, " ");
  const substituted = [...[...runnable.matchAll(SUBSTITUTION)].map((match) => match[1] ?? ""), ...heredocSubstitutions(lifted)];
  const code = dropData([lifted, ...substituted].join("\n")).replace(BACKTICKS, (_match, inner: string) => `\n${inner}\n`)
    .replace(QUOTED, (quoted) => quoted.slice(1, -1).replace(NOT_WORD, "")).replace(ESCAPE, "");
  return code.split(SEPARATOR).map((part) => part.trim().split(/\s+/).filter(Boolean));
}

// The index of the first word after a wrapper's own options and arguments.
function skipWrapper(words: readonly string[], index: number): number {
  const wrapper = programName(words[index] ?? "");
  const valueFlags = WRAPPER_VALUE_FLAGS[wrapper] ?? new Set<string>();
  let next = index + 1;
  while ((words[next] ?? "").startsWith("-")) next += valueFlags.has(words[next] ?? "") ? 2 : 1;
  return next + (WRAPPER_ARGUMENTS[wrapper] ?? 0);
}

// The command a word names: a path (/usr/bin/gh) or a leading backslash (\gh, which skips aliases)
// still runs that program.
const programName = (word: string): string => word.replace(/^\\/, "").split("/").pop() ?? "";

function programOf(words: readonly string[]): { program: string | undefined; rest: string[] } {
  let index = 0;
  while (index < words.length) {
    const word = words[index] ?? "";
    if (WRAPPERS.has(programName(word))) index = skipWrapper(words, index);
    else if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) index++;
    else break;
  }
  const word = words[index];
  return { program: word === undefined ? undefined : programName(word), rest: words.slice(index + 1) };
}

// gh's global flags (-R owner/repo) may come before the subcommand.
function ghSubcommand(rest: readonly string[]): string[] {
  let index = 0;
  while ((rest[index] ?? "").startsWith("-")) index += GH_FLAGS_WITH_VALUE.has(rest[index] ?? "") ? 2 : 1;
  return rest.slice(index);
}

// API merges are judged on the whole command, because the endpoint or mutation is usually quoted.
const apiMergeIn = (command: string): boolean => MERGE_MUTATION.test(command) || (MERGE_ENDPOINT.test(command) && PUT.test(command))
  || (REVIEW_ENDPOINT.test(command) && APPROVE_EVENT.test(command));
// Quotes around a flag's value (-X 'PUT') do not change what gh or curl sends.
const apiMerge = (command: string): boolean => apiMergeIn(command) || apiMergeIn(command.replace(/["']/g, ""));

const GIT_FLAGS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace"]);
const PUSH_FLAGS_WITH_VALUE = new Set(["-o", "--push-option", "--repo", "--receive-pack", "--exec"]);
const MAIN = "main";

// The destination of a refspec: `src:dst`, `+src:dst`, `:dst` (delete) or `name`, without refs/heads/.
function pushDestination(refspec: string): string {
  const target = refspec.replace(/^\+/, "").split(":").pop() ?? "";
  return target.replace(/^refs\/heads\//, "");
}

// git push to main in the common refspec forms, or --all/--mirror, which push main too. git reads
// the first positional as the repository even with --repo, but the author may have meant it as a
// refspec, so with --repo every positional counts as a destination. Quoted or
// brace-expanded refspecs are not parsed; the pre-push hook and the ruleset still refuse them. A bare `git push` is
// left to the pre-push branch guard, which knows the current branch.
function isPushToMain(rest: readonly string[]): boolean {
  let index = 0;
  while ((rest[index] ?? "").startsWith("-")) index += GIT_FLAGS_WITH_VALUE.has(rest[index] ?? "") ? 2 : 1;
  if (rest[index] !== "push") return false;
  const positional: string[] = [];
  const args = rest.slice(index + 1);
  const repoOption = args.some((word) => word === "--repo" || word.startsWith("--repo="));
  for (let at = 0; at < args.length; at++) {
    const word = args[at] ?? "";
    if (word === "--all" || word === "--mirror") return true;
    if (PUSH_FLAGS_WITH_VALUE.has(word)) at++;
    else if (!word.startsWith("-")) positional.push(word);
  }
  return positional.slice(repoOption ? 0 : 1).some((refspec) => pushDestination(refspec) === MAIN);
}

export function isPushingToMain(command: string): boolean {
  return commandParts(command).some((words) => {
    const { program, rest } = programOf(words);
    return program === "git" && isPushToMain(rest);
  });
}

export function isPrMerge(command: string): boolean {
  return commandParts(command).some((words) => {
    const { program, rest } = programOf(words);
    if (program === "gh") {
      const [first, second] = ghSubcommand(rest);
      if (first === "pr" && second === "review") return rest.some(isApproveFlag);
      return (first === "pr" && second === "merge") || (first === "api" && apiMerge(command));
    }
    return (program === "curl" || program === "wget") && apiMerge(command);
  });
}

export type Options = { stdin?: string; output?: Output };

export function main(_args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  let input: unknown;
  try {
    input = JSON.parse(options.stdin ?? readFileSync(0, "utf8"));
  } catch {
    output.warn("block-pr-merge: could not read the hook input, so the command is refused.");
    return HOOK_BLOCK;
  }
  if (!isRecord(input) || input.tool_name !== "Bash" || !isRecord(input.tool_input)) return EXIT_OK;
  const command = typeof input.tool_input.command === "string" ? input.tool_input.command : "";
  if (isPushingToMain(command)) {
    output.warn("block-pr-merge: this command would push to main, and work is never pushed to main. Push your branch and open or update the PR instead (npm run pr).");
    return HOOK_BLOCK;
  }
  if (!isPrMerge(command)) return EXIT_OK;
  output.warn("block-pr-merge: this command would merge or approve a pull request. Only the owner merges or approves, on GitHub. Push the branch and open or update the PR instead (npm run pr).");
  return HOOK_BLOCK;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));

// Claude Code PreToolUse hook: refuse Bash commands that merge or approve a pull request.
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
// A body read from a file (--input, -F x=@file, curl -d/--data*/--json @file, curl -T file) cannot be
// inspected, so it counts too.
const APPROVE_EVENT = /\bevent\b\W{0,3}APPROVE\b|--input\b|=@|\s-(?:d|-data[\w-]*|-json)\s*@|\s-T\s/i;
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
// bash -c '...' and eval '...' run their argument, so it is lifted out as a command.
const SHELL_PAYLOAD = /\b(?:bash|sh|zsh)\s+-c\s+(["'])([\s\S]*?)\1|\beval\s+(["'])([\s\S]*?)\3/g;
// Heredoc bodies and quoted strings are data (commit messages, PR bodies, search terms).
const HEREDOC = /<<-?\s*(["']?)(\w+)\1[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g;
const QUOTED = /'[^']*'|"(?:\\.|[^"\\])*"/g;
// Words that run the next word as the command.
const WRAPPERS = new Set(["sudo", "env", "command", "nohup", "exec", "time", "then", "do", "else", "!"]);
const GH_FLAGS_WITH_VALUE = new Set(["-R", "--repo", "--hostname"]);

function commandParts(command: string): string[][] {
  const lifted = command.replace(SHELL_PAYLOAD, (_match, _q1, first: string | undefined, _q2, second: string | undefined) => `\n${first ?? second ?? ""}\n`);
  const code = lifted.replace(HEREDOC, " ").replace(QUOTED, " _ ");
  return code.split(/&&|\|\||[;|\n(){}]/).map((part) => part.trim().split(/\s+/).filter(Boolean));
}

function programOf(words: readonly string[]): { program: string | undefined; rest: string[] } {
  let index = 0;
  while (index < words.length && (WRAPPERS.has(words[index] ?? "") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index] ?? ""))) index++;
  // A path to the binary (/usr/bin/gh) is still that program.
  return { program: words[index]?.split("/").pop(), rest: words.slice(index + 1) };
}

// gh's global flags (-R owner/repo) may come before the subcommand.
function ghSubcommand(rest: readonly string[]): string[] {
  let index = 0;
  while ((rest[index] ?? "").startsWith("-")) index += GH_FLAGS_WITH_VALUE.has(rest[index] ?? "") ? 2 : 1;
  return rest.slice(index);
}

// API merges are judged on the whole command, because the endpoint or mutation is usually quoted.
const apiMerge = (command: string): boolean => MERGE_MUTATION.test(command) || (MERGE_ENDPOINT.test(command) && PUT.test(command))
  || (REVIEW_ENDPOINT.test(command) && APPROVE_EVENT.test(command));

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
  if (!isPrMerge(command)) return EXIT_OK;
  output.warn("block-pr-merge: this command would merge or approve a pull request. Only the owner merges or approves, on GitHub. Push the branch and open or update the PR instead (npm run pr).");
  return HOOK_BLOCK;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));

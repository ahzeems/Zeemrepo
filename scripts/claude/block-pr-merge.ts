// Claude Code PreToolUse hook: refuse Bash commands that merge a pull request.
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

const SHELLS = new Set(["bash", "sh", "zsh", "eval"]);
const MERGE_ENDPOINT = /\bpulls\/\d+\/merge\b/;
const PUT = /(?:-X\s*|--request[=\s]+|--method[=\s]+)PUT\b/i;
const MERGE_MUTATION = /\b(?:mergePullRequest|enablePullRequestAutoMerge)\b/;

// Quotes are dropped and the command is cut at shell separators, so `bash -c 'gh pr merge 1'`
// and `cd x && gh pr merge 1` are judged part by part.
function parts(command: string): string[][] {
  return command.replace(/["'`]/g, " ").split(/&&|\|\||[;|\n]/).map((part) => part.trim().split(/\s+/).filter(Boolean));
}

function isMergePart(words: readonly string[]): boolean {
  const start = words.findIndex((word) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word));
  const [program, ...rest] = start < 0 ? [] : words.slice(start);
  if (program === undefined) return false;
  if (SHELLS.has(program)) return isMergePart(rest[0] === "-c" ? rest.slice(1) : rest);
  const text = rest.join(" ");
  if (program === "gh") {
    if (/(?:^|\s)pr\s+merge\b/.test(text)) return true;
    return /(?:^|\s)api\b/.test(text) && (MERGE_MUTATION.test(text) || (MERGE_ENDPOINT.test(text) && PUT.test(text)));
  }
  if (program === "curl" || program === "wget") return MERGE_MUTATION.test(text) || (MERGE_ENDPOINT.test(text) && PUT.test(text));
  return false;
}

export function isPrMerge(command: string): boolean {
  return parts(command).some(isMergePart);
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
  output.warn("block-pr-merge: this command would merge a pull request. Only the owner merges, on GitHub. Push the branch and open or update the PR instead (npm run pr).");
  return HOOK_BLOCK;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));

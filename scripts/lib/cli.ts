import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

// Exit codes shared by every guard, so a hook or CI step can tell "the change was refused"
// apart from "the guard itself broke".
export const EXIT_OK = 0;
export const EXIT_REFUSED = 1;
export const EXIT_ERROR = 2;
const VALID_EXIT_CODES: readonly number[] = [EXIT_OK, EXIT_REFUSED, EXIT_ERROR];

export type Output = { write(line: string): void; warn(line: string): void };

export const consoleOutput: Output = {
  write: (line) => console.log(line),
  warn: (line) => console.error(line),
};

export function report(refusals: readonly string[], success: string, output: Output = consoleOutput): number {
  if (refusals.length === 0) {
    output.write(success);
    return EXIT_OK;
  }
  for (const refusal of refusals) output.warn(refusal);
  return EXIT_REFUSED;
}

/** `--root <path>` for a checker run against a fixture tree, or `fallback`; anything else throws `usage`. */
export function rootFrom(args: readonly string[], fallback: string, usage: string): string {
  if (args.length === 0) return fallback;
  const [flag, value, ...rest] = args;
  if (flag !== "--root" || value === undefined || rest.length > 0) throw new Error(usage);
  return resolve(value);
}

export type ModeSpec = { name: string; usage: string; modes: readonly string[] };

function modeList(modes: readonly string[]): string {
  if (modes.length === 1) return `or ${modes[0] ?? ""}`;
  return `${modes.slice(0, -1).join(", ")} or ${modes.at(-1) ?? ""}`;
}

/** A guard's arguments: nothing, or one of its modes. --help prints usage; anything else is an error. */
export function readMode(args: readonly string[], spec: ModeSpec, output: Output): { mode: string | undefined } | { exit: number } {
  const [first, ...rest] = args;
  if (first === "--help") {
    output.write(spec.usage);
    return { exit: EXIT_OK };
  }
  if (rest.length > 0 || (first !== undefined && !spec.modes.includes(first))) {
    output.warn(`${spec.name}: pass no arguments, ${modeList(spec.modes)}. See --help.`);
    return { exit: EXIT_ERROR };
  }
  return { mode: first };
}

function describe(error: unknown): string[] {
  if (!(error instanceof Error)) return [`error: ${inspect(error)}`];
  const lines = [`error: ${error.message}`];
  for (let cause = error.cause; cause !== undefined; cause = cause instanceof Error ? cause.cause : undefined) {
    lines.push(`  caused by: ${cause instanceof Error ? cause.message : inspect(cause)}`);
  }
  return lines;
}

// The exit code is set before anything is printed, so a failing stderr (EPIPE) cannot turn
// a broken guard into a pass or a mislabelled refusal. Callers must await runCli.
export async function runCli(main: () => number | Promise<number>, output: Output = consoleOutput): Promise<void> {
  let lines: string[];
  try {
    const code = await main();
    if (VALID_EXIT_CODES.includes(code)) {
      process.exitCode = code;
      return;
    }
    lines = [`error: invalid exit code ${String(code)}; guards return 0, 1 or 2`];
  } catch (error) {
    lines = describe(error);
  }
  process.exitCode = EXIT_ERROR;
  try {
    for (const line of lines) output.warn(line);
  } catch {
    // Nothing left to report to; the exit code already says the guard broke.
  }
}

// True when the module at `moduleUrl` is the script node was started with, so a CLI can
// export main() for in-process tests (which coverage can see) and still run as a script.
export function isEntryPoint(moduleUrl: string): boolean {
  const script = process.argv[1];
  if (script === undefined) return false;
  try {
    return realpathSync(script) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    // A path that does not resolve is not this module.
    return false;
  }
}

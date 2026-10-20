// A minimal CLI template: a pure function plus the main/isEntryPoint wiring every script here
// uses, so a new script application can be copied from a working, tested example.
import { EXIT_ERROR, EXIT_OK, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";

const USAGE = "usage: greet [name]";

/** The greeting for a name, falling back to the world when the name is empty. */
export function greet(name: string): string {
  return `Hello, ${name === "" ? "world" : name}!`;
}

/**
 * greet [name]: prints one greeting. No name (or a blank one) greets the world; --help prints
 * usage; more than one argument, or one that looks like a flag, is a usage error.
 */
export function main(args: readonly string[], output: Output = consoleOutput): number {
  if (args[0] === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  if (args.length > 1 || args[0]?.startsWith("-")) {
    output.warn(USAGE);
    return EXIT_ERROR;
  }
  output.write(greet((args[0] ?? "").trim()));
  return EXIT_OK;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));

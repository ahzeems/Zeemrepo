import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";

// Git run from inside a hook inherits GIT_DIR and GIT_INDEX_FILE, so a fixture's git
// commands would act on the hooked repository instead of the fixture. Every GIT_ variable
// is dropped, user and system config are ignored, and discovery stops at the temp dir.
export const cleanGitEnv: NodeJS.ProcessEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: devNull,
  GIT_TERMINAL_PROMPT: "0",
  GIT_CEILING_DIRECTORIES: tmpdir(),
};

export type RepoFixture = {
  dir: string;
  git(args: readonly string[]): string;
  write(path: string, content: string): void;
  commit(message: string): string;
  cleanup(): void;
};

export function createRepo(prefix = "repo-fixture-"): RepoFixture {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const git = (args: readonly string[]): string =>
    execFileSync("git", args, { cwd: dir, env: cleanGitEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git(["init", "--quiet", "--initial-branch=main"]);
  git(["config", "user.name", "Fixture"]);
  git(["config", "user.email", "fixture@example.invalid"]);
  git(["config", "commit.gpgsign", "false"]);
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  const commit = (message: string): string => {
    git(["add", "--all"]);
    git(["commit", "--quiet", "--allow-empty", "--message", message]);
    return git(["rev-parse", "HEAD"]);
  };
  return { dir, git, write, commit, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

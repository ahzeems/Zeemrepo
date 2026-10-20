import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentProvider } from "@ai-hero/sandcastle";
import { isEntryPoint, runCli } from "../lib/cli.ts";
import { isRecord } from "../lib/record.ts";
import { main } from "../sandcastle/guest-runner.ts";
import { createRepo, type RepoFixture } from "./repo-fixture.ts";

// A target repository for an isolated run with scripted agents in place of a model, and the guest
// entry point that runs guest-runner.ts with them (S14). The agents read fixture.json from the run
// repository: `implementer` "commit" works and finishes, "hang" commits and then never returns.
// The implementer plants a core.fsmonitor command that appends to <marker>/log; the merger copies
// that log into the candidate as fired.txt, so the host can see that it fired inside the guest.

export type Behaviour = { marker: string; implementer: "commit" | "hang" };
export const REPOSITORY = "Zimfra/software_testing";
export const TASK = "fixture-run";
export const REF = `refs/heads/sandcastle/run-${TASK}`;

const PROMPTS: Readonly<Record<string, string>> = {
  "plan-prompt.md": "ROLE: planner\nEmit the plan in <plan> tags.\n",
  "implement-prompt.md": "ROLE: implementer\n{{TASK_ID}} {{ISSUE_TITLE}} {{BRANCH}}\n",
  "review-prompt.md": "ROLE: reviewer\n{{BRANCH}} {{BASE}} {{CANDIDATE}}\n",
  "merge-prompt.md": "ROLE: merger\n{{BRANCHES}}\n{{ISSUES}}\n",
};
const PACKAGE = `${JSON.stringify({ name: "isolated-run-fixture", version: "1.0.0", private: true }, null, 2)}\n`;
const LOCK = `${JSON.stringify({ name: "isolated-run-fixture", version: "1.0.0", lockfileVersion: 3, requires: true, packages: { "": { name: "isolated-run-fixture", version: "1.0.0" } } }, null, 2)}\n`;
const ID = "-c user.name=Fixture -c user.email=fixture@example.invalid";
const DONE = "echo '<promise>COMPLETE</promise>'";

/** A host repository whose main is the base an isolated run starts from. */
export function createTarget(behaviour: Behaviour): RepoFixture {
  const repo = createRepo("isolated-run-target-");
  for (const [name, text] of Object.entries(PROMPTS)) repo.write(`.sandcastle/${name}`, text);
  repo.write(".gitignore", ".sandcastle/worktrees/\n.sandcastle/logs/\nnode_modules/\n");
  repo.write("package.json", PACKAGE);
  repo.write("package-lock.json", LOCK);
  repo.write("fixture.json", `${JSON.stringify(behaviour)}\n`);
  repo.commit("base");
  return repo;
}

function implementer({ marker, implementer: mode }: Behaviour): string {
  const monitor = join(marker, "fsmonitor.sh");
  return [
    `mkdir -p ${marker}`, `printf '#!/bin/sh\\necho fsmonitor >> ${join(marker, "log")}\\n' > ${monitor}`, `chmod +x ${monitor}`,
    `git config core.fsmonitor ${monitor}`, "echo work > work.txt", "git add work.txt", `git ${ID} commit --quiet -m work`,
    mode === "hang" ? "sleep 3600" : DONE,
  ].join(" && ");
}

function command(prompt: string, behaviour: Behaviour): string {
  const role = /^ROLE: (\w+)/.exec(prompt)?.[1];
  if (role === "planner") return `echo '<plan>{"issues":[{"id":"1","title":"Fixture work","branch":"sandcastle/issue-1"}],"blocked":[]}</plan>'`;
  if (role === "implementer") return implementer(behaviour);
  if (role === "reviewer") return `printf '<review>{"verdict":"pass","sha":"%s","reason":"fixture"}</review>\\n' "$(git rev-parse HEAD)"`;
  if (role === "merger") {
    return [`git ${ID} merge --quiet --no-edit sandcastle/issue-1`, `cat ${join(behaviour.marker, "log")} > fired.txt`, "git add fired.txt", `git ${ID} commit --quiet -m fired`, DONE].join(" && ");
  }
  return "echo 'no fixture role in the prompt' >&2; exit 1";
}

/** Every role's scripted agent, reading fixture.json from the working directory it starts in. */
export function fixtureAgent(): AgentProvider {
  const value: unknown = JSON.parse(readFileSync("fixture.json", "utf8"));
  if (!isRecord(value) || typeof value.marker !== "string" || (value.implementer !== "commit" && value.implementer !== "hang")) throw new Error("isolated-run-fixture: fixture.json is not a behaviour");
  const behaviour: Behaviour = { marker: value.marker, implementer: value.implementer };
  return {
    name: "isolated-run-fixture", env: {}, captureSessions: false,
    buildPrintCommand: ({ prompt }) => ({ command: command(prompt, behaviour) }),
    parseStreamLine: (line) => [{ type: "text", text: line }],
  };
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2), fixtureAgent));

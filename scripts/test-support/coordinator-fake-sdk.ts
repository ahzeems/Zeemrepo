import type { Plan } from "../sandcastle/plan-schema.ts";

// A stand-in for @ai-hero/sandcastle and its docker provider: no model, container or network.
// Every call is recorded in `journal`; the scripted `agent` decides what each agent run commits,
// prints or throws, `sandbox` may reject a sandbox creation, and `plans` holds the raw planner
// output for each planning round in turn.

type Commit = { readonly sha: string };
type Schema = { "~standard": { validate(value: unknown): { value: Plan } | { issues: readonly { message: string }[] } } };
type Options = { readonly name?: string; readonly branch?: string; readonly promptArgs?: Readonly<Record<string, string>> };
type RunOptions = Options & { readonly output?: { readonly tag: string; readonly schema: Schema } };
type Reply = { readonly commits?: readonly Commit[]; readonly stdout?: string };
type Result = { commits: readonly Commit[]; stdout: string };

export type AgentCall = { name: string; branch: string | undefined; promptArgs: Readonly<Record<string, string>> | undefined };
export type Event = { call: "run" | "createSandbox" | "sandbox.run" | "close"; name?: string | undefined; branch?: string | undefined; options?: unknown };
type Agent = (call: AgentCall) => readonly Commit[] | Reply | Promise<readonly Commit[] | Reply>;
export type Scenario = { plans?: unknown[]; agent?: Agent; sandbox?: (branch: string) => void };

let plans: unknown[] = [];
let agent: Agent = () => [];
let sandboxHook: (branch: string) => void = () => undefined;
export const journal: Event[] = [];

export function script(scenario: Scenario = {}): void {
  plans = [...(scenario.plans ?? [])];
  agent = scenario.agent ?? (() => []);
  sandboxHook = scenario.sandbox ?? (() => undefined);
  journal.length = 0;
}

export const claudeCode = (model: string): { model: string } => ({ model });
export const docker = (): { provider: string } => ({ provider: "docker" });
export const Output = {
  object: (definition: { tag: string; schema: Schema }): { tag: string; schema: Schema } => ({ ...definition }),
};

function plan(schema: Schema): Plan {
  const result = schema["~standard"].validate(plans.shift() ?? { issues: [] });
  if ("issues" in result) throw new Error(`fake StructuredOutputError: ${result.issues.map((issue) => issue.message).join("; ")}`);
  return result.value;
}

const isList = (answer: readonly Commit[] | Reply): answer is readonly Commit[] => Array.isArray(answer);

async function reply(call: AgentCall): Promise<Result> {
  const answer = await agent(call);
  if (isList(answer)) return { commits: answer, stdout: "" };
  const { commits = [], stdout = "" } = answer;
  return { commits, stdout };
}

export async function run(options: RunOptions): Promise<Result & { output: Plan }> {
  await Promise.resolve();
  journal.push({ call: "run", name: options.name, options });
  if (options.output !== undefined) return { output: plan(options.output.schema), commits: [], stdout: "" };
  return { output: { issues: [] }, ...await reply({ name: options.name ?? "", branch: undefined, promptArgs: options.promptArgs }) };
}

type Handle = { run(options: Options): Promise<Result>; close(): Promise<void> };

export async function createSandbox(options: { readonly branch: string }): Promise<Handle> {
  await Promise.resolve();
  const { branch } = options;
  journal.push({ call: "createSandbox", branch, options });
  sandboxHook(branch);
  return {
    run: async (runOptions) => {
      await Promise.resolve();
      journal.push({ call: "sandbox.run", name: runOptions.name, branch, options: runOptions });
      return reply({ name: runOptions.name ?? "", branch, promptArgs: runOptions.promptArgs });
    },
    close: async () => {
      await Promise.resolve();
      journal.push({ call: "close", branch });
    },
  };
}

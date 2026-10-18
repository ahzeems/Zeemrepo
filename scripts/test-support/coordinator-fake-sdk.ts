import type { Plan } from "../sandcastle/plan-schema.ts";

// A stand-in for @ai-hero/sandcastle and its docker provider: no model, container or network.
// Every call is recorded in `journal`; the scripted `agent` decides what each agent run commits
// or throws, and `plans` holds the raw planner output for each planning round in turn.

type Commit = { readonly sha: string };
type Schema = { "~standard": { validate(value: unknown): { value: Plan } | { issues: readonly { message: string }[] } } };
type Options = { readonly name?: string; readonly branch?: string; readonly promptArgs?: Readonly<Record<string, string>> };
type RunOptions = Options & { readonly output?: { readonly tag: string; readonly schema: Schema } };

export type AgentCall = { name: string; branch: string | undefined; promptArgs: Readonly<Record<string, string>> | undefined };
export type Event = { call: "run" | "createSandbox" | "sandbox.run" | "close"; name?: string | undefined; branch?: string | undefined; options?: unknown };
type Agent = (call: AgentCall) => readonly Commit[] | Promise<readonly Commit[]>;
export type Scenario = { plans?: unknown[]; agent?: Agent };

let plans: unknown[] = [];
let agent: Agent = () => [];
export const journal: Event[] = [];

export function script(scenario: Scenario = {}): void {
  plans = [...(scenario.plans ?? [])];
  agent = scenario.agent ?? (() => []);
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

export async function run(options: RunOptions): Promise<{ output: Plan; commits: readonly Commit[] }> {
  await Promise.resolve();
  journal.push({ call: "run", name: options.name, options });
  if (options.output !== undefined) return { output: plan(options.output.schema), commits: [] };
  return { output: { issues: [] }, commits: await agent({ name: options.name ?? "", branch: undefined, promptArgs: options.promptArgs }) };
}

type Handle = { run(options: Options): Promise<{ commits: readonly Commit[] }>; close(): Promise<void> };

export async function createSandbox(options: { readonly branch: string }): Promise<Handle> {
  await Promise.resolve();
  const { branch } = options;
  journal.push({ call: "createSandbox", branch, options });
  return {
    run: async (runOptions) => {
      await Promise.resolve();
      journal.push({ call: "sandbox.run", name: runOptions.name, branch, options: runOptions });
      return { commits: await agent({ name: runOptions.name ?? "", branch, promptArgs: runOptions.promptArgs }) };
    },
    close: async () => {
      await Promise.resolve();
      journal.push({ call: "close", branch });
    },
  };
}

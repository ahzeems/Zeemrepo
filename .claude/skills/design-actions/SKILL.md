---
name: design-actions
description: "Design agent actions: one entry, validated inputs, dry run, structured output, and actionable refusal."
---

An action has one clear entry. A new verb is a new piece of authority, so it earns its shape
before it earns its code. The implementation follows the TypeScript rules in .claude/rules/.

## What a verb owes its caller

| Obligation | Why |
|---|---|
| `--json` | The caller is usually software; a result it must parse out of prose is a bug waiting |
| `--dry-run` on anything that acts | A verb that cannot be rehearsed is one you find out about in production |
| Validated inputs, refused early | Exit 1 with every reason, before any side effect. Not the first reason: all of them |
| Idempotent where it can be | Running it twice is a thing that happens; say in the documentation what the second run does |
| Exit codes that mean something | 0 allowed and done, 1 refused, 2 the tool itself failed (`EXIT_OK`, `EXIT_REFUSED`, `EXIT_ERROR` in scripts/lib/cli.ts). A refusal is not a crash |
| A refusal that names the way forward | "needs owner approval" beats "invalid arguments" |
| Action logic separate from the parser | So the verb is testable without the command-line parser |
| A line in the module documentation | `--help` and the file agree |

## Authority

Merging a pull request is the owner's act. Credential handling, deletion of cloud resources,
and deletion of an unmerged branch or of a branch or worktree another session owns also remain
subject to the owner's authority. Deleting your own branch and worktree after the owner merged
its pull request is routine cleanup ([manage-branch](../manage-branch/SKILL.md)). Adding an
action does not grant permission.

An action that spends money, applies infrastructure or sends something outside the local
workspace needs explicit owner authorization, checked before the side effect. Reuse actual
authorization already given for that action and scope; a command-line flag cannot invent it.

## Shape of the code

```typescript
type ActionResult = {
  allowed: boolean;
  refusals: string[];
  dryRun: boolean;
};

async function runAction(
  dryRun: boolean,
  validate: () => string[],
  execute: () => Promise<void>,
): Promise<ActionResult> {
  const refusals = validate();
  const result = { allowed: refusals.length === 0, refusals, dryRun };
  if (!result.allowed || dryRun) return result;
  await execute();
  return result;
}
```

This is an interface example, not a shipped command. The caller handles execution failure
and confirms the resulting state; validation includes input and authorization checks.

An injected validator or runner is how a test replaces the world (an external API or a
clock) without a flag on the command line that production could use to bypass a check.

## Write these tests first

Before the code, write tests for validation, refusal before effects, dry run without effects,
success, failure, and retry behavior. Add the real entry point and its prerequisites to the relevant README.

Two real consumers justify a shared dispatcher; one is a direct function or script.

Repository integration: the repository rules in .claude/rules/.

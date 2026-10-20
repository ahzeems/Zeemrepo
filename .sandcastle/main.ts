// Runs the Sandcastle loop (plan, execute and review per issue, merge) in the current checkout.
// The loop lives in scripts/sandcastle/coordinator.ts, where it is tested against a fake SDK;
// this entry point only hands it the real SDK and the docker provider.
//
// Usage:
//   npm run sandcastle

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { coordinate } from "../scripts/sandcastle/coordinator.ts";

process.exitCode = await coordinate({
  cwd: process.cwd(),
  sandcastle: { ...sandcastle, docker },
  log: (line) => console.log(line),
  error: (line) => console.error(line),
});

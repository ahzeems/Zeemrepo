import { registerHooks } from "node:module";

export const FAKE_SDK = new URL("./coordinator-fake-sdk.ts", import.meta.url).href;
const FAKED = new Set(["@ai-hero/sandcastle", "@ai-hero/sandcastle/sandboxes/docker"]);

// Resolves the Sandcastle SDK and its docker provider to the fake, in this process only, and
// records every specifier resolved after registration. Any other SDK entry point is refused
// rather than loaded, so a new import in the coordinator cannot reach a real agent in a test.
export function redirectSandcastle(): { resolved: string[]; deregister(): void } {
  const resolved: string[] = [];
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      resolved.push(specifier);
      if (FAKED.has(specifier)) return { url: FAKE_SDK, shortCircuit: true };
      if (specifier.startsWith("@ai-hero/sandcastle")) throw new Error(`no fake for ${specifier}`);
      return nextResolve(specifier, context);
    },
  });
  return { resolved, deregister: () => hooks.deregister() };
}

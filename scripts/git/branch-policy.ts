// The branch rules behind the git hooks. Pure; the CLI lives in branch-guard.ts.
//
// Nothing reaches main except through a pull request the owner merges on GitHub (owner
// decision, 2026-10-09). The GitHub ruleset enforces that server-side; these hooks refuse
// earlier, on this machine, so the mistake never leaves it.

export type PushUpdate = { localRef: string; localOid: string; remoteRef: string; remoteOid: string };
export type IsAncestor = (ancestor: string, descendant: string) => boolean;

const MAIN = "refs/heads/main";
const OID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const isZero = (oid: string): boolean => /^0+$/.test(oid);

export function commitRefusals(headRef: string | null): string[] {
  if (headRef === null) return ["Commits need a named feature branch, not a detached HEAD. In a rebase or cherry-pick, finish it on a branch; published history is merged, never rebased."];
  return headRef === MAIN ? ["Do not commit on main. Branch first, then open a pull request with npm run pr; the owner merges it."] : [];
}

function updateRefusal(update: PushUpdate, isAncestor: IsAncestor): string | null {
  const { localOid, remoteRef, remoteOid } = update;
  if (!OID.test(localOid) || !OID.test(remoteOid) || !remoteRef.startsWith("refs/")) {
    return "Invalid pre-push input. Run this guard through git's pre-push hook.";
  }
  if (remoteRef === MAIN) return "Refusing to push main. Work lands only through a pull request the owner merges; push a feature branch and run npm run pr.";
  if (!remoteRef.startsWith("refs/heads/")) return null;
  if (isZero(localOid)) {
    // A deleted branch must have landed; deleting unmerged work loses it.
    return isAncestor(remoteOid, "refs/remotes/origin/main") ? null
      : `Cannot confirm ${remoteRef} landed on origin/main. Fetch origin; if the PR was squash-merged, delete the branch on GitHub instead.`;
  }
  if (!isZero(remoteOid) && !isAncestor(remoteOid, localOid)) {
    return `Refusing to rewrite ${remoteRef}. Fetch it and merge it into your branch; published history is never rebased or force-pushed.`;
  }
  return null;
}

export function pushRefusals(updates: readonly PushUpdate[], isAncestor: IsAncestor): string[] {
  return updates.flatMap((update) => updateRefusal(update, isAncestor) ?? []);
}

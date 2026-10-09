// Worktree rules. Pure; the CLI lives in worktree-guard.ts.
export type Risk = { path: string; uncommitted: number; unpushed: number };
export type Worktree = { path: string; bare: boolean };

// `git worktree list --porcelain -z`: records end with NUL NUL, fields with NUL. A bare
// record has no HEAD and is not a checkout; every other record has exactly one HEAD.
export function parseWorktrees(porcelain: string): Worktree[] {
  if (porcelain.length === 0 || !porcelain.endsWith("\0\0")) throw new Error("git returned incomplete worktree porcelain");
  return porcelain.slice(0, -2).split("\0\0").map((record) => {
    const [first = "", ...attributes] = record.split("\0");
    const path = first.startsWith("worktree ") ? first.slice("worktree ".length) : "";
    const bare = attributes.filter((attribute) => attribute === "bare").length;
    const heads = attributes.filter((attribute) => attribute.startsWith("HEAD ")).length;
    const consistent = path !== "" && !attributes.some((attribute) => attribute.startsWith("worktree ")) && bare <= 1 && (bare === 1 ? heads === 0 : heads === 1);
    if (!consistent) throw new Error("git returned an invalid worktree porcelain record");
    return { path, bare: bare === 1 };
  });
}

export function countLines(output: string): number {
  return output.trim().length === 0 ? 0 : output.trim().split(/\r?\n/).length;
}

export function describeRisk(risk: Risk): string {
  const parts: string[] = [];
  if (risk.uncommitted > 0) parts.push(`${risk.uncommitted} uncommitted file(s)`);
  if (risk.unpushed > 0) parts.push(`${risk.unpushed} unpushed commit(s)`);
  return `${risk.path}: ${parts.join(", ")}`;
}

import { WIKI_DIR } from "../lib/paths.ts";

// The wiki commit rule: wiki files are committed alone, with a conventional `docs(wiki):`
// subject. Zimi first had this in prose only and it was broken anyway, because prose does
// not run. Pure and read-only; the CLI lives in wiki-compliance.ts.
// resolutionOnly: a merge whose own changes (its --remerge-diff) only resolve conflicts.
export type Commit = { sha: string; subject: string; files: readonly string[]; resolutionOnly?: boolean };
export type Violation = { sha: string; subject: string; kind: "mixed" | "subject"; detail: string };

const WIKI_SUBJECT = /^docs\(wiki\)!?: \S/;

// One classification for history and the staged index, so the two checks cannot disagree.
// Case-insensitive, because macOS and Windows checkouts resolve Wiki/ to wiki/; the bare
// path covers a wiki symlink or submodule entry.
function isWiki(path: string): boolean {
  const lower = path.toLowerCase();
  return lower === WIKI_DIR.slice(0, -1) || lower.startsWith(WIKI_DIR);
}

function splitPaths(files: readonly string[]): { wiki: string[]; other: string[] } {
  return { wiki: files.filter(isWiki), other: files.filter((file) => !isWiki(file)) };
}

// The staged index has no subject yet, so the subject rule stays with the history check.
export function stagedMix(files: readonly string[]): { wiki: string[]; other: string[] } | null {
  const split = splitPaths(files);
  return split.wiki.length > 0 && split.other.length > 0 ? split : null;
}

export function commitViolations(commits: readonly Commit[]): Violation[] {
  return commits.flatMap((commit): Violation[] => {
    if (commit.resolutionOnly === true) return [];
    const { wiki, other } = splitPaths(commit.files);
    if (wiki.length === 0) {
      if (!WIKI_SUBJECT.test(commit.subject)) return [];
      return [{ sha: commit.sha, subject: commit.subject, kind: "subject", detail: "a docs(wiki) subject on a commit that changes no wiki files" }];
    }
    if (other.length > 0) {
      const detail = `mixes ${wiki.length} wiki file(s) with ${other.length} other file(s), first ${wiki[0] ?? ""}`;
      return [{ sha: commit.sha, subject: commit.subject, kind: "mixed", detail }];
    }
    if (WIKI_SUBJECT.test(commit.subject)) return [];
    return [{ sha: commit.sha, subject: commit.subject, kind: "subject", detail: 'a wiki-only commit needs a subject beginning "docs(wiki): "' }];
  });
}

// OWNER DECISION, 2026-10-09: a merge may resolve conflicts in wiki and other files at once,
// because two open pull requests usually conflict on CHANGELOG.md and a work record together;
// an unrelated edit still makes it mixed. A hunk of the merge's --remerge-diff counts as a
// resolution only when it removes a conflict marker and every line it adds is one of the two
// sides' lines it removed; a written line belongs in a commit of its own. A file with no hunk
// (a modify/delete conflict, a mode change) does not count.
const MARKER = /^(?:<{7}|={7}|>{7})(?: |$)/;

function resolvesOnly(hunk: string): boolean {
  const lines = hunk.split("\n").slice(1);
  const removed = lines.filter((line) => line.startsWith("-")).map((line) => line.slice(1));
  const sides = new Set(removed.filter((line) => !MARKER.test(line)));
  const added = lines.filter((line) => line.startsWith("+")).map((line) => line.slice(1));
  return removed.some((line) => MARKER.test(line)) && added.every((line) => sides.has(line));
}

export function isConflictResolution(patch: string): boolean {
  const files = patch.split(/^diff --git /m).slice(1);
  return files.length > 0 && files.every((file) => {
    const hunks = file.split(/^@@ /m).slice(1);
    return hunks.length > 0 && hunks.every(resolvesOnly);
  });
}

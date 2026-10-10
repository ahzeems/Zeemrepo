import { WIKI_DIR } from "../lib/paths.ts";

// The wiki commit rule: wiki files are committed alone, with a conventional `docs(wiki):`
// subject. It is a check because a rule in prose only gets broken: prose does not run. Pure and read-only; the CLI lives in wiki-compliance.ts.
// resolutionOnly: a merge whose own changes (its --remerge-diff) only resolve conflicts.
// octopus: a merge of three or more parents, which git cannot remerge, so it cannot be judged.
export type Commit = { sha: string; subject: string; files: readonly string[]; resolutionOnly?: boolean; octopus?: boolean };
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
    if (commit.octopus === true) {
      return [{ sha: commit.sha, subject: commit.subject, kind: "mixed", detail: "an octopus merge cannot be judged (git skips its remerge-diff); merge one branch at a time" }];
    }
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
// an unrelated edit still makes it mixed. In the merge's --remerge-diff, every file must be one
// git itself reported as a content conflict, with no mode change, deletion, creation or rename,
// and every hunk must remove a whole marker set and add only lines the two sides had. A written
// line belongs in a commit of its own. Marker-like lines in ordinary files (a setext heading)
// therefore do not count: git did not report those files as conflicted.
const CONFLICT_HEADER = /^remerge CONFLICT \(content\): /m;
const NOT_CONTENT = /^(?:old mode|new mode|deleted file mode|new file mode|similarity index|rename from|copy from)/m;
const MARKERS = [/^<{7} /, /^={7}$/, /^>{7} /];
const isMarker = (line: string): boolean => MARKERS.some((marker) => marker.test(line));

// The sides are the lines removed inside a marker block; a line removed outside one is an edit.
function sidesOf(removed: readonly string[]): Set<string> | null {
  const sides = new Set<string>();
  let inside = false;
  for (const line of removed) {
    if (MARKERS[0]?.test(line) === true) inside = true;
    else if (MARKERS[2]?.test(line) === true) inside = false;
    else if (!inside) return null;
    else if (!isMarker(line)) sides.add(line);
  }
  return sides;
}

function resolvesOnly(hunk: string): boolean {
  const lines = hunk.split("\n").slice(1);
  const removed = lines.filter((line) => line.startsWith("-")).map((line) => line.slice(1));
  const added = lines.filter((line) => line.startsWith("+")).map((line) => line.slice(1));
  const sides = sidesOf(removed);
  return sides !== null && MARKERS.every((marker) => removed.some((line) => marker.test(line))) && added.every((line) => sides.has(line));
}

function fileResolvesOnly(section: string): boolean {
  const [header = "", ...hunks] = section.split(/^@@ /m);
  return CONFLICT_HEADER.test(header) && !NOT_CONTENT.test(header) && hunks.length > 0 && hunks.every(resolvesOnly);
}

export function isConflictResolution(patch: string): boolean {
  const files = patch.split(/^diff --git /m).slice(1);
  return files.length > 0 && files.every(fileResolvesOnly);
}

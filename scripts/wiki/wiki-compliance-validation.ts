import { WIKI_DIR } from "../lib/paths.ts";

// The wiki commit rule: wiki files are committed alone, with a conventional `docs(wiki):`
// subject. Zimi first had this in prose only and it was broken anyway, because prose does
// not run. Pure and read-only; the CLI lives in wiki-compliance.ts.
export type Commit = { sha: string; subject: string; files: readonly string[] };
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

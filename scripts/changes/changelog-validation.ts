import { isExempt } from "../lib/change-policy.ts";
import { CHANGELOG } from "../lib/paths.ts";

// The changelog rule. Pure; the CLI lives in changelog-guard.ts. Every branch that changes
// something that matters adds a dated entry describing it, under a heading dated between the
// branch's fork point and today (UTC). Zimi required the current day's heading, so a branch
// reviewed on one day and landed the next had to be edited, and re-reviewed, just to move it.

export type Window = { from: string; to: string };
export type ChangelogInput = { changed: readonly string[]; added: readonly string[]; changelog: string; window: Window };

const ENTRY = /^\s*[-*]\s+\S/;
const DATE_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
// Facts that only exist after the owner merges the PR. An entry needing them would need a
// second PR to record, which is the reconciliation debt this rule prevents (ADR-0007).
const POST_MERGE = /merge commit|\bmerged in\b|\bcherry-pick(ed)?\b/i;

/** Each entry line, mapped to the date heading it sits under (the first occurrence wins). */
export function entriesByDate(changelog: string): Map<string, string> {
  const entries = new Map<string, string>();
  let date: string | undefined;
  for (const line of changelog.replace(/\r\n/g, "\n").split("\n")) {
    const heading = DATE_HEADING.exec(line);
    if (heading) date = heading[1];
    else if (/^#{1,2}\s/.test(line)) date = undefined;
    else if (date !== undefined && ENTRY.test(line) && !entries.has(line)) entries.set(line, date);
  }
  return entries;
}

export function changelogRefusals({ changed, added, changelog, window }: ChangelogInput): string[] {
  const relevant = changed.filter((file) => file !== CHANGELOG && !isExempt(file));
  if (relevant.length === 0) return [];
  if (!changed.includes(CHANGELOG)) {
    return [`This branch changes ${relevant.length} file(s) but adds no entry to ${CHANGELOG}. Record the change in this PR; no follow-up PR records it later.`];
  }
  const entries = added.filter((line) => ENTRY.test(line));
  if (entries.length === 0) return [`${CHANGELOG} changed without adding an entry line. Add a "- " entry describing the change.`];
  const dated = entriesByDate(changelog);
  const inWindow = entries.filter((line) => {
    const date = dated.get(line);
    return date !== undefined && date >= window.from && date <= window.to;
  });
  if (inWindow.length === 0) {
    return [`No added entry sits under a date heading between ${window.from} and ${window.to} (UTC) in ${CHANGELOG}. Put it under "## <date>" in that range.`];
  }
  // Only entry lines are checked; surrounding prose may name the rule it describes.
  const offender = entries.find((line) => POST_MERGE.test(line));
  return offender === undefined ? [] : [
    `An entry cites a post-merge fact, which cannot be known before the owner merges: ${offender.trim().slice(0, 80)}. Describe the change instead.`,
  ];
}

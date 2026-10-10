import { isExempt } from "../lib/change-policy.ts";
import { CHANGELOG } from "../lib/paths.ts";

// The changelog rule. Pure; the CLI lives in changelog-guard.ts. Every branch that changes
// something that matters adds a dated entry describing it, under a heading dated between the
// day the branch started and today (UTC). Zimi required the current day's heading, so a
// branch reviewed on one day and landed the next had to be edited and re-reviewed.
// Entries are judged by their position in the file, never by their text, so a line that
// repeats an older entry cannot borrow that entry's date.

type Window = { from: string; to: string };
type ChangelogInput = { changed: readonly string[]; changelog: string; addedLines: readonly number[]; window: Window };

const ENTRY = /^\s*[-*]\s+\S/;
const DATE_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
const FENCE = /^\s*(```|~~~)/;
// Facts that only exist after the owner merges the PR. An entry needing them would need a
// second PR to record, which is the reconciliation debt this rule prevents (ADR-0007).
const POST_MERGE = /merge commit|\bmerged in\b|\bcherry-pick(ed)?\b/i;

function realDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
const linesOf = (text: string): string[] => text.replace(/\r\n/g, "\n").split("\n");

/** For each 1-based line, the date heading it sits under; undefined outside one or in a code fence. */
export function headingDates(changelog: string): (string | undefined)[] {
  const dates: (string | undefined)[] = [undefined];
  let date: string | undefined;
  let fenced = false;
  for (const line of linesOf(changelog)) {
    if (FENCE.test(line)) fenced = !fenced;
    const heading = fenced ? null : DATE_HEADING.exec(line);
    if (heading?.[1] !== undefined) date = realDate(heading[1]) ? heading[1] : undefined;
    else if (!fenced && /^#{1,2}\s/.test(line)) date = undefined;
    dates.push(fenced || FENCE.test(line) ? undefined : date);
  }
  return dates;
}

/** 1-based numbers of entry lines ("- " or "* " items) outside code fences. */
function entryLineNumbers(changelog: string): Set<number> {
  const entries = new Set<number>();
  let fenced = false;
  linesOf(changelog).forEach((line, index) => {
    if (FENCE.test(line)) fenced = !fenced;
    else if (!fenced && ENTRY.test(line)) entries.add(index + 1);
  });
  return entries;
}

export function changelogRefusals({ changed, changelog, addedLines, window }: ChangelogInput): string[] {
  const relevant = changed.filter((file) => file !== CHANGELOG && !isExempt(file));
  if (relevant.length === 0) return [];
  if (!changed.includes(CHANGELOG)) {
    return [`This branch changes ${relevant.length} file(s) but adds no entry to ${CHANGELOG}. Record the change in this PR; no follow-up PR records it later.`];
  }
  const lines = linesOf(changelog);
  const dates = headingDates(changelog);
  const entryLines = entryLineNumbers(changelog);
  const entries = addedLines.filter((number) => entryLines.has(number));
  if (entries.length === 0) return [`${CHANGELOG} changed without adding an entry line. Add a "- " entry describing the change.`];
  const inWindow = entries.filter((number) => {
    const date = dates[number];
    return date !== undefined && date >= window.from && date <= window.to;
  });
  if (inWindow.length === 0) {
    return [`No added entry sits under a date heading between ${window.from} and ${window.to} (UTC) in ${CHANGELOG}. Put it under "## <date>" in that range.`];
  }
  // Only entry lines are checked; surrounding prose may name the rule it describes.
  const offender = entries.map((number) => lines[number - 1] ?? "").find((line) => POST_MERGE.test(line));
  return offender === undefined ? [] : [
    `An entry cites a post-merge fact, which cannot be known before the owner merges: ${offender.trim().slice(0, 80)}. Describe the change instead.`,
  ];
}

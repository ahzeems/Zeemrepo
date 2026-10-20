import { isExempt } from "../lib/change-policy.ts";
import { CHANGELOG, CHANGELOG_DIR, CHANGELOG_FRAGMENT_PATTERN } from "../lib/paths.ts";

// The changelog rule (ADR-0027). Pure; the CLI lives in changelog-guard.ts. Every branch that
// changes something that matters adds its own new fragment, changelog/<YYYY-MM-DD>-<slug>.md,
// dated between the day the branch started and today (UTC), so two open branches never edit
// the same file. Requiring the current day would force a branch reviewed on one day and landed
// the next to be edited and re-reviewed. Fragments on main and CHANGELOG.md are history.

type Window = { from: string; to: string };
/** A path under changelog/ that differs from the base, with its content on the branch. */
export type FragmentChange = { path: string; status: "added" | "modified" | "deleted"; content: string };
type ChangelogInput = { changed: readonly string[]; fragments: readonly FragmentChange[]; baseHasFragment: boolean; window: Window };

const ENTRY = /^\s*[-*]\s+\S/;
const FENCE = /^\s*(```|~~~)/;
const FRAGMENT_NAME = `${CHANGELOG_DIR}<YYYY-MM-DD>-<slug>.md`;
// Facts that only exist after the owner merges the PR. An entry needing them would need a
// second PR to record, which is the reconciliation debt this rule prevents (ADR-0007, ADR-0027).
const POST_MERGE = /merge commit|\bmerged in\b|\bcherry-pick(ed)?\b/i;

function realDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/** Entry lines ("- " or "* " items) outside code fences. */
function entryLines(content: string): string[] {
  let fenced = false;
  return content.replace(/\r\n/g, "\n").split("\n").filter((line) => {
    if (FENCE.test(line)) fenced = !fenced;
    else if (!fenced && ENTRY.test(line)) return true;
    return false;
  });
}

function fragmentRefusals({ path, content }: FragmentChange, window: Window): string[] {
  if (!CHANGELOG_FRAGMENT_PATTERN.test(path)) return [`${path} is not named ${FRAGMENT_NAME}. Rename it.`];
  const date = path.slice(CHANGELOG_DIR.length, CHANGELOG_DIR.length + 10);
  if (!realDate(date)) return [`${path}: ${date} is not a real date.`];
  if (date < window.from || date > window.to) return [`${path} is dated ${date}, outside ${window.from} to ${window.to} (UTC), the days this branch has existed. Rename it to a date in that range.`];
  const entries = entryLines(content);
  if (entries.length === 0) return [`${path} has no "- " entry. Add one describing the change.`];
  // Only entry lines are checked; surrounding prose may name the rule it describes.
  const offender = entries.find((line) => POST_MERGE.test(line));
  return offender === undefined ? [] : [
    `${path} cites a post-merge fact, which cannot be known before the owner merges: ${offender.trim().slice(0, 80)}. Describe the change instead.`,
  ];
}

export function changelogRefusals({ changed, fragments, baseHasFragment, window }: ChangelogInput): string[] {
  const history = fragments.filter((entry) => entry.status !== "added")
    .map((entry) => `${entry.path} is already on main; add a new fragment instead of changing it. Fragments are history.`);
  const added = fragments.filter((entry) => entry.status === "added");
  const invalid = added.flatMap((entry) => fragmentRefusals(entry, window));
  const shared = baseHasFragment && changed.includes(CHANGELOG)
    ? [`${CHANGELOG} is history since the switch to fragments, so this branch may not change it. Record the change in a new fragment ${FRAGMENT_NAME}.`]
    : [];
  const relevant = changed.filter((file) => file !== CHANGELOG && !file.startsWith(CHANGELOG_DIR) && !isExempt(file));
  const missing = relevant.length > 0 && !added.some((entry) => CHANGELOG_FRAGMENT_PATTERN.test(entry.path)) ? [
    changed.includes(CHANGELOG)
      ? `This branch records its change in ${CHANGELOG}; move it into a new fragment ${FRAGMENT_NAME}.`
      : `This branch changes ${relevant.length} file(s) but adds no changelog fragment. Add a new fragment ${FRAGMENT_NAME}; no follow-up PR records it later.`,
  ] : [];
  return [...history, ...invalid, ...shared, ...missing];
}

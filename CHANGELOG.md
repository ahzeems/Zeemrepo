# Changelog

Every branch adds its own entry here, under a `## YYYY-MM-DD` heading dated between the day it
started and the day it lands (UTC). Entries describe the change; they never cite
facts that only exist after the owner merges. `npm run changelog:guard` enforces this.

## 2026-10-09

- Added the change-record guards: `changelog:guard` (this file), `memory:guard` (an owning work record with labelled evidence, and an operating document for workflow changes) and `governance:check` (no declared surface, code included, asserts a rule the migration replaced). All three run in `npm run check` and share one exemption list in `scripts/lib/change-policy.ts`.
- Started this changelog at the repository root, so a code branch records its entry without a separate wiki commit.
- Hardened the guards after ECC review: entries are judged by position, work-record evidence and status must change on the same record's frontmatter, untracked files count as changes, and governance alignment scans every text file except named, reasoned exclusions, matching claims across line wraps and look-alike characters.

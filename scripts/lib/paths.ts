// Repository-relative paths shared by the guards. Each is defined once: a path defined in two
// modules can drift apart.

// At the root, not in wiki/: a code branch's entry then lives in an ordinary commit
// instead of needing a separate wiki-only commit.
export const CHANGELOG = "CHANGELOG.md";
// Per-branch changelog fragments (ADR-0027): changelog/<YYYY-MM-DD>-<slug>.md, one level deep.
export const CHANGELOG_DIR = "changelog/";
export const CHANGELOG_FRAGMENT_PATTERN = new RegExp(String.raw`^${CHANGELOG_DIR}\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$`);
export const WIKI_DIR = "wiki/";
export const WORK_DIR = "wiki/work/";
export const CONFIG_DIR = "config/";
// Read by the wiki linter: the tag and agent allowlists live between marker comments here.
export const WIKI_SCHEMA = ".claude/skills/wiki-memory/references/note-schema.md";

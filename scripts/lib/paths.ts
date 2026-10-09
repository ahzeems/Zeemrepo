// Repository-relative paths shared by the guards. Each is defined once (Zimi defined the
// changelog path in two modules, which is how they drifted apart).

// At the root, not in wiki/: a code branch's entry then lives in an ordinary commit
// instead of needing a separate wiki-only commit.
export const CHANGELOG = "CHANGELOG.md";
export const WIKI_DIR = "wiki/";
export const WORK_DIR = "wiki/work/";
export const CONFIG_DIR = "config/";
// Read by the wiki linter: the tag and agent allowlists live between marker comments here.
export const WIKI_SCHEMA = ".claude/skills/wiki-memory/references/note-schema.md";

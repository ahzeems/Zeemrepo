// Work-record evidence labels (.claude/rules/zeem/evidence-and-review.md): one definition for the
// wiki linter and the change-record guards.
export const EVIDENCE_LABEL = /^(VERIFIED|INFERRED|UNKNOWN|OWNER DECISION): \S/;
// Evidence that establishes something: what was run or read, or what the owner said.
export const STRONG_EVIDENCE = /^(VERIFIED|OWNER DECISION): \S/;

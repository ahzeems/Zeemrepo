# MergeFork skill-provenance reconciliation

When the `software_testing` fork merged into Zeemrepo on the `MergeFork` branch, four imported
skills carried a landed revision history on main and a separate inventory history on the fork:
`manage-branch`, `plan-tickets`, `resolve-conflicts` and `write-plan`.

The owner's decision for the merge was to keep the fork's skill content and reconcile provenance
rather than drop either side's history:

> Keep fork's skill content; merge both revision histories + record the merge as a new approved revision

and, authorizing it to proceed:

> Do the alignment proceed

Each of the four skills therefore keeps main's landed `revisions` unchanged (they are append-only
history) and gains an inventory in `.claude/skills/import-baseline.json`:

- a first `migration-baseline` inventory that records `SKILL.md` at main's last landed revision hash,
  tying the inventory model to the committed provenance chain; and
- a new inventory revision that records `SKILL.md` at the fork's content hash, the version installed
  after the merge.

This record is the approval for both inventory entries of `manage-branch`, `plan-tickets`,
`resolve-conflicts` and `write-plan`.

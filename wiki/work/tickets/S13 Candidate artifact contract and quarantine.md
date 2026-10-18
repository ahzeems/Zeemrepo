---
type: ticket
title: S13 Candidate artifact contract and quarantine
summary: Validate candidate manifests and explicit-ref bundles as untrusted data without activating candidate code or importing guest Git metadata.
tags: [area/git, area/agents, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: opencode
status: done
owner: agent
priority: P1
next_action: Independent re-review of the new pinned head; at merge the owner confirms or changes the agent-chosen limits (64 KiB manifest, 64 MiB bundle, 1 MiB recovery data, 16 prerequisites, 64 MiB GIT_ALLOC_LIMIT, a 120 s deadline per quarantine Git command, a 16 MiB gitOutputBytes cap per command); S14 then produces these artifacts and S15 verifies the quarantined candidate.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S02 Explicit-checkout command routing]]", "[[S03 Fresh pinned main revisions]]"]
related: ["[[Establish a feasible isolated Sandcastle handoff]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S13, finding A01 and its S02/S03 prerequisites."
  - "OWNER DECISION: job-spec approval is PR 17, merged by the code owner; the owner confirmed it on 2026-10-17 (\"ive merged it\"). gh pr view 17 on 2026-10-18 reported MERGED, merged by the owner's account."
  - "VERIFIED: parents landed: S02 as PR 21 (5d56a42) and S03 as PR 25 (4b64bcc), both MERGED by the owner's account per gh pr view on 2026-10-18, and both tickets are status done on main; this branch starts from origin/main c0f2e48."
  - "VERIFIED: at red commit 9e4e7e6 (tests, the artifact fixture and type-only stubs, needed because the pre-commit hook runs lint and typecheck) node --test on artifact.test.ts and quarantine.test.ts failed 58 of 58, each leaf with Error not implemented after the real fixture repositories and bundles were built."
  - "VERIFIED: at 5958eb2 the same two files passed 59 of 59; a6f023b added a tree-with-.git case and e4464cd moved the host-config probe inside the fixture-env rule. At e4464cd npm run check:base exited 0 with 968 of 968 tests and 60 evals tests; coverage of artifact.ts is 98.51% lines and 90.07% branches, of quarantine.ts 100% lines and 80.52% branches."
  - "VERIFIED: a full and an incremental bundle exported from a guest repository were accepted with the exact advertised SHA, its parent the base, in a bare repository whose refs/heads and refs/tags are empty; the CLI run as a real process exited 0 for both and 1 for a version 2 manifest, naming the kept quarantine directory."
  - "VERIFIED: each broken control refuses in its own test: version, repository, task, base, ref, short SHA, unknown keys (command, bundle.file, verified), a claim for verify, an unknown claim outcome, malformed JSON, oversized manifest, bundle and recovery data, too many prerequisites, digest mismatch, undescribed or missing recovery data, a header with another SHA, an extra or only another ref, unlisted prerequisites, filter and sha256 capabilities, symlinked files and directory, .git, hooks and config entries, a traversal-like name, a newline name, an executable or missing bundle, a candidate off the base, equal to the base, a prerequisite outside the base, a base the source lacks, a corrupt pack and a tree with a .git entry."
  - "VERIFIED: a guest with a planted core.fsmonitor, three .git/hooks and tracked executable .githooks files, plus a manifest command, left the host marker directory empty through a refused and an accepted quarantine; afterwards git status and update-ref in the guest fired the fsmonitor and hook markers, and update-ref with core.hooksPath=.githooks fired the tracked hook, so the probes were armed. The tracked hook reached quarantine only as a blob, and the quarantine directory held only candidate.bundle, candidate.json and repo.git."
  - "VERIFIED: corrected on 2026-10-18. This session's first mutation run at 5958eb2 planted 22 mutations and 20 failed tests, but that set was incomplete. The earlier claim that only two survived (core.hooksPath=/dev/null and O_NOFOLLOW) was wrong: the independent review found more survivors that this run had not planted, among them the commit-type check, the v3-only object-format rule, GIT_CONFIG_NOSYSTEM, the 64 KiB header bound and the size-limit boundary."
  - "INFERRED: the coordinator relayed the independent verifier's report on b657802, not reproduced here except where a VERIFIED line says so. It rated it FAIL: HIGH H1, a delta bomb (243 bytes peaked at 267 MB RSS, 257 bytes at 1.05 GB in 8.2 s, before a bad object refusal; GIT_ALLOC_LIMIT=64m stopped a 512 MiB bomb at 5 MB); MEDIUM M1, the untested commit-type check (removing it accepted a branch line naming an annotated tag); LOW L1, unescaped control characters in refusal text; L2, a FIFO swapped in after lstat could hang the tool; L3, an unreadable manifest exited 2, and mutants M08, M09, M10 and M22 survived."
  - "VERIFIED: H1 reproduced at 8461064: a 262-byte bundle (a 64 KiB blob and one delta of 3072 copy instructions, 192 MiB) gave a max RSS of 197 MiB under /usr/bin/time -v and the refusal fatal bad object. With GIT_ALLOC_LIMIT=64m and pack.threads=1 at 4e3a4de, it and a 276-byte 1 GiB bomb were refused with attempting to allocate ... over limit 67108864, and the run's max RSS was 85 MiB, the Node CLI itself."
  - "VERIFIED: at red commit 8461064, node --test on the two test files failed 11 of 71: the bomb case (it got bad object, not the allocation limit), the environment case (no GIT_ALLOC_LIMIT), five escaping cases, the unreadable manifest (EACCES thrown) and their parents. The tag, FIFO, v2 object-format, 64 KiB header and exact-limit cases already passed; they pin guards that mutations removed unnoticed. At 4e3a4de the two files pass 71 of 71."
  - "VERIFIED: a second mutation run at 4e3a4de planted 34 mutations: 30 failed the suite, including removing the allocation limit, the commit-type check, escaping, the fstat isFile check, the EACCES refusal, O_NOFOLLOW, GIT_CONFIG_NOSYSTEM, the v3-only object-format rule, the header bound and turning > into >= at the size limit. Removing O_NONBLOCK hangs the FIFO case, so the suite never finishes (timeout exit 124). Four survived: core.hooksPath=/dev/null, core.fsmonitor=false and pack.threads=1 (no input reaches them: a bare repository from an empty template has no hooks or index, and one delta resolves on one thread anyway), and escaping Git's stderr line (no test makes Git print a control character)."
  - "INFERRED: the owner did not set the limits (manifest 64 KiB, bundle 64 MiB, recovery 1 MiB, 16 prerequisites, GIT_ALLOC_LIMIT 64 MiB, a 120 s deadline per quarantine Git command, a 16 MiB gitOutputBytes cap per command), the accepted types (v2 or v3 SHA-1 bundles with one refs/heads ref, opaque recovery bytes) or the claim vocabulary. They are the agent's choice, offered for review. The owner should confirm or change them at merge. The human checkpoint asks before widening them, and nothing here widens them."
  - "INFERRED: per the coordinator's relay of the second independent verifier report, not reproduced here except where a VERIFIED line says so, 960257c rated PASS with every earlier finding fixed and memory bounded for single, wide and chain bombs. It raised MEDIUM M-NEW-1 (a spawnSync timeout killed only the fetch, leaving index-pack orphaned under PID 1; a 3,419-byte bundle of 60 deltas of 48 MiB reproduced it) and LOWs L-NEW-1 (bidi and format characters printed raw), L-NEW-2 (any node at an artifact name was opened before fstat rejected it) and L-NEW-3 (the duplicate-ref refusal untested)."
  - "VERIFIED: at red commit 0bc5ec5 the two test files failed 10 of 74: a 60-delta bundle (each delta up to 48 MiB) given a 1000 ms budget ran about 16 s and ended as bad object instead of a timeout refusal; five escaping cases printed U+202E and other format characters raw; and a FIFO with a waiting writer was opened, so the writer's marker appeared; plus their parents. The duplicate-ref case already passed and pins a refusal a mutation removed unnoticed."
  - "VERIFIED: at 95fbd37 the two files pass 74 of 74; the timeout case takes about 1.8 s, is refused with 'Git did not finish fetch within 1000 ms; its process group was killed', keeps its quarantine directory, and no process whose environment names that directory remains (read from /proc)."
  - "VERIFIED: a third mutation run at 95fbd37 planted 40 mutations and 33 failed the suite, including killing only the fetch instead of its process group (the orphan check fails), dropping the timeout refusal or the deadline, narrowing the escape to controls only, removing the lstat pre-check (the FIFO writer's marker appears) and removing the duplicate-ref refusal, plus every earlier named mutation. Seven survive: the fstat isFile re-check, O_NOFOLLOW and O_NONBLOCK, which now guard only a swap between lstat and open that no test drives; core.hooksPath, core.fsmonitor and pack.threads, which no input reaches; and escaping Git's own stderr line."
  - "VERIFIED: six fixture directories (/tmp/artifact-host-*, artifact-guest-*, artifact-out-*) left by this session's hung O_NONBLOCK mutation runs at 11:54 and 12:03 were deleted on 2026-10-18; a seventh from 12:22 was not from those runs and was gone after the restart. The fixture now also removes its directories on process exit and on SIGTERM or SIGINT; a process stuck in a blocking system call still leaks them."
  - "UNKNOWN: whether the session restart interrupted anything else; the crash left one mutation (the commit-type check) in quarantine.ts, which was restored before testing, and the new mutation runner keeps backups so a killed run is restored next time."
  - "INFERRED: per the coordinator's relay of the third independent verifier report, a4c30ed rated PASS with every earlier finding fixed. It raised L-1 (the slow-import case leaves an orphaned index-pack when it fails), L-2 (the group kill had no ESRCH guard, so a stop after the group emptied could throw out of a callback and leave the promise unsettled) and an observation that output over the cap exited 2. It also noted that a verifier's process kill interrupted another session's commit; this session kills only processes it started, by exact PID."
  - "VERIFIED: at red commit af7152d the two test files failed 2 of 76: a kill reporting ESRCH escaped as an uncaught 'kill ESRCH', and output over a 1-byte cap threw 'git bundle wrote more than 1 bytes' instead of refusing. At 3e5b576 they pass 76 of 76."
  - "VERIFIED: mutants at 3e5b576, quarantine.test.ts only. Removing the ESRCH guard fails a test, whether ESRCH becomes a rejection or the kill throws out of the callback. Making overflow a plain Error again fails a test, and so does killing only the fetch instead of its group. Not caught at the time: undoing the late-stop settlement, and removing the slow-import case's t.after cleanup. Under the kill-only-the-fetch mutant, polling after the test file's run found no index-pack left, with or without the cleanup, so the cleanup could not be shown to matter on this machine."
  - "INFERRED: output over the cap is a refusal (exit 1) rather than a tool failure, because candidate content drives what Git prints, in the same way as the deadline."
  - "INFERRED: per the coordinator's relay of the fourth independent verifier report, 6efa5c9 passed every code check but FAILED on the records. F1: the owner-confirmation list here and in the PR body left out the 120 s deadline and the 16 MiB output cap. F2: the reason given above for the late-stop mutant was wrong. Removing either settlement half alone is equivalent, removing both was caught in 9 of 9 of its runs, and late output did occur in 1 of 40. It also reported the output-cap boundary untested, the runGit comment overstating when results settle, and the feature-map row missing these refusals."
  - "VERIFIED: correction to the round-three mutant line. Late output was reachable but not forced. At 6bdab3c a shell alias that backgrounds its output and exits forces it, and the case rejects in about 0.3 s. With both settlement halves removed (the exit-side fail and close's re-report) it ended 'Promise resolution is still pending' in 3 of 3 runs; removing either half alone survived 3 of 3, an equivalent mutant since each covers the path alone. An exact-boundary case keeps output at the cap and refuses one byte over; turning > into >= failed it in 3 of 3 runs. Both new cases pass against the current code."
  - "INFERRED: the deadline does not bound a group member that outlives git and holds its pipes, because git's exit clears the timer and an unstopped command settles on close. Only aliases or hooks could start such a member, and quarantine's trusted config and empty-template repository have neither, so candidate content cannot reach it; the runGit comment now says so (15f6a02)."
  - "VERIFIED: the required check at cee4538 (run 39133561433) failed one S13 case, 'kill EPERM: Missing expected rejection'. Under a 0 ms deadline, git version exited before the timer fired, so the injected kill never ran. At 982b4d9 the ESRCH and EPERM cases run a shell alias that sleeps 0.5 s under a 50 ms deadline, so the timer always fires first. The case passed 3 of 3 runs locally, and removing the ESRCH guard still fails it, both as a rejection and as a throw out of the callback."
  - "UNKNOWN: no real disposable run has produced an artifact yet (S14); receipts (S15) and publication (S16) are out of scope. Re-review of the new head is pending."
---

## Goal

Accept only bounded, identity-consistent candidate artifacts into quarantine, without trusting guest success claims.

## Inputs

- Plan S13 and the target execution/evidence contract; read the Git-bundle experiment in the research ticket.
- Landed checkout routing and fresh-main contracts; `scripts/test-support/repo-fixture.ts` and shared CLI/record helpers.

## Approach

1. Define the versioned candidate manifest and explicit allowed refs around pinned repository/base/task/candidate identities.
2. Validate artifact types, limits, prerequisites and object identities in fresh repositories with trusted configuration.
3. Keep candidate phase claims and unfinished-work recovery data distinct from authoritative verification and publishable refs.

## Acceptance criteria

- [x] A valid full/incremental candidate preserves its exact SHA and expected ancestry.
- [x] Wrong version/ref/base/candidate, missing prerequisites, malformed or oversized data and unsafe file types refuse.
- [x] No guest Git configuration, hook metadata or manifest command executes on the host.
- [x] Tracked hook/script files remain untrusted candidate content; no candidate checkout is performed by validation.
- [x] Recovery data is bounded and never restored into the host working checkout; builder success labels confer no publication authority.

## Out of scope

Running agents, issuing verifier receipts, publication or treating a bundle as a backup of uncommitted work.

## Allowed files

- New `scripts/sandcastle/artifact*.ts` and `scripts/sandcastle/quarantine*.ts` modules with sibling tests.
- Bounded fixture support under `scripts/test-support/artifact-*.ts`; generated bundles stay in disposable directories.
- `package.json` only for an actually used validation CLI, `.claude/skills/verify-work/references/feature-map.md`, `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; no real candidate checkout, host Git configuration, credentials or publishing endpoints.

## Human checkpoints

Verify job approval and both parent landings. Ask before widening accepted artifact/ref types or adding a dependency; limits and trust boundaries must be explicit in review.

## Secrets needed

None. Artifacts must not carry runtime credentials or private environment values.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run check`; exercise any new validation CLI through valid/broken fixtures.
- Positive: exact-SHA full and prerequisite-satisfied incremental bundles.
- Broken: each identity/format/limit failure independently, symlinks and traversal-like artifact names, unexpected refs, embedded executable metadata and forged phase labels. Assert no host-side sentinel execution or checked-out candidate files.

## Rollback and recovery

Keep rejected artifacts quarantined for bounded diagnostics and remove only owned temporary state. Never import or execute a rejected artifact to recover from validation failure.

## Evidence

Record manifest/version controls, advertised/imported SHAs, prerequisite/ref checks, sentinel results and independent review.

## Wiki and doc updates

Document the implemented artifact and rejection contract, including recovery-data limits and what it does not certify.

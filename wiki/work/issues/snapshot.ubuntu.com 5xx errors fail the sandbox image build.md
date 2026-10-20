---
type: issue
title: snapshot.ubuntu.com 5xx errors fail the sandbox image build
summary: Four of 74 CI sandbox image builds failed in the apt step on 500, 502 and 503 from snapshot.ubuntu.com, in two short windows on 2026-10-19; the fix awaits the owner.
tags: [area/github, area/agents]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: blocked
owner: human
priority: P2
issue_kind: environment
blocker: The owner decides whether and how to fix it (OWNER DECISION, 2026-10-19, quoted in evidence); no agent picks a fix until then.
next_action: Owner decides whether and how to fix. Until then, a CI failure from the mirror is reported, not investigated further.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
related: ["[[S12 Reproducible runtime and real containment control]]", "[[Docker-capable containment proof is unavailable locally]]"]
evidence:
  - "VERIFIED: the research logs (89 CI build job logs, 2026-10-18 12:13 to 2026-10-19 13:22 UTC, read 2026-10-19) hold 74 sandbox image builds that use the snapshot; the other 15 ran on commits from before the snapshot was pinned (they ran 2026-10-18 12:16 to 17:44 UTC, interleaved in time with the snapshot builds). 4 of the 74 failed, all in the apt step (Dockerfile step 7)."
  - "VERIFIED: the four failures are run 39240784367 attempts 1 and 2 (PR 59, a2f7749), run 39257813038 attempt 1 (PR 61, ed3692b) and run 39258525229 attempt 1 (PR 62, e33b1b9). Each log ends in 'E: Failed to fetch' with 500 Internal Server Error, 502 or 503 Service Unavailable from 185.125.189.36, .37 or .69. No log of the 89 contains an HTTP 429."
  - "VERIFIED: the apt Ign and Err lines of the failures fall in two windows on 2026-10-19, 10:59 to 11:06 UTC and 13:13 to 13:20 UTC. Builds that passed in or just after those windows took 133 to 336 s in the apt step, against a median of 37 s (26 to 50 s) over the 36 builds of 2026-10-18, so about 4 to 9 times slower; their median gap between downloads rose from about 0.2 s to 1.7 to 3.4 s. Only 39241305832 ran its apt step inside a window (11:00:46 to 11:04:33); 39242211449 (11:08:02 to 11:13:37) and the two reruns (13:21:37 to 13:23:50 and 13:22:35 to 13:25:22) ran after them, so the slowdown outlasted the 5xx errors."
  - "VERIFIED: 0 of 36 builds failed on 2026-10-18; on 2026-10-19, 4 of 38 failed. The reruns of PR 61 and PR 62 (39257813038 and 39258525229 attempt 2, jobs started 13:19:51 and 13:20:41 UTC) built the image. PR 59's own rerun (attempt 2) fell in the first window and failed too; the research data holds no third attempt of that run."
  - "VERIFIED: run 39241305832 (PR 60, 10:58 UTC) also failed in the same CI step, but its image build passed and the job failed on a test assertion; it is not one of the four mirror failures."
  - "VERIFIED: a passing build fetches 63 files totalling 62.6 MB (24.7 MB, 1381 kB and 36.5 MB in three apt Fetched lines) from the snapshot, with no cache between builds."
  - "VERIFIED: apt upstream main (acquire-item.cc and acquire-worker.cc from salsa.debian.org, read 2026-10-19) defaults Acquire::Retries to 3 with a backoff of 1, 2 and 4 s capped at 30 s; it adds a Retry-After wait only for 429 Too Many Requests. INFERRED: with download time, a file's retries span 13 to 37 s in the logs (one span checked by hand: 18 s, Err:12 in run 39257813038), far shorter than the 7-minute episodes. UNKNOWN: whether the apt in the Ubuntu 26.04 image matches upstream main."
  - "VERIFIED: probes from the authoring machine at 13:31 to 13:32 UTC on 2026-10-19 got HTTP 200 from all three IPs; responses carry an x-cache-status header from content-cache/0, /1 or /2 (HIT and MISS)."
  - "VERIFIED: the copy of https://snapshot.ubuntu.com/ fetched 2026-10-19 contains no rate limit, SLA or status page link (searched for rate, limit, SLA and status)."
  - "INFERRED: https://discourse.ubuntu.com/t/new-feature-ubuntu-snapshot-service/44321, Canonical's announcement of the service, was read during the research on 2026-10-19 and is the primary source on its purpose; this note's author did not reread it."
  - "INFERRED: the best-supported cause is intermittent server-side errors or overload at Canonical's snapshot service: 5xx not 429, three IPs at once, short windows across three PRs, slow passing builds in the same minutes, and clean reruns. A Discourse thread on snapshot 503s in July 2026 is a lead only, not a source."
  - "UNKNOWN: whether GitHub runner IP ranges are targeted or throttled. Settling it needs the headers and body of one failing response captured on the runner, and the same URL fetched from outside GitHub in the same minute."
  - "OWNER DECISION: on 2026-10-19, in reply to the coordinator's question on what to do, the owner wrote: \"lets not keep trying this snapshot which is failing, lets move on and we can keep this a an issue pending\"."
  - "OWNER DECISION: on 2026-10-19, in the same reply (relayed by the coordinator), the owner wrote: \"i didnt know we even have docker installed on the local machine\". This is an owner statement quoted for context; it decides nothing."
  - "VERIFIED: command -v docker exits 1 on the authoring machine (2026-10-19). The image build and container controls run only on GitHub's runners: .github/workflows/check.yml runs the check job on ubuntu-latest and its npm run sandbox:smoke step builds and runs the image."
---

## Reproduction

Not reproducible on demand. Watch the required CI `check` job build `.sandcastle/Dockerfile`. When
snapshot.ubuntu.com has an episode, the `apt-get install` step logs `Ign:` and `Err:` lines with 500,
502 or 503 and ends with `E: Failed to fetch`. A rerun after the episode passes.

## Expected and actual

Expected: the image build installs the pinned packages from the dated snapshot every time.

Actual: 4 of 74 builds failed between 2026-10-18 12:13 and 2026-10-19 13:22 UTC, all on 2026-10-19
in two windows of about seven minutes. Builds that passed in or just after those windows were 4 to 9 times
slower, and the slowdown outlasted the 5xx errors.

## Root cause

Not established. The evidence points to intermittent server-side errors at the snapshot service
rather than rate limiting of the runners, because no response was a 429. A rerun inside the same
episode can fail as well (PR 59 failed twice). Whether runner IPs are
treated differently is unknown.

## Fix

None chosen. The owner decides whether and how to fix it. Options considered, without a
recommendation:

- Longer apt retries in the Dockerfile (`Acquire::Retries` and its delay maximum), so one file can
  wait out an episode of several minutes.
- One delayed retry of the whole image build in CI.
- Log the headers and body of a failing response on the runner, to settle the cause first.
- Cache the built image between runs. This changes CI infrastructure and needs owner authorization.
- Fall back to the live archive on failure. This breaks the pinned snapshot that S12 relies on for
  reproducible builds.

## Verification

When a fix lands, record the head SHA, the CI run and the apt step's result. A single green build is
weak evidence, since 70 of 74 builds passed without a fix.

## Prevention

none: no check can stop an outside mirror from failing. The manual control is to report a CI
failure from the mirror, with its run link, instead of investigating again.

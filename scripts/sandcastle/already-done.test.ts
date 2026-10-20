import assert from "node:assert/strict";
import { test } from "node:test";
import { createRepo } from "../test-support/repo-fixture.ts";
import { appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { aheadIssues, branchWork, pendingIssues } from "./already-done.ts";

const issue = (id: string): { id: string; title: string; branch: string } =>
  ({ id, title: `Issue ${id}`, branch: `sandcastle/issue-${id}` });

await test("pendingIssues drops an issue whose branch is merged into HEAD and keeps the rest", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-1"]);
    repo.write("one.txt", "1");
    repo.commit("feat: one");
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["merge", "--quiet", "--no-ff", "--no-edit", "sandcastle/issue-1"]);
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-2"]);
    repo.write("two.txt", "2");
    repo.commit("feat: two");
    repo.git(["switch", "--quiet", "main"]);
    const planned = [issue("1"), issue("2"), issue("3")];
    assert.deepEqual(pendingIssues(planned, repo.dir).map((entry) => entry.id), ["2", "3"]);
  } finally {
    repo.cleanup();
  }
});

await test("pendingIssues keeps an issue whose branch does not exist, even when a tag has that name", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["tag", "sandcastle/issue-4"]);
    assert.deepEqual(pendingIssues([issue("4")], repo.dir), [issue("4")]);
  } finally {
    repo.cleanup();
  }
});

await test("pendingIssues keeps a branch that is ahead of HEAD or diverged from it", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-5"]);
    repo.write("five.txt", "5");
    repo.commit("feat: five");
    repo.git(["switch", "--quiet", "main"]);
    repo.write("main.txt", "m");
    repo.commit("chore: main moves on");
    assert.deepEqual(pendingIssues([issue("5")], repo.dir), [issue("5")]);
  } finally {
    repo.cleanup();
  }
});

await test("pendingIssues keeps an issue whose branch name looks like an option, without reading it as one", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    const planned = [{ id: "6", title: "Odd", branch: "--all" }];
    assert.deepEqual(pendingIssues(planned, repo.dir), planned);
  } finally {
    repo.cleanup();
  }
});

await test("pendingIssues keeps a branch that was created at HEAD and never got a commit", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["branch", "sandcastle/issue-8"]);
    assert.deepEqual(pendingIssues([issue("8")], repo.dir), [issue("8")], "same commit as HEAD");
    repo.write("later.txt", "l");
    repo.commit("chore: HEAD moves on");
    assert.deepEqual(pendingIssues([issue("8")], repo.dir), [issue("8")], "an ancestor of HEAD");
  } finally {
    repo.cleanup();
  }
});

await test("pendingIssues keeps a branch whose only reflog entries are a reset, not a commit", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["branch", "sandcastle/issue-10"]);
    repo.write("later.txt", "l");
    repo.commit("chore: HEAD moves on");
    repo.git(["branch", "--force", "sandcastle/issue-10", "HEAD"]);
    assert.deepEqual(pendingIssues([issue("10")], repo.dir), [issue("10")]);
  } finally {
    repo.cleanup();
  }
});

await test("pendingIssues keeps an empty branch that only fast-forwarded to a later HEAD or was renamed", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["branch", "sandcastle/issue-11"]);
    repo.write("later.txt", "l");
    repo.commit("chore: HEAD moves on");
    repo.git(["switch", "--quiet", "sandcastle/issue-11"]);
    repo.git(["merge", "--quiet", "--ff-only", "main"]);
    repo.git(["switch", "--quiet", "main"]);
    assert.deepEqual(pendingIssues([issue("11")], repo.dir), [issue("11")], "a fast-forward merge is not work");
    repo.git(["branch", "--move", "sandcastle/issue-11", "sandcastle/issue-12"]);
    assert.deepEqual(pendingIssues([issue("12")], repo.dir), [issue("12")], "a rename is not work");
  } finally {
    repo.cleanup();
  }
});

await test("pendingIssues drops a branch whose commits were fast-forwarded into HEAD", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-9"]);
    repo.write("nine.txt", "9");
    repo.commit("feat: nine");
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["merge", "--quiet", "--ff-only", "sandcastle/issue-9"]);
    assert.deepEqual(pendingIssues([issue("9")], repo.dir), []);
  } finally {
    repo.cleanup();
  }
});

await test("pendingIssues keeps a branch an agent reset back to where it started", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-13"]);
    repo.write("thirteen.txt", "13");
    repo.commit("feat: thirteen");
    repo.git(["reset", "--quiet", "--hard", "main"]);
    repo.git(["switch", "--quiet", "main"]);
    assert.deepEqual(pendingIssues([issue("13")], repo.dir), [issue("13")]);
  } finally {
    repo.cleanup();
  }
});

await test("pendingIssues counts a cherry-picked commit and a revert that made content as the branch's own", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "elsewhere"]);
    repo.write("picked.txt", "p");
    const picked = repo.commit("feat: picked");
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-14"]);
    repo.git(["cherry-pick", picked]);
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["merge", "--quiet", "--no-ff", "--no-edit", "sandcastle/issue-14"]);
    assert.deepEqual(pendingIssues([issue("14")], repo.dir), []);
  } finally {
    repo.cleanup();
  }
});

await test("pendingIssues keeps a branch whose reflog is gone", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-16"]);
    repo.write("sixteen.txt", "16");
    repo.commit("feat: sixteen");
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["merge", "--quiet", "--ff-only", "sandcastle/issue-16"]);
    rmSync(join(repo.dir, ".git", "logs", "refs", "heads", "sandcastle", "issue-16"));
    assert.deepEqual(pendingIssues([issue("16")], repo.dir), [issue("16")]);
  } finally {
    repo.cleanup();
  }
});

await test("aheadIssues lists the planned branches that hold commits of their own not yet in HEAD", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-17"]);
    repo.write("seventeen.txt", "17");
    repo.commit("feat: seventeen");
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["branch", "sandcastle/issue-18"]);
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-19"]);
    repo.write("nineteen.txt", "19");
    repo.commit("feat: nineteen");
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["merge", "--quiet", "--no-ff", "--no-edit", "sandcastle/issue-19"]);
    const planned = [issue("17"), issue("18"), issue("19"), issue("20")];
    assert.deepEqual(aheadIssues(planned, repo.dir).map((entry) => entry.id), ["17"]);
  } finally {
    repo.cleanup();
  }
});

await test("pendingIssues keeps a branch reset to a commit HEAD already contains, after it committed", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-21"]);
    repo.write("twenty-one.txt", "21");
    repo.commit("feat: twenty-one");
    repo.git(["switch", "--quiet", "main"]);
    repo.write("later.txt", "l");
    repo.commit("chore: HEAD moves on");
    repo.git(["switch", "--quiet", "sandcastle/issue-21"]);
    repo.git(["reset", "--quiet", "--hard", "main"]);
    repo.git(["switch", "--quiet", "main"]);
    assert.deepEqual(pendingIssues([issue("21")], repo.dir), [issue("21")]);
    assert.equal(branchWork("refs/heads/sandcastle/issue-21", repo.dir), "empty");
  } finally {
    repo.cleanup();
  }
});

await test("branchWork tells worked, untouched and unrecognised branches apart", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["branch", "sandcastle/issue-30"]);
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-31"]);
    repo.write("thirty-one.txt", "31");
    repo.commit("feat: thirty-one");
    repo.git(["switch", "--quiet", "main"]);
    repo.write("later.txt", "l");
    const moved = repo.commit("chore: HEAD moves on");
    repo.git(["update-ref", "refs/heads/sandcastle/issue-32", moved]);
    assert.equal(branchWork("refs/heads/sandcastle/issue-30", repo.dir), "empty");
    assert.equal(branchWork("refs/heads/sandcastle/issue-31", repo.dir), "worked");
    assert.equal(branchWork("refs/heads/sandcastle/issue-32", repo.dir), "unrecognised");
    assert.equal(branchWork("refs/heads/sandcastle/issue-99", repo.dir), "empty", "a missing branch has no work");
  } finally {
    repo.cleanup();
  }
});

await test("an amended branch still counts as worked", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-41", "main"]);
    repo.write("forty-one.txt", "41");
    repo.commit("feat: forty-one");
    repo.git(["commit", "--quiet", "--amend", "-m", "feat: forty-one, reworded"]);
    repo.git(["switch", "--quiet", "main"]);
    assert.equal(branchWork("refs/heads/sandcastle/issue-41", repo.dir), "worked");
  } finally {
    repo.cleanup();
  }
});

await test("a rebased branch is not recognised as worked, but it is kept pending and surfaced to the merger", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-40"]);
    repo.write("forty.txt", "40");
    repo.commit("feat: forty");
    repo.git(["switch", "--quiet", "main"]);
    repo.write("later.txt", "l");
    repo.commit("chore: HEAD moves on");
    repo.git(["switch", "--quiet", "sandcastle/issue-40"]);
    repo.git(["rebase", "--quiet", "main"]);
    repo.git(["switch", "--quiet", "main"]);
    assert.equal(branchWork("refs/heads/sandcastle/issue-40", repo.dir), "unrecognised");
    assert.deepEqual(pendingIssues([issue("40")], repo.dir).map((entry) => entry.id), ["40"]);
    assert.deepEqual(aheadIssues([issue("40")], repo.dir).map((entry) => entry.id), ["40"]);
  } finally {
    repo.cleanup();
  }
});

await test("a reset and a rebase in either order never make discarded work count", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-44"]);
    repo.write("forty-four.txt", "44");
    repo.commit("feat: forty-four");
    repo.git(["switch", "--quiet", "main"]);
    repo.write("later.txt", "l");
    repo.commit("chore: HEAD moves on");
    repo.git(["branch", "sandcastle/issue-45", "sandcastle/issue-44"]);
    // A: commit, rebase onto the moved main, then reset to main
    repo.git(["switch", "--quiet", "sandcastle/issue-44"]);
    repo.git(["rebase", "--quiet", "main"]);
    repo.git(["reset", "--quiet", "--hard", "main"]);
    // B: commit, reset to main, then a fast-forward rebase onto main
    repo.git(["switch", "--quiet", "sandcastle/issue-45"]);
    repo.git(["reset", "--quiet", "--hard", "main"]);
    repo.git(["rebase", "--quiet", "main"]);
    repo.git(["switch", "--quiet", "main"]);
    assert.deepEqual(pendingIssues([issue("44"), issue("45")], repo.dir).map((entry) => entry.id), ["44", "45"]);
  } finally {
    repo.cleanup();
  }
});

await test("a branch ahead of HEAD whose own commits are unreachable, or that merged another branch, is surfaced", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "elsewhere"]);
    repo.write("elsewhere.txt", "e");
    const ahead = repo.commit("feat: real work not in HEAD");
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-46"]);
    repo.write("forty-six.txt", "46");
    repo.commit("feat: forty-six");
    repo.git(["reset", "--quiet", "--hard", ahead]);
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["branch", "sandcastle/issue-47"]);
    repo.git(["switch", "--quiet", "sandcastle/issue-47"]);
    repo.git(["merge", "--quiet", "--no-ff", "--no-edit", "elsewhere"]);
    repo.git(["switch", "--quiet", "main"]);
    const ids = aheadIssues([issue("46"), issue("47")], repo.dir).map((entry) => entry.id);
    assert.deepEqual(ids, ["46", "47"]);
    assert.deepEqual(pendingIssues([issue("46"), issue("47")], repo.dir).map((entry) => entry.id), ["46", "47"]);
  } finally {
    repo.cleanup();
  }
});

await test("a reflog entry whose commit object is gone does not abort the planner", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["branch", "sandcastle/issue-42"]);
    const base = repo.git(["rev-parse", "HEAD"]);
    const missing = "1".repeat(40);
    appendFileSync(join(repo.dir, ".git", "logs", "refs", "heads", "sandcastle", "issue-42"),
      `${base} ${missing} Fixture <fixture@example.invalid> 1700000000 +0000\tcommit: a pruned commit\n`);
    assert.doesNotThrow(() => pendingIssues([issue("42")], repo.dir));
    assert.doesNotThrow(() => aheadIssues([issue("42")], repo.dir));
    assert.notEqual(branchWork("refs/heads/sandcastle/issue-42", repo.dir), "worked");
  } finally {
    repo.cleanup();
  }
});

await test("aheadIssues also lists an unrecognised branch whose tip is ahead of HEAD", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "elsewhere"]);
    repo.write("ahead.txt", "a");
    const ahead = repo.commit("feat: ahead");
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["update-ref", "refs/heads/sandcastle/issue-43", ahead]);
    assert.deepEqual(aheadIssues([issue("43")], repo.dir).map((entry) => entry.id), ["43"]);
    assert.deepEqual(pendingIssues([issue("43")], repo.dir).map((entry) => entry.id), ["43"], "still pending, never dropped");
  } finally {
    repo.cleanup();
  }
});

await test("a rebase of an empty branch onto a moved main is not work", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["branch", "sandcastle/issue-50"]);
    repo.write("later.txt", "l");
    repo.commit("chore: HEAD moves on");
    repo.git(["switch", "--quiet", "sandcastle/issue-50"]);
    repo.git(["rebase", "--quiet", "main"]);
    repo.git(["switch", "--quiet", "main"]);
    assert.equal(branchWork("refs/heads/sandcastle/issue-50", repo.dir), "empty");
    assert.deepEqual(pendingIssues([issue("50")], repo.dir).map((entry) => entry.id), ["50"]);
  } finally {
    repo.cleanup();
  }
});

await test("a branch whose only commit is a revert counts as worked", () => {
  const repo = createRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("chore: base");
    repo.write("b.txt", "b");
    repo.commit("feat: something to revert");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-51"]);
    repo.git(["revert", "--no-edit", "HEAD"]);
    repo.git(["switch", "--quiet", "main"]);
    assert.equal(branchWork("refs/heads/sandcastle/issue-51", repo.dir), "worked");
  } finally {
    repo.cleanup();
  }
});

await test("a pruned entry beside a reachable commit entry leaves the branch worked", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-52"]);
    repo.write("fifty-two.txt", "52");
    repo.commit("feat: fifty-two");
    const tip = repo.git(["rev-parse", "HEAD"]);
    appendFileSync(join(repo.dir, ".git", "logs", "refs", "heads", "sandcastle", "issue-52"),
      `${tip} ${"2".repeat(40)} Fixture <fixture@example.invalid> 1700000000 +0000\tcommit: a pruned commit\n`);
    repo.git(["switch", "--quiet", "main"]);
    assert.equal(branchWork("refs/heads/sandcastle/issue-52", repo.dir), "worked");
  } finally {
    repo.cleanup();
  }
});

await test("a fast-forward cherry-pick of a commit HEAD already holds is not work", () => {
  const repo = createRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("chore: base");
    repo.git(["branch", "sandcastle/issue-60"]);
    repo.git(["switch", "--quiet", "-c", "other"]);
    repo.write("b.txt", "b");
    repo.commit("feat: other work");
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["merge", "--quiet", "--ff-only", "other"]);
    repo.git(["switch", "--quiet", "sandcastle/issue-60"]);
    repo.git(["cherry-pick", "--ff", "other"]);
    repo.git(["switch", "--quiet", "main"]);
    assert.equal(branchWork("refs/heads/sandcastle/issue-60", repo.dir), "empty");
    assert.deepEqual(pendingIssues([issue("60")], repo.dir).map((entry) => entry.id), ["60"]);
  } finally {
    repo.cleanup();
  }
});

await test("a branch reset only part of the way back keeps its reachable commits and counts as worked", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-61"]);
    repo.write("one.txt", "1");
    repo.commit("feat: sixty-one part one");
    repo.write("two.txt", "2");
    repo.commit("feat: sixty-one part two");
    repo.git(["reset", "--quiet", "--hard", "HEAD~1"]);
    repo.git(["switch", "--quiet", "main"]);
    assert.equal(branchWork("refs/heads/sandcastle/issue-61", repo.dir), "worked");
  } finally {
    repo.cleanup();
  }
});

await test("an ahead branch whose reflog is gone is still passed to the merger", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-62"]);
    repo.write("sixty-two.txt", "62");
    repo.commit("feat: sixty-two");
    repo.git(["switch", "--quiet", "main"]);
    rmSync(join(repo.dir, ".git", "logs", "refs", "heads", "sandcastle", "issue-62"));
    assert.equal(branchWork("refs/heads/sandcastle/issue-62", repo.dir), "unrecognised");
    assert.deepEqual(aheadIssues([issue("62")], repo.dir).map((entry) => entry.id), ["62"]);
    assert.deepEqual(pendingIssues([issue("62")], repo.dir).map((entry) => entry.id), ["62"]);
  } finally {
    repo.cleanup();
  }
});

await test("an empty commit is not work, so the issue is not dropped", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-70"]);
    repo.git(["commit", "--quiet", "--allow-empty", "-m", "chore: not done, see the issue"]);
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["merge", "--quiet", "--no-ff", "--no-edit", "sandcastle/issue-70"]);
    assert.equal(branchWork("refs/heads/sandcastle/issue-70", repo.dir), "empty");
    assert.deepEqual(pendingIssues([issue("70")], repo.dir).map((entry) => entry.id), ["70"]);
  } finally {
    repo.cleanup();
  }
});

await test("a conflict resolved with git commit logs commit (merge), and the branch counts as worked through its own commit", () => {
  const repo = createRepo();
  try {
    repo.write("shared.txt", "base\n");
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "sandcastle/issue-71"]);
    repo.write("shared.txt", "branch\n");
    repo.commit("feat: change shared on the branch");
    repo.git(["switch", "--quiet", "main"]);
    repo.write("shared.txt", "main\n");
    repo.commit("chore: change shared on main");
    repo.git(["switch", "--quiet", "sandcastle/issue-71"]);
    try { repo.git(["merge", "--no-edit", "main"]); } catch { /* the conflict is the point */ }
    repo.write("shared.txt", "resolved\n");
    repo.commit("fix: resolve");
    repo.git(["switch", "--quiet", "main"]);
    const subjects = repo.git(["reflog", "show", "--format=%gs", "refs/heads/sandcastle/issue-71", "--"]);
    assert.match(subjects, /^commit \(merge\)/m);
    assert.equal(branchWork("refs/heads/sandcastle/issue-71", repo.dir), "worked");
  } finally {
    repo.cleanup();
  }
});

await test("an empty commit after the branch took up a moved main is not work, wherever main moved", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["branch", "sandcastle/issue-72"]);
    repo.write("f.txt", "f");
    repo.commit("feat: main adds f");
    repo.git(["switch", "--quiet", "sandcastle/issue-72"]);
    repo.git(["merge", "--quiet", "--ff-only", "main"]);
    repo.git(["commit", "--quiet", "--allow-empty", "-m", "chore: not done"]);
    repo.git(["switch", "--quiet", "main"]);
    assert.notEqual(branchWork("refs/heads/sandcastle/issue-72", repo.dir), "worked");
    assert.deepEqual(pendingIssues([issue("72")], repo.dir).map((entry) => entry.id), ["72"]);
    repo.git(["merge", "--quiet", "--no-ff", "--no-edit", "sandcastle/issue-72"]);
    assert.deepEqual(pendingIssues([issue("72")], repo.dir).map((entry) => entry.id), ["72"], "still pending once merged");
  } finally {
    repo.cleanup();
  }
});

await test("work that nets out against the creation tree after main moved is still passed to the merger", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["branch", "sandcastle/issue-73"]);
    repo.write("f.txt", "f");
    repo.commit("feat: main adds f");
    repo.git(["switch", "--quiet", "sandcastle/issue-73"]);
    repo.git(["merge", "--quiet", "--ff-only", "main"]);
    repo.git(["rm", "--quiet", "f.txt"]);
    repo.commit("feat: remove f, the real work for the issue");
    repo.git(["switch", "--quiet", "main"]);
    assert.equal(branchWork("refs/heads/sandcastle/issue-73", repo.dir), "worked");
    assert.deepEqual(aheadIssues([issue("73")], repo.dir).map((entry) => entry.id), ["73"]);
    assert.deepEqual(pendingIssues([issue("73")], repo.dir).map((entry) => entry.id), ["73"]);
  } finally {
    repo.cleanup();
  }
});

await test("a branch reset onto a moved main and given an empty commit is not work, and one created by fetch is only unrecognised", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["switch", "--quiet", "-c", "elsewhere"]);
    repo.write("e.txt", "e");
    const tip = repo.commit("feat: elsewhere");
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["switch", "--quiet", "-C", "sandcastle/issue-74", tip]);
    repo.git(["commit", "--quiet", "--allow-empty", "-m", "chore: not done"]);
    repo.git(["switch", "--quiet", "main"]);
    assert.notEqual(branchWork("refs/heads/sandcastle/issue-74", repo.dir), "worked");
    repo.git(["update-ref", "refs/heads/sandcastle/issue-75", tip]);
    assert.equal(branchWork("refs/heads/sandcastle/issue-75", repo.dir), "unrecognised");
  } finally {
    repo.cleanup();
  }
});

await test("a branch whose only entry is a merge of another branch is not work, and stays pending", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    repo.git(["branch", "sandcastle/issue-80"]);
    repo.git(["switch", "--quiet", "-c", "other-issue"]);
    repo.write("other.txt", "o");
    repo.commit("feat: other issue");
    repo.git(["switch", "--quiet", "sandcastle/issue-80"]);
    repo.git(["merge", "--no-commit", "--no-ff", "other-issue"]);
    repo.git(["commit", "--quiet", "-m", "chore: join the other issue"]);
    repo.git(["switch", "--quiet", "main"]);
    const subjects = repo.git(["reflog", "show", "--format=%gs", "refs/heads/sandcastle/issue-80", "--"]);
    assert.match(subjects, /^commit \(merge\)/m);
    assert.notEqual(branchWork("refs/heads/sandcastle/issue-80", repo.dir), "worked");
    assert.deepEqual(pendingIssues([issue("80")], repo.dir).map((entry) => entry.id), ["80"]);
  } finally {
    repo.cleanup();
  }
});

await test("pendingIssues refuses when the directory is not a repository", () => {
  const repo = createRepo();
  repo.cleanup();
  assert.throws(() => pendingIssues([issue("7")], repo.dir));
});

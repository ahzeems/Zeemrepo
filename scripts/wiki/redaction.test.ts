import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { createRepo } from "../test-support/repo-fixture.ts";
import { currentIdentity, findSensitive, isPersonalAccount, redactionChecks, redactionTargets } from "./redaction.ts";

const identity = { host: "build-box-7", user: "alice" };
const checks = redactionChecks(identity);
const names = (text: string): string[] => findSensitive(text, checks).map((finding) => finding.name);
// Samples are assembled at run time so this file does not trip the scan it tests.
const at = "@";

await test("findSensitive flags secrets and identifiers, naming the line, not echoing the value", async (t) => {
  const cases: [string, string, RegExp][] = [
    ["email address", `mail me at person${at}corp.io`, /email/],
    ["email at a look-alike domain", `me${at}github.com.evil.org`, /email/],
    ["email at an IP address", `bob${at}10.0.0.5`, /email/],
    ["email with a non-ASCII domain", `x${at}münchen.de`, /email/],
    ["Anthropic address other than noreply", `someone${at}anthropic.com`, /email/],
    ["GitHub token", "token " + "ghp_" + "x".repeat(30), /GitHub token/],
    ["fine-grained token", "github_pat_" + "a".repeat(30), /GitHub token/],
    ["API key", "sk-" + "b".repeat(24), /API key/],
    ["API key after an underscore", "foo_sk-" + "b".repeat(24), /API key/],
    ["AWS access key", "AKIA" + "ABCDEFGHIJKLMNOP", /AWS/],
    ["Slack token", "xoxb-" + "1234567890-abcdefghij", /Slack/],
    ["Google API key", "AIza" + "S".repeat(35), /Google/],
    ["Stripe live key", "sk_live_" + "c".repeat(24), /Stripe/],
    ["JWT", "eyJ" + "hbGciOiJIUzI1NiJ9" + ".eyJ" + "zdWIiOiIxMjM0NTY3ODkwIn0" + ".sig", /JWT/],
    ["private key", "-----BEGIN OPENSSH " + "PRIVATE KEY-----", /private key/],
    ["SSH public key", "ssh-ed25519 AAAA" + "c".repeat(30), /SSH public key/],
    ["ECDSA public key", "ecdsa-sha2-nistp256 AAAA" + "c".repeat(30), /SSH public key/],
    ["home path", "/home/" + "bob/repo", /home path/],
    ["macOS home path", "see /Users/" + "bob/repo", /macOS/],
    ["Windows path, forward slash", ["C:", "Users", "bob", "x"].join("/"), /Windows user path/],
    ["Windows path, backslash", ["C:", "Users", "bob", "x"].join("\\"), /Windows user path/],
    ["Windows path, escaped backslashes", ["C:", "Users", "bob", "x"].join("\\\\"), /Windows user path/],
    ["this machine's hostname", "ssh build-box-7", /hostname/],
    ["this machine's username", "logged in as alice", /username/],
  ];
  for (const [name, text, expected] of cases) {
    await t.test(name, () => {
      const findings = findSensitive(`clean line\n${text}\n`, checks);
      assert.equal(findings.length, 1, JSON.stringify(findings));
      assert.equal(findings[0]?.line, 2);
      assert.match(findings[0]?.name ?? "", expected);
    });
  }
});

await test("findSensitive leaves allowed placeholders and public addresses alone", () => {
  for (const text of [
    "/home/<user>/repo", "~/repo", "/home/linuxbrew/.linuxbrew", `noreply${at}github.com`,
    `91344955+someone${at}users.noreply.github.com`, `noreply${at}anthropic.com`, `fixture${at}example.invalid`,
    `a${at}example.com`, "<email>", "C:\\Users\\<windows-user>", "/Users/<user>/repo", "/Users/Shared/x",
    "risk-assessment-document-for-the-team", "the disk-usage-monitoring-dashboard-panel",
    "pin typescript@6.0.3 in CI", "npx eslint@10.11.0", "@types/node@22.20.4",
  ]) assert.deepEqual(names(text), [], text);
});

await test("a service account is not redacted as a personal identifier", () => {
  for (const account of ["node", "root", "ubuntu", "deploy", "www-data", "runner", "agent"]) {
    assert.equal(isPersonalAccount(account), false, account);
  }
  assert.equal(isPersonalAccount("alice"), true);
  assert.equal(isPersonalAccount("bob"), false, "names under four characters are too common to match");
  assert.equal(redactionChecks({ host: "ci", user: "node" }).some((check) => /machine/.test(check.name)), false);
  const hasLoginCheck = (user: string): boolean =>
    redactionChecks({ host: "ci", user }).some((check) => check.name === "this machine's username");
  assert.equal(hasLoginCheck("agent"), false);
  assert.equal(hasLoginCheck("AGENT"), false);
  assert.equal(hasLoginCheck("alice"), true);
});

await test("the role-name home agent is allowed, and every other home path is flagged for every login", () => {
  for (const user of ["agent", "node", "alice"]) {
    const flagged = (text: string): string[] =>
      findSensitive(text, redactionChecks({ host: "ci", user })).map((finding) => finding.name);
    assert.deepEqual(flagged("WORKDIR /home/" + "agent/workspace"), [], user);
    assert.deepEqual(flagged("PATH=/home/" + "agent/.local/bin"), [], user);
    assert.match(flagged("see /home/" + "agentsmith/x").join(), /home path/, user);
    assert.match(flagged("see /home/" + "agent-smith/x").join(), /home path/, user);
    assert.match(flagged("see /home/" + "alice/x").join(), /home path/, user);
    assert.match(flagged("see /home/" + "agent.evil/x").join(), /home path/, user);
    assert.match(flagged("see /home/" + "Agent/x").join(), /home path/, user);
    assert.deepEqual(flagged("cd /home/" + "agent"), [], user);
    assert.deepEqual(flagged("/home/<user>/workspace"), [], user);
  }
  const agentChecks = redactionChecks({ host: "ci", user: "agent" });
  assert.deepEqual(findSensitive("agent: claude-code", agentChecks), []);
});

await test("the role-name home does not hide this machine's own login behind a traversal", () => {
  const checks = redactionChecks({ host: "ci", user: "alice" });
  const names = findSensitive("ls /home/" + "agent/../alice/notes", checks).map((finding) => finding.name);
  assert.ok(names.includes("this machine's username"), names.join());
});

// Two role-name logins, where no login check can catch a name, and one personal login.
const RUNTIME_LOGINS = ["agent", "node", "alice"];
const homePathFindings = (text: string, user: string): string[] =>
  findSensitive(text, redactionChecks({ host: "ci", user })).map((finding) => finding.name)
    .filter((name) => /home path/.test(name));
const roleHome = "/home/" + "agent";

await test("a path that climbs out of the role-name home is flagged for every login", () => {
  const escaping = [
    `ls ${roleHome}/../bob/notes`,
    `ls ${roleHome}/../carol`,
    `cd ${roleHome}/..`,
    `cd ${roleHome}/../`,
    `ls ${roleHome}/sub/../../bob`,
    `ls ${roleHome}/a/b/../../../bob`,
    `ls ${roleHome}/./../bob`,
    `ls ${roleHome}//../bob`,
    `ls ${roleHome}/"../bob"`,
    `ls '${roleHome}/../bob'`,
    `ls ${roleHome}/../bob/../agent/x`,
    `PATH=${roleHome}/bin:${roleHome}/../bob/bin`,
    `see (${roleHome}/../bob).`,
    `ls x${roleHome}/../bob`,
    `ls ${roleHome}/x ${roleHome}/../bob`,
    `ls ${roleHome}/'..'/bob`,
    `ls ${roleHome}/\\.\\./bob`,
    `ls /var${roleHome}/../bob`,
    `ls /srv${roleHome}/x/../../bob`,
    `cd ${roleHome}/..&&ls`,
    `cd ${roleHome}/..&`,
    `cd ${roleHome}/.. && ls`,
    `see ${roleHome}/.. and so on`,
    `see ${roleHome}/.., then x`,
    `see (${roleHome}/..) here`,
  ];
  for (const user of RUNTIME_LOGINS) {
    for (const text of escaping) assert.deepEqual(homePathFindings(text, user), ["home path with username (use ~ or /home/<user>)"], `${user}: ${text}`);
  }
});

await test("look-alike and other homes are flagged for every login", () => {
  for (const user of RUNTIME_LOGINS) {
    for (const home of ["agentsmith", "agent-smith", "agent.evil", "agent_x", "Agent", "AGENT", "agent.", "bob", "carol"]) {
      assert.equal(homePathFindings(`see /home/${home}/x`, user).length, 1, `${user}: ${home}`);
    }
  }
});

await test("quotes and backslashes do not hide a look-alike home", () => {
  const joined = [
    `ls ${roleHome}"smith"/x`,
    `ls ${roleHome}'smith'/x`,
    `ls ${roleHome}\\smith/x`,
    `ls ${roleHome}\\..\\bob`,
  ];
  for (const user of RUNTIME_LOGINS) {
    for (const text of joined) assert.deepEqual(homePathFindings(text, user), ["home path with username (use ~ or /home/<user>)"], `${user}: ${text}`);
  }
});

await test("an apostrophe or a backslash escape after the role-name home fails closed as a look-alike", () => {
  for (const user of RUNTIME_LOGINS) {
    for (const text of [`the ${roleHome}'s files`, `"${roleHome}\\n"`, `printf '${roleHome}\\n'`, `match ${roleHome}\\b`]) {
      assert.deepEqual(homePathFindings(text, user), ["home path with username (use ~ or /home/<user>)"], `${user}: ${text}`);
    }
  }
});

await test("a path that stays inside the role-name home passes for every login", () => {
  const inside = [
    `cd ${roleHome}`,
    `cd ${roleHome}/`,
    `WORKDIR ${roleHome}/workspace`,
    `PATH=${roleHome}/.local/bin:/usr/bin`,
    `ls ${roleHome}/x/../y`,
    `ls ${roleHome}/a/b/../../c`,
    `ls ${roleHome}/x/..`,
    `ls ${roleHome}/./x`,
    `ls ${roleHome}/.`,
    `ls ${roleHome}//x`,
    `ls ${roleHome}/...`,
    `ls "${roleHome}/workspace"`,
    `cd ${roleHome} && cd ..`,
    `see (${roleHome}/x/../y).`,
    "ls /home/<user>/../x",
    `ls ${roleHome}/agent/..`,
  ];
  for (const user of RUNTIME_LOGINS) {
    for (const text of inside) assert.deepEqual(homePathFindings(text, user), [], `${user}: ${text}`);
  }
});

await test("the role-home check keeps the other checks and does not echo the path", () => {
  const checks = redactionChecks({ host: "ci", user: "agent" });
  const findings = findSensitive(`ls ${roleHome}/../bob token ${"ghp_" + "x".repeat(30)}`, checks);
  assert.deepEqual(findings.map((finding) => finding.name).sort(), ["GitHub token", "home path with username (use ~ or /home/<user>)"]);
  assert.ok(!JSON.stringify(findings).includes("bob"));
});

await test("a long run of role-home paths is scanned in linear time", () => {
  const started = performance.now();
  findSensitive(`${roleHome}/x`.repeat(15_000) + "/..".repeat(15_000), redactionChecks({ host: "ci", user: "agent" }));
  assert.ok(performance.now() - started < 2000, "scan of a long role-home line took over 2 seconds");
});

await test("a generic hostname is not checked, and a user with no passwd entry is not an error", () => {
  for (const host of ["localhost", "runner", "buildkitsandbox", "LOCALHOST"]) {
    assert.equal(redactionChecks({ host, user: "bob" }).some((check) => /hostname/.test(check.name)), false, host);
  }
  assert.equal(redactionChecks({ host: "build-box-7", user: "bob" }).some((check) => /hostname/.test(check.name)), true);
  const noPasswd = (): never => {
    throw new Error("ENOENT: no such file or directory, uv_os_get_passwd");
  };
  assert.equal(currentIdentity(noPasswd).user, "", "a container uid without a passwd entry has no username to check");
});

await test("currentIdentity reads this machine", () => {
  const { host, user } = currentIdentity();
  assert.ok(host.length > 0 && user.length > 0);
});

const VENDORED = [".claude/rules/ecc/common/a.md", ".claude/rules/ecc/LICENSE"];

await test("redactionTargets in a git checkout: everything git would publish", (t) => {
  const repo = createRepo("redaction-git-");
  t.after(() => repo.cleanup());
  const published = [".env.example", "tsconfig.json", "notes/x.py", "Dockerfile", "wiki/a.MD", ".claude/rules/ecc/hook.ts", "untracked.txt"];
  for (const path of [...published, ...VENDORED, "ignored.log", "image.bin"]) repo.write(path, path === "image.bin" ? "\0binary" : "text\n");
  repo.write(".gitignore", "*.log\n");
  repo.git(["add", ".gitignore", ".env.example", "tsconfig.json", "notes", "Dockerfile", "wiki", ".claude", "image.bin"]);
  repo.commit("tracked");
  const result = redactionTargets(repo.dir);
  assert.deepEqual(result.files.map((file) => relative(repo.dir, file)).sort(), [".gitignore", ...published].sort());
  assert.deepEqual(result.symlinks, []);
});

await test("redactionTargets reports symbolic links instead of scanning through them", (t) => {
  const repo = createRepo("redaction-link-");
  t.after(() => repo.cleanup());
  repo.write("a.md", "text\n");
  symlinkSync("/etc/hostname", join(repo.dir, "link"));
  repo.commit("with link");
  assert.deepEqual(redactionTargets(repo.dir).symlinks.map((file) => relative(repo.dir, file)), ["link"]);
});

await test("redactionTargets outside git: every file under the root except vendored rules", (t) => {
  const root = mkdtempSync(join(tmpdir(), "redaction-plain-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const included = ["wiki/a.md", ".claude/skills/x/SKILL.md", ".env.example", "scripts/dist/leak.ts", "README.md"];
  for (const path of [...included, ...VENDORED, "node_modules/x/a.md"]) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), "text\n");
  }
  assert.deepEqual(redactionTargets(root).files.map((file) => relative(root, file)).sort(), [...included].sort());
});

await test("staged copies are found relative to a root inside a larger checkout", (t) => {
  const repo = createRepo("redaction-nested-");
  t.after(() => repo.cleanup());
  repo.write("outside.md", "clean\n");
  repo.write("vault/inside.md", "clean\n");
  repo.commit("base");
  for (const path of ["outside.md", "vault/inside.md"]) {
    repo.write(path, "staged text\n");
    repo.git(["add", path]);
    repo.write(path, "working text\n");
  }
  const root = join(repo.dir, "vault");
  assert.deepEqual(redactionTargets(root).staged, [{ file: join(root, "inside.md"), text: "staged text" }]);
});

await test("a very long line is scanned in linear time", () => {
  const started = performance.now();
  findSensitive("a".repeat(200_000), checks);
  assert.ok(performance.now() - started < 2000, "scan of a 200 KB line took over 2 seconds");
});

await test("a staged secret in a file deleted from the working copy is still found", async (t) => {
  const repo = createRepo("redaction-deleted-");
  t.after(() => repo.cleanup());
  repo.write("a.md", "clean\n");
  repo.commit("base");
  repo.write("leak.md", "token " + "ghp_" + "q".repeat(30) + "\n");
  repo.git(["add", "leak.md"]);
  const { rmSync: remove } = await import("node:fs");
  remove(join(repo.dir, "leak.md"));
  assert.deepEqual(redactionTargets(repo.dir).staged.map((entry) => relative(repo.dir, entry.file)), ["leak.md"]);
});

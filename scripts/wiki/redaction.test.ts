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
  for (const account of ["node", "root", "ubuntu", "deploy", "www-data", "runner"]) {
    assert.equal(isPersonalAccount(account), false, account);
  }
  assert.equal(isPersonalAccount("alice"), true);
  assert.equal(isPersonalAccount("bob"), false, "names under four characters are too common to match");
  assert.equal(redactionChecks({ host: "ci", user: "node" }).some((check) => /machine/.test(check.name)), false);
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

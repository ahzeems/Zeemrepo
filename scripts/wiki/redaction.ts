import { lstatSync, openSync, readSync, closeSync } from "node:fs";
import { hostname, userInfo } from "node:os";
import { join, relative } from "node:path";
import { git, gitPaths, tryGit } from "../lib/git.ts";
import { walk } from "../lib/walk.ts";
import { escapeRegExp } from "./schema.ts";

export type Identity = { host: string; user: string };
type RedactionCheck = { name: string; test(line: string): boolean };
type Finding = { line: number; name: string };
// staged: files whose index copy differs from the working copy, with the index text.
type Targets = { files: string[]; symlinks: string[]; staged: { file: string; text: string }[] };

// A uid with no passwd entry (common in containers) makes userInfo throw; it has no name to check.
export function currentIdentity(readUser: () => { username: string } = userInfo): Identity {
  try {
    return { host: hostname(), user: readUser().username };
  } catch {
    return { host: hostname(), user: "" };
  }
}

// Account names that identify a role rather than a person: a container image's default user, a
// CI runner, a service. A checkout validated by a user named `node` would otherwise fail every
// note that mentions Node, and one validated by `agent`, the Sandcastle sandbox user, would fail
// the `agent:` field of every note. Only the bare-word login check skips these names; a
// home-directory path with a username is still flagged whatever the login is, except a path
// that stays under the home of the role name `agent` (see homePathCheck), which identifies no person.
const SERVICE_ACCOUNTS = new Set([
  "node", "root", "ubuntu", "debian", "alpine", "admin", "administrator", "user", "users", "app",
  "web", "www-data", "nobody", "daemon", "deploy", "docker", "runner", "build", "builder", "ci",
  "test", "guest", "service", "nginx", "apache", "postgres", "mysql", "redis", "container", "agent",
]);

// Hostnames that name a role or a default, not this machine: CI runners and containers use them.
const GENERIC_HOSTS = new Set(["localhost", "runner", "build", "builder", "buildkitsandbox", "docker", "container", "ubuntu", "debian"]);

function isPersonalHost(name: string): boolean {
  return name.length >= 4 && !GENERIC_HOSTS.has(name.toLowerCase());
}

export function isPersonalAccount(name: string): boolean {
  return name.length >= 4 && !SERVICE_ACCOUNTS.has(name.toLowerCase());
}

// Addresses that are public by design. Domains are compared whole, so a look-alike such as
// github.com.evil.org is not mistaken for github.com.
const PUBLIC_DOMAINS = new Set(["github.com", "users.noreply.github.com", "example.com", "example.org", "example.net"]);
const PUBLIC_ADDRESSES = new Set(["noreply@anthropic.com"]);
// The local part starts at a boundary and is bounded, so a long run of letters cannot make
// the scan quadratic; the last domain label is alphabetic, so a version pin such as
// typescript@6.0.3 is not mistaken for an address. A four-part IP address still counts.
const EMAIL = /(?<![\p{L}\p{N}._%+-])([\p{L}\p{N}._%+-]{1,64})@((?:[\p{L}\p{N}-]+\.)+\p{L}{2,}|\d{1,3}(?:\.\d{1,3}){3})(?![\p{L}\p{N}-])/gu;

function isPublicEmail(local: string, domain: string): boolean {
  const lower = domain.toLowerCase();
  return PUBLIC_DOMAINS.has(lower) || lower.endsWith(".invalid") || PUBLIC_ADDRESSES.has(`${local}@${lower}`.toLowerCase());
}

const emailCheck: RedactionCheck = {
  name: "email address",
  test: (line) => [...line.matchAll(EMAIL)].some(([, local = "", domain = ""]) => !isPublicEmail(local, domain)),
};

const pattern = (name: string, re: RegExp): RedactionCheck => ({ name, test: (line) => re.test(line) });

const HOME_WITH_NAME = /\/home\/(?!<user>|linuxbrew\b|agent(?![A-Za-z0-9_.-]))[A-Za-z0-9_.-]+/;
const ROLE_HOME = "/home/agent";
// What ends a path in prose, a shell line or a PATH list. Quotes and backslashes do not end
// one: the shell joins a quoted `"../x"` onto the path before it, so they are dropped first.
const SHELL_JOINERS = /["'\\]/g;
const PATH_BREAK = /[\s:;,|&<>()[\]{}`]+/;

const depthChange = (segment: string): number => (segment === ".." ? -1 : segment === "" || segment === "." ? 0 : 1);

// True when a `..` climbs above the role-name home at any step, even if a later segment
// re-enters it: going up to x and back into agent still names x. One pass from the right keeps,
// for each position, the lowest depth a walk from there reaches, so the scan stays linear.
function climbsOutOfRoleHome(path: string): boolean {
  const segments = path.split("/");
  let lowest = 0;
  for (let index = segments.length; index >= 3; index -= 1) {
    if (index < segments.length) lowest = Math.min(0, depthChange(segments[index] ?? "") + lowest);
    if (lowest < 0 && segments[index - 1] === "agent" && segments[index - 2] === "home") return true;
  }
  return false;
}

// Every home path with a username is flagged whatever the login is, except a path that stays
// under the home of the role name `agent`, the Sandcastle sandbox user, which identifies no person.
const homePathCheck: RedactionCheck = {
  name: "home path with username (use ~ or /home/<user>)",
  test: (line) => {
    const joined = line.replace(SHELL_JOINERS, "");
    return HOME_WITH_NAME.test(joined) || (joined.includes(ROLE_HOME) &&
      joined.split(PATH_BREAK).some((path) => path.includes(ROLE_HOME) && climbsOutOfRoleHome(path)));
  },
};

const FIXED_CHECKS: readonly RedactionCheck[] = [
  emailCheck,
  pattern("GitHub token", /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/),
  pattern("API key", /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/),
  pattern("AWS access key", /\b(AKIA|ASIA)[A-Z0-9]{16}\b/),
  pattern("Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/),
  pattern("Google API key", /\bAIza[A-Za-z0-9_-]{35}\b/),
  pattern("Stripe key", /\b[rs]k_live_[A-Za-z0-9]{20,}/),
  pattern("JWT", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/),
  pattern("private key", /BEGIN [A-Z ]*PRIVATE KEY/),
  pattern("SSH public key", /\b(ssh-(ed25519|rsa|dss)|ecdsa-sha2-nistp\d+) AAAA[A-Za-z0-9+/]{20,}/),
  homePathCheck,
  pattern("macOS home path with username (use ~ or /Users/<user>)", /(?<![A-Za-z]:)(?<![\w/\\])\/Users\/(?!<user>|Shared\b)[A-Za-z0-9]/),
  pattern("Windows user path (use <windows-user>)", /(\/mnt\/c\/Users\/|[A-Z]:(\\+|\/)Users(\\+|\/))(?!<windows-user>)[A-Za-z0-9]/i),
];

// This machine's own identifiers are found at run time rather than hardcoded in the repo.
// Identity is a parameter so tests do not depend on the machine running them. A username
// under four characters is not checked as a bare word: it would match ordinary words.
export function redactionChecks(identity: Identity): RedactionCheck[] {
  const checks = [...FIXED_CHECKS];
  if (isPersonalHost(identity.host)) checks.push(pattern("this machine's hostname", new RegExp(`\\b${escapeRegExp(identity.host)}\\b`, "i")));
  if (isPersonalAccount(identity.user)) checks.push(pattern("this machine's username", new RegExp(`\\b${escapeRegExp(identity.user)}\\b`, "i")));
  return checks;
}

export function findSensitive(text: string, checks: readonly RedactionCheck[]): Finding[] {
  return text.split("\n").flatMap((line, index) =>
    checks.filter((check) => check.test(line)).map((check) => ({ line: index + 1, name: check.name })));
}

// Vendored third-party prose, published unchanged from its upstream; anything else placed
// under that directory is scanned like every other file.
const VENDORED = [/^\.claude\/rules\/ecc\/.+\.md$/, /^\.claude\/rules\/ecc\/LICENSE$/];
const BINARY_PROBE_BYTES = 8000;

function isBinary(file: string): boolean {
  const buffer = Buffer.alloc(BINARY_PROBE_BYTES);
  const fd = openSync(file, "r");
  try {
    return buffer.subarray(0, readSync(fd, buffer, 0, BINARY_PROBE_BYTES, 0)).includes(0);
  } finally {
    closeSync(fd);
  }
}

// What the repository publishes: in a checkout, every file git tracks or would add (ignored
// files excluded); outside one, every file under the root. A hand-picked list of folders
// and extensions misses whatever nobody thought to list.
function isInGit(root: string): boolean {
  return tryGit(["rev-parse", "--is-inside-work-tree"], { cwd: root }) === "true";
}

function candidatePaths(root: string, inGit: boolean): string[] {
  if (!inGit) {
    const found = walk(root, { includeDot: true });
    return [...found.files, ...found.symlinks].map((file) => relative(root, file).split("\\").join("/"));
  }
  return gitPaths(["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root });
}

function stagedCopies(root: string, inGit: boolean): { file: string; text: string }[] {
  if (!inGit) return [];
  // D: staged but deleted from disk, so the commit would publish a copy the file scan cannot see.
  const differing = gitPaths(["diff", "--relative", "--name-only", "--diff-filter=ADMT"], { cwd: root });
  return differing.filter((path) => !VENDORED.some((rule) => rule.test(path)))
    .map((path) => ({ file: join(root, path), text: git(["show", `:./${path}`], { cwd: root }) }))
    .filter(({ text }) => !text.includes("\0"));
}

export function redactionTargets(root: string): Targets {
  const inGit = isInGit(root);
  const targets: Targets = { files: [], symlinks: [], staged: stagedCopies(root, inGit) };
  for (const path of new Set(candidatePaths(root, inGit))) {
    if (VENDORED.some((rule) => rule.test(path))) continue;
    const file = join(root, path);
    const stat = lstatSync(file, { throwIfNoEntry: false });
    if (stat === undefined || stat.isDirectory()) continue;
    if (stat.isSymbolicLink()) targets.symlinks.push(file);
    else if (!isBinary(file)) targets.files.push(file);
  }
  return targets;
}

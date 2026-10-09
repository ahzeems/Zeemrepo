import { lstatSync, openSync, readSync, closeSync } from "node:fs";
import { hostname, userInfo } from "node:os";
import { join, relative } from "node:path";
import { git, gitPaths, tryGit } from "../lib/git.ts";
import { walk } from "../lib/walk.ts";
import { escapeRegExp } from "./schema.ts";

export type Identity = { host: string; user: string };
export type RedactionCheck = { name: string; test(line: string): boolean };
export type Finding = { line: number; name: string };
// staged: files whose index copy differs from the working copy, with the index text.
export type Targets = { files: string[]; symlinks: string[]; staged: { file: string; text: string }[] };

export function currentIdentity(): Identity {
  return { host: hostname(), user: userInfo().username };
}

// Account names that identify a role rather than a person. A checkout validated by a user
// named `node` would otherwise fail every note that mentions Node.
const SERVICE_ACCOUNTS = new Set([
  "node", "root", "ubuntu", "debian", "alpine", "admin", "administrator", "user", "users", "app",
  "web", "www-data", "nobody", "daemon", "deploy", "docker", "runner", "build", "builder", "ci",
  "test", "guest", "service", "nginx", "apache", "postgres", "mysql", "redis", "container",
]);

export function isPersonalAccount(name: string): boolean {
  return name.length >= 4 && !SERVICE_ACCOUNTS.has(name.toLowerCase());
}

// Addresses that are public by design. Domains are compared whole, so a look-alike such as
// github.com.evil.org is not mistaken for github.com.
const PUBLIC_DOMAINS = new Set(["github.com", "users.noreply.github.com", "example.com", "example.org", "example.net"]);
const PUBLIC_ADDRESSES = new Set(["noreply@anthropic.com"]);
const EMAIL = /([\p{L}\p{N}._%+-]+)@([\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+)/gu;

function isPublicEmail(local: string, domain: string): boolean {
  const lower = domain.toLowerCase();
  return PUBLIC_DOMAINS.has(lower) || lower.endsWith(".invalid") || PUBLIC_ADDRESSES.has(`${local}@${lower}`.toLowerCase());
}

const emailCheck: RedactionCheck = {
  name: "email address",
  test: (line) => [...line.matchAll(EMAIL)].some(([, local = "", domain = ""]) => !isPublicEmail(local, domain)),
};

const pattern = (name: string, re: RegExp): RedactionCheck => ({ name, test: (line) => re.test(line) });

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
  pattern("home path with username (use ~ or /home/<user>)", /\/home\/(?!<user>|linuxbrew\b)[A-Za-z0-9_.-]+/),
  pattern("macOS home path with username (use ~ or /Users/<user>)", /(?<![A-Za-z]:)(?<![\w/\\])\/Users\/(?!<user>|Shared\b)[A-Za-z0-9]/),
  pattern("Windows user path (use <windows-user>)", /(\/mnt\/c\/Users\/|[A-Z]:(\\+|\/)Users(\\+|\/))(?!<windows-user>)[A-Za-z0-9]/i),
];

// This machine's own identifiers are found at run time rather than hardcoded in the repo.
// Identity is a parameter so tests do not depend on the machine running them. A username
// under four characters is not checked as a bare word: it would match ordinary words.
export function redactionChecks(identity: Identity): RedactionCheck[] {
  const checks = [...FIXED_CHECKS];
  if (identity.host.length >= 4) checks.push(pattern("this machine's hostname", new RegExp(`\\b${escapeRegExp(identity.host)}\\b`, "i")));
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
  const differing = gitPaths(["diff", "--relative", "--name-only", "--diff-filter=AM"], { cwd: root });
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

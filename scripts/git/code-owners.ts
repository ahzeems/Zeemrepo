// The user logins a .github/CODEOWNERS file names, lower-cased. Team entries (@org/team) and
// email addresses are skipped: npm run pr and npm run audit compare against GitHub user logins.
export function parseCodeOwners(text: string): string[] {
  return text.split("\n")
    .map((line) => line.split("#")[0] ?? "")
    .flatMap((line) => line.trim().split(/\s+/).slice(1))
    .filter((entry) => /^@[^/\s]+$/.test(entry))
    .map((entry) => entry.slice(1).toLowerCase());
}

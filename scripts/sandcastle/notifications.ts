// Issue notifications that survive a lost acknowledgement (S17, finding A10). The channel is the
// one npm run sandcastle:afk already uses, a comment on the issue posted with the host's gh; what
// is new is that each notice carries a hidden marker naming its key, and the issue's comments are
// read for that marker, written by this gh login, before anything is posted. A retry after a
// comment whose acknowledgement was lost finds it instead of posting a second one. When the issue
// cannot be read, nothing is posted: an unconfirmed notice is reported, never assumed delivered.
import { slug, type Repository, type Run } from "../git/pr-ready.ts";
import { isRecord } from "../lib/record.ts";

export type Notice = { repository: Repository; issue: string; key: string; body: string };
export type NoticeDelivery = { status: "delivered"; url: string; reused: boolean } | { status: "unconfirmed"; reason: string };

const ISSUE = /^[1-9]\d*$/;
const COMMENTS_JQ = ".[] | {login: .user.login, url: .html_url, body: .body} | tojson";

/** The line a notice ends with; only a comment by this gh login that contains it counts as delivered. */
export const noticeMarker = (key: string): string => `<!-- sandcastle-notification:${key} -->`;

const unconfirmed = (reason: string): NoticeDelivery => ({ status: "unconfirmed", reason });

function gh(run: Run, args: readonly string[]): { stdout: string } | { failure: string } {
  try {
    const result = run("gh", args);
    return result.status === 0 ? { stdout: result.stdout } : { failure: `gh ${args.slice(0, 2).join(" ")} exited ${String(result.status)}` };
  } catch (error) {
    return { failure: error instanceof Error ? error.message : String(error) };
  }
}

/** The URL of this login's comment carrying the marker, undefined when there is none, or why the issue could not be read. */
function marked(run: Run, notice: Notice, login: string): { url: string | undefined } | { failure: string } {
  const { repository, issue } = notice;
  const path = `repos/${repository.owner}/${repository.name}/issues/${issue}/comments`;
  const listed = gh(run, ["api", "--hostname", repository.host, "--paginate", path, "--jq", COMMENTS_JQ]);
  if ("failure" in listed) return listed;
  const marker = noticeMarker(notice.key);
  for (const line of listed.stdout.split("\n").filter((text) => text !== "")) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      value = undefined;
    }
    if (!isRecord(value) || typeof value.login !== "string" || typeof value.url !== "string" || typeof value.body !== "string") {
      return { failure: `gh returned a line that is not a comment: ${line.slice(0, 80)}` };
    }
    if (value.login.toLowerCase() === login.toLowerCase() && value.body.includes(marker)) return { url: value.url };
  }
  return { url: undefined };
}

/**
 * Post the notice on its issue unless this gh login already did. Delivered means the comment exists
 * (posted now, or found from an earlier attempt); unconfirmed says whether a comment may exist.
 */
export function deliverNotice(run: Run, notice: Notice): NoticeDelivery {
  if (!ISSUE.test(notice.issue)) return unconfirmed(`${JSON.stringify(notice.issue)} is not an issue number; nothing was posted`);
  const user = gh(run, ["api", "user", "--hostname", notice.repository.host, "--jq", ".login"]);
  const login = "stdout" in user ? user.stdout.trim() : "";
  if (login === "") return unconfirmed(`the gh login could not be read (${"failure" in user ? user.failure : "empty"}); nothing was posted`);
  const found = marked(run, notice, login);
  if ("failure" in found) return unconfirmed(`issue ${notice.issue} could not be read to check for an earlier notice (${found.failure}); nothing was posted`);
  if (found.url !== undefined) return { status: "delivered", url: found.url, reused: true };
  const body = `${notice.body}\n\n${noticeMarker(notice.key)}`;
  const posted = gh(run, ["issue", "comment", notice.issue, "-R", slug(notice.repository), "--body", body]);
  if ("failure" in posted) {
    return unconfirmed(`the comment on issue ${notice.issue} may have been posted, but gh did not confirm it (${posted.failure}); a rerun looks for it before posting again`);
  }
  return { status: "delivered", url: posted.stdout.trim(), reused: false };
}

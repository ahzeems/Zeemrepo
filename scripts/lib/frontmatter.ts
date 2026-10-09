import { parseDocument } from "yaml";
import { isRecord } from "./record.ts";

// "none" and "invalid" are different answers: a guard that skipped both would let a record
// opt out of checking by corrupting its own frontmatter (a duplicate key, a stray fence).
export type Frontmatter =
  | { kind: "none" }
  | { kind: "invalid"; reason: string }
  | { kind: "ok"; data: Readonly<Record<string, unknown>>; body: string };

// YAML is external input: duplicate keys, non-mapping documents and alias bombs are
// rejected rather than guessed at. CRLF is normalized first, since an editor on Windows
// writes it and the fence match is line-based.
const MAX_ALIAS_COUNT = 20;
const OPEN = /^---\n/;
const BLOCK = /^---\n(?:([\s\S]*?)\n)?---(?:\n|$)/;

export function parseFrontmatter(text: string): Frontmatter {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!OPEN.test(normalized)) return { kind: "none" };
  const match = BLOCK.exec(normalized);
  if (!match) return { kind: "invalid", reason: "unterminated frontmatter: no closing --- line" };
  const doc = parseDocument(match[1] ?? "", { uniqueKeys: true, stringKeys: true, prettyErrors: false });
  const problem = doc.errors[0] ?? doc.warnings[0];
  if (problem !== undefined) return { kind: "invalid", reason: `invalid YAML: ${problem.message}` };
  let data: unknown;
  try {
    data = doc.toJS({ maxAliasCount: MAX_ALIAS_COUNT });
  } catch (error) {
    return { kind: "invalid", reason: `alias expansion refused: ${error instanceof Error ? error.message : String(error)}` };
  }
  const body = normalized.slice(match[0].length);
  if (data === null || data === undefined) return { kind: "ok", data: {}, body };
  if (!isRecord(data)) return { kind: "invalid", reason: "frontmatter must be a mapping of fields" };
  return { kind: "ok", data, body };
}

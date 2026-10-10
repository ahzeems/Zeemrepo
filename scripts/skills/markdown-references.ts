import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it";
import { parseFrontmatter } from "../lib/frontmatter.ts";

type References = { links: string[]; images: string[]; headings: Set<string> };

const parser = new MarkdownIt({ html: true, linkify: false, typographer: false });
const EXTERNAL = /^[a-z][a-z0-9+.-]*:/i;

function inlineText(tokens: readonly Token[]): string {
  return tokens.map((token) => {
    if (token.children) return inlineText(token.children);
    return ["text", "code_inline", "softbreak", "hardbreak"].includes(token.type) ? token.content : "";
  }).join("");
}

function collectTargets(tokens: readonly Token[], refs: References): void {
  for (const token of tokens) {
    const target = token.type === "link_open" ? token.attrGet("href") : token.type === "image" ? token.attrGet("src") : null;
    if (typeof target === "string" && !EXTERNAL.test(target) && !target.startsWith("//")) {
      (token.type === "image" ? refs.images : refs.links).push(target);
    }
    // An image's children are its alternative text, which is not navigation.
    if (token.type !== "image" && token.children) collectTargets(token.children, refs);
  }
}

// GitHub-style slugs: lower case, punctuation dropped, spaces to hyphens, duplicates numbered.
function collectHeadings(tokens: readonly Token[], refs: References): void {
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index]?.type !== "heading_open") continue;
    const content = inlineText(tokens[index + 1]?.children ?? []);
    const base = content.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, "").replace(/ /g, "-");
    let slug = base;
    for (let suffix = 1; refs.headings.has(slug); suffix++) slug = `${base}-${suffix}`;
    refs.headings.add(slug);
  }
}

/** Relative link and image targets, and heading anchors, excluding frontmatter, comments and code. */
export function markdownReferences(source: string): References {
  const frontmatter = parseFrontmatter(source);
  const tokens = parser.parse(frontmatter.kind === "ok" ? frontmatter.body : source, {});
  const refs: References = { links: [], images: [], headings: new Set() };
  collectTargets(tokens, refs);
  collectHeadings(tokens, refs);
  return refs;
}

import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it";

// HTML stays on so a comment spanning lines parses as one html_block: with it off, the lines
// inside would be read as ordinary Markdown, headings and links included.
const parser = new MarkdownIt({ html: true, linkify: false, typographer: false });

/** Block tokens of a Markdown body, as CommonMark reads it. Pass the body without frontmatter. */
export function markdownTokens(source: string): Token[] {
  return parser.parse(source, {});
}

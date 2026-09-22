export interface ExtractedComment {
  raw: string   // the original <!-- ... --> span, byte-exact (for round-trip)
  text: string  // trimmed inner text
}

// Only spans that open and close their own line (like frontmatter's ---
// delimiters) are extracted here — a single-line comment (no embedded
// newline) is left untouched and still handled by lexer.ts's per-line
// COMMENT regex, unchanged.
const COMMENT_SPAN = /^<!--([\s\S]*?)-->[ \t]*$/gm

/**
 * Extracts multi-line <!-- ... --> comment spans from the raw document body
 * *before* block-splitting (parser.ts splits on /\n\n+/), replacing each
 * with a single-line placeholder. Without this, a comment spanning a blank
 * line would already have been fragmented into separate blocks by the time
 * any comment-detection ran, and a comment spanning multiple non-blank
 * lines would never be tested as a whole (parser.ts only tokenizes a
 * block's first line to classify it). Mirrors frontmatter.ts's approach of
 * stripping a delimited region before the rest of parsing sees it — comments
 * can appear anywhere in the body, not just at the top, so a placeholder is
 * substituted in place rather than sliced off entirely.
 */
export function extractComments(body: string): { body: string; comments: Map<string, ExtractedComment> } {
  const comments = new Map<string, ExtractedComment>()
  let index = 0
  const replacedBody = body.replace(COMMENT_SPAN, (match, inner: string) => {
    if (!inner.includes('\n')) return match
    const placeholder = `\u0000COMMENT_${index++}\u0000`
    comments.set(placeholder, { raw: match, text: inner.trim() })
    return placeholder
  })
  return { body: replacedBody, comments }
}

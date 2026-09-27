---
"@sutrata/parser": minor
---

`parseWithSpans(source)` returns the AST together with the source span of the frontmatter and of every top-level node (`SourceSpan`: `{ start, end }` string indices into the original source, CRLF included). Cutting a document at the start of every section and scene heading gives pieces that join back byte for byte (OSS spec §11.7). `parse()` and the AST are unchanged.

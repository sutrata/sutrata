---
"@sutrata/editor": minor
---

AI-assisted import ("Import with AI" in the app bar): bring in a screenplay from any Word document, text or Markdown file, or pasted text.

- The text is split into chunks at likely scene boundaries and formatted as Sutra by the injected `AIProvider`.
- Each chunk's output must parse, and its words must match the source (NFC, markup ignored). A failing chunk is retried once and otherwise flagged in the review.
- The provider's `dataPolicyText` is shown and must be accepted before any text is sent. The feature is hidden without an `AIProvider` or in read-only sessions.
- The review shows source and result side by side, with a per-block element-type picker. Importing replaces the script (keeping the title page) or appends to it, as one undoable edit.
- Word documents exported by Sutrata still use the lossless importer, without AI.

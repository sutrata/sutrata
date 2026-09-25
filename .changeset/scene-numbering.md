---
"@sutrata/editor": minor
---

Scene numbering per format spec §7.4.

- The navigator shows each scene's `& number:`, falling back to its `{#id}`. Once any scene has a number, it flags missing, invalid, duplicate and out-of-order numbers with a warning edge and a tooltip giving the reason.
- **Renumber scenes** (navigator header) replaces "Lock Scene Numbers". Numbering changes only when the writer asks, and is applied as one undoable edit:
  - a scene inserted after 12 becomes 13, and later numbers go up by one, keeping their letters (20, 20A, 21 → 21, 21A, 22);
  - a scene inserted inside a lettered run takes the next letter (20A, new, 20B → 20A, 20B, 20C).
- **Omit scene / Restore** (per scene in the navigator) sets `& status: omitted` and keeps the body in a comment.
- In the editor, omitted headings are struck through with an OMITTED badge. PDF and DOCX print "OMITTED" and the scene number (`& number:`, else `{#id}`).

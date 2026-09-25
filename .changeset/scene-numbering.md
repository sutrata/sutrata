---
"@sutrata/editor": minor
---

Scene numbering per format spec §7.4. A scene's number is its `{#id}` (`12`, `12A`); there is no separate number key.

- The navigator shows each scene's `{#id}` as its number. Once any scene has a numeric ID, it flags missing, invalid, duplicate and out-of-order numbers with a warning edge and a tooltip giving the reason.
- **Renumber scenes** (navigator header) replaces "Lock Scene Numbers". Numbering changes only when the writer asks, and is applied as one undoable edit that rewrites only the `#id` in each heading's attribute block:
  - main scenes are renumbered 1, 2, 3, … in order, closing gaps (1, 2, 2A, 3, 5, 4 → 1, 2, 2A, 3, 4, 5);
  - lettered scenes stay sub-scenes of the main scene before them, with letters compacted;
  - a scene with no number inside a lettered run takes the next letter (2A, new, 2B → 2A, 2B, 2C); elsewhere it becomes a main scene.
- **Omit scene / Restore** (per scene in the navigator) sets `& status: omitted` and keeps the body in a comment.
- In the editor, omitted headings are struck through with an OMITTED badge. PDF and DOCX print "OMITTED" and the scene number (`{#id}`).
- Tool-private `x-` scene metadata keys (format spec §7.1) are kept but hidden in the formatted editor, and never exported.

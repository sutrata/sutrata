---
"@sutrata/editor": minor
---

`StorageAdapter` sync members for networked embedders (OSS spec §11.5). `saveDocument` may return a `SaveResult` (`{ content? }`), and an optional `subscribe(path, onRemote)` delivers changes saved elsewhere. The editor applies either as one change kept out of undo history, replacing only the top-level blocks that differ (the cursor stays put), and only when there are no local edits since the last save. `setText` takes an optional `{ markDirty: false }`. Autosave now skips a save when the text is unchanged since the last one.

Tool-private `x-` frontmatter keys (format spec §5) are hidden on the title page, kept out of the caret's way and out of the title page form's custom rows; exports already never printed them.

Existing adapters need no change: both members are optional.

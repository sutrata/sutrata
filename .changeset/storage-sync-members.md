---
"@sutrata/editor": minor
---

`StorageAdapter` sync members for networked embedders (OSS spec §11.5). `saveDocument` may return a `SaveResult` (`{ content? }`), and an optional `subscribe(path, onRemote)` delivers changes saved elsewhere. The editor applies either as one change kept out of undo history, replacing only the top-level blocks that differ (the cursor stays put), and only when there are no local edits since the last save. `setText` takes an optional `{ markDirty: false }`. Autosave now skips a save when the text is unchanged since the last one.

Tool-private `x-` frontmatter keys (format spec §5) are hidden on the title page, kept out of the caret's way and out of the title page form's custom rows; exports already never printed them.

For embedders whose documents are not local files: `SessionContext.featureFlags.localFiles: false` hides New, Open and Save As (and Ctrl+O) and turns off local-session recovery; Save stays and saves through the adapter. An optional `StorageAdapter.displayName(path)` names the document in the app bar's file pill (exposed as `fileDisplayName` on the document context), for adapters whose paths are opaque ids.

Existing adapters need no change: every new member is optional.

---
"@sutrata/editor": minor
---

Panel, command and export registries are live extension points (`createRegistries()`, or `createPanelRegistry` / `createCommandRegistry` / `createExportRegistry`; new `DocumentProvider` props `commands` and `exporters` next to `panels`).

- **Panels**: locations `sidebar` (tabs beside the scene navigator), `inspector` (a right-hand panel), `appbar` and `settings`, rendered with `{ ast, sceneIds, activeSceneId }`.
- **Commands**: `{ id, label, run(ctx), shortcut?, shortcutHint?, menu?: 'toolbar' | 'appbar', group?, icon?, isActive?, readOnly? }`. Shortcuts work in both editing modes. The element toolbar's own actions (undo/redo, element types with their Alt+Shift shortcuts, bold/italic/underline) are built-in registrations.
- **Exporters**: `{ id, label, group: 'screenplay' | 'report', run(ctx), fileName(ctx), family?, formatLabel?, supports? }`. `run` returns a Blob, `{ blob, warnings }`, or nothing when it handles output itself. The Export dialog renders every format from one list; PDF, DOCX, Fountain and all reports are built-in registrations.
- Registering an entry with a built-in's id replaces the built-in.

### Migration

`PanelRegistry` is now the generic registry store (`register` / `list()` / `subscribe`); `list` no longer takes a location (filter by `panel.location`). `ElementToolbar` must be rendered inside `DocumentProvider`, which it always is inside `AppShell`.

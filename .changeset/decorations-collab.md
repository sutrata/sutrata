---
"@sutrata/editor": minor
---

`DecorationProvider` and `CollabBinding` are real extension points (new optional `DocumentProvider` props `decorationProviders` and `collabBinding`).

- Decorations are `inline`, `node` or `widget` specs anchored to `{ sceneId, from?, to? }` (offsets into the scene's text, available as `ctx.sceneText(sceneId)`), with optional `className`, `attrs` and `onClick`. Clicks are delivered in read-only and comment sessions too. Providers call their `subscribe` callback to trigger a re-render.
- A collab binding contributes ProseMirror plugins (`plugins(schema)`, added whenever the editor creates its state) and gets the view (`attach(view)`, returning a detach function).

### Migration

The old type-only shapes are replaced: `DecorationProvider.getDecorations(sceneId)` → `getDecorations(ctx)` returning `DecorationSpec[]`, plus `id` and `subscribe`; `CollabBinding.bind()` → `plugins(schema)` + `attach(view)`.

---
'@sutrata/editor': minor
---

Print and lock support for embedders (Sutrata Cloud's production office):

- New `@sutrata/editor/dist/print.js` entry with `buildScreenplayPrintHtml` and `sceneKeyOf`: the screenplay print view without the editor UI, with `PrintExtras` for a per-recipient watermark, no network fonts, revision margin marks and label, a page tint, printing only some scenes, and locked pages.
- The print paginator takes `lockedPages` (a scene keeps its locked start page; added pages are lettered, 12, 12A) and `revisionLabel`, and reports its layout on `window.__sutrataPrint`.
- Word export accepts a watermark override and puts the watermark (the frontmatter `watermark:` or the override) in the header of every page.
- `SessionContext.featureFlags`: `renumber: false` hides the navigator's Renumber; `lockSceneNumbers: true` makes it keep every existing number and letter only the scenes without one.

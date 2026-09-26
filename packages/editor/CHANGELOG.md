# @sutrata/editor

## 0.2.0

### Minor Changes

- 280a226: AI-assisted import ("Import with AI" in the app bar): bring in a screenplay from any Word document, text or Markdown file, or pasted text.
  
  - The text is split into chunks at likely scene boundaries and formatted as Sutra by the injected `AIProvider`.
  - Each chunk's output must parse, and its words must match the source (NFC, markup ignored). A failing chunk is retried once and otherwise flagged in the review.
  - The provider's `dataPolicyText` is shown and must be accepted before any text is sent. The feature is hidden without an `AIProvider` or in read-only sessions.
  - The review shows source and result side by side, with a per-block element-type picker. Importing replaces the script (keeping the title page) or appends to it, as one undoable edit.
  - Word documents exported by Sutrata still use the lossless importer, without AI.
- c6cadbd: `AIProvider`, `SpeechProvider`, `SessionContext` and a `PanelRegistry` (settings location) are now real extension points, injected through new optional `DocumentProvider` props: `aiProvider`, `speechProvider`, `session`, `panels`.
  
  - AI features (synopsis/duration generation, AI formatting of selections and dictation, status-bar activity) go through `useAI()` and are hidden when no provider is injected, the session cannot edit, or `featureFlags.ai` is false. Voice dictation needs both providers and `featureFlags.voice !== false`.
  - `session.permission` `read`/`comment` makes the formatted and source editors read-only (doc-changing transactions are dropped) and hides save/open/import, the element toolbar, title-page and style editing, replace, and structural navigator actions.
  - The Settings dialog renders embedder sections registered for the `settings` location.
  - The bring-your-own-key AI client, API-key storage, provider catalog, AI settings UI and onboarding dialog moved to `@sutrata/app`.
  
  ### Migration
  
  - `useDocument()` no longer has `aiOnboardingVisible` / `setAIOnboardingVisible`. Call `aiProvider.openSetup?.()` instead; the embedder owns its setup UI.
  - AI and voice are **off** unless you pass `aiProvider` (and `speechProvider` for dictation). The OSS app's implementations are `createByoKeyAIProvider` / `createWebSpeechProvider` in `packages/app/src/ai/byo-key-providers.ts`.
  - The `AIProvider` type changed shape: `complete(req: { system?, prompt, signal? })`, plus `isConfigured()` and `completeStructured()`; optional `subscribeActivity()` and `openSetup()`. `SpeechProvider` gains `isSupported()` and `listen()`; `transcribe()` is optional.
  - `PanelRegistry` changed from `registerPanel()` to `register()` returning an unregister function; build one with `createPanelRegistry()`.
- aa3342f: `DecorationProvider` and `CollabBinding` are real extension points (new optional `DocumentProvider` props `decorationProviders` and `collabBinding`).
  
  - Decorations are `inline`, `node` or `widget` specs anchored to `{ sceneId, from?, to? }` (offsets into the scene's text, available as `ctx.sceneText(sceneId)`), with optional `className`, `attrs` and `onClick`. Clicks are delivered in read-only and comment sessions too. Providers call their `subscribe` callback to trigger a re-render.
  - A collab binding contributes ProseMirror plugins (`plugins(schema)`, added whenever the editor creates its state) and gets the view (`attach(view)`, returning a detach function).
  
  ### Migration
  
  The old type-only shapes are replaced: `DecorationProvider.getDecorations(sceneId)` → `getDecorations(ctx)` returning `DecorationSpec[]`, plus `id` and `subscribe`; `CollabBinding.bind()` → `plugins(schema)` + `attach(view)`.
- cf40630: Lossless editor round-trip: `parse → sutraToProsemirror → prosemirrorToSutra → parse` now preserves the whole AST.
  
  Parser:
  - Attribute blocks (§10) on scene headings, sections and character cues are parsed into `id` plus ordered `attrs: Attribute[]`; unknown attributes are preserved. New exports `splitAttributeBlock`, `formatAttributeBlock`, `Attribute`.
  - `& key:` with an empty value collects the indented `- item` lines into `SceneMetadataNode.items` (§7.1), in scenes and in the character registry. Metadata separated from the heading by blank lines is still metadata.
  - Multi-line lyrics, centered and transition blocks keep every line; `***x***` parses as bold italic; a `[[note]]` line followed by more text is action.
  - Fixed: body lines sharing a scene heading's block were serialized twice.
  
  Editor:
  - `scene_heading`, `section` and `character` carry `attrs`; `scene_metadata` has a `list` flag; `title_page` keeps its frontmatter source and re-emits unchanged keys verbatim.
  - Fixed losses: nested emphasis, cues outside a scene, character-registry metadata, line breaks in comments/transitions/centered text.
  
  ### Migration
  
  `SceneHeadingNode`, `SectionNode` and `CharacterNode` have a new required `attrs: Attribute[]` field (and `CharacterNode` a required `id`). Code that constructs these nodes must add `attrs: []` (and `id: null` for cues). A heading written `{#sc12 lang=en}` now has `id: 'sc12'` (was `'sc12 lang=en'`), and `{lang=en}` without `#` is no longer part of the heading `text`.
- 73d881a: Scene navigator marks scenes whose heading has no `{#id}` with a warning-colored edge and icon ("Scene has no ID"). Comments, scene-level diff and page locking need scene IDs. New CSS tokens `--cs-ui-warning` / `--cs-ui-warning-subtle`; new locale key `navigator.missingId` in all 12 locales.
- 03ccd5a: Panel, command and export registries are live extension points (`createRegistries()`, or `createPanelRegistry` / `createCommandRegistry` / `createExportRegistry`; new `DocumentProvider` props `commands` and `exporters` next to `panels`).
  
  - **Panels**: locations `sidebar` (tabs beside the scene navigator), `inspector` (a right-hand panel), `appbar` and `settings`, rendered with `{ ast, sceneIds, activeSceneId }`.
  - **Commands**: `{ id, label, run(ctx), shortcut?, shortcutHint?, menu?: 'toolbar' | 'appbar', group?, icon?, isActive?, readOnly? }`. Shortcuts work in both editing modes. The element toolbar's own actions (undo/redo, element types with their Alt+Shift shortcuts, bold/italic/underline) are built-in registrations.
  - **Exporters**: `{ id, label, group: 'screenplay' | 'report', run(ctx), fileName(ctx), family?, formatLabel?, supports? }`. `run` returns a Blob, `{ blob, warnings }`, or nothing when it handles output itself. The Export dialog renders every format from one list; PDF, DOCX, Fountain and all reports are built-in registrations.
  - Registering an entry with a built-in's id replaces the built-in.
  
  ### Migration
  
  `PanelRegistry` is now the generic registry store (`register` / `list()` / `subscribe`); `list` no longer takes a location (filter by `panel.location`). `ElementToolbar` must be rendered inside `DocumentProvider`, which it always is inside `AppShell`.
- 3ef6941: Scene numbering per format spec §7.4. A scene's number is its `{#id}` (`12`, `12A`); there is no separate number key.
  
  - The navigator shows each scene's `{#id}` as its number. Once any scene has a numeric ID, it flags missing, invalid, duplicate and out-of-order numbers with a warning edge and a tooltip giving the reason.
  - **Renumber scenes** (navigator header) replaces "Lock Scene Numbers". Numbering changes only when the writer asks, and is applied as one undoable edit that rewrites only the `#id` in each heading's attribute block:
    - main scenes are renumbered 1, 2, 3, … in order, closing gaps (1, 2, 2A, 3, 5, 4 → 1, 2, 2A, 3, 4, 5);
    - lettered scenes stay sub-scenes of the main scene before them, with letters compacted;
    - a scene with no number inside a lettered run takes the next letter (2A, new, 2B → 2A, 2B, 2C); elsewhere it becomes a main scene.
  - **Omit scene / Restore** (per scene in the navigator) sets `& status: omitted` and keeps the body in a comment.
  - In the editor, omitted headings are struck through with an OMITTED badge. PDF and DOCX print "OMITTED" and the scene number (`{#id}`).
  - Tool-private `x-` scene metadata keys (format spec §7.1) are kept but hidden in the formatted editor, and never exported.

### Patch Changes

- e814354: Format review dialog: the raw-content pane now scrolls for long selections (both panes share a fixed height), and the title/labels no longer say "Voice"/"Dictation" since the dialog also serves the selection menu's Format action.
- Updated dependencies [50dd948]
- Updated dependencies [cf40630]
  - @sutrata/parser@0.2.0

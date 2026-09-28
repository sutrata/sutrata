# @sutrata/parser

## 0.3.0

### Minor Changes

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
- 834da21: `parseWithSpans(source)` returns the AST together with the source span of the frontmatter and of every top-level node (`SourceSpan`: `{ start, end }` string indices into the original source, CRLF included). Cutting a document at the start of every section and scene heading gives pieces that join back byte for byte (OSS spec §11.7). `parse()` and the AST are unchanged.

### Patch Changes

- 50dd948: Fountain export drops tool-private `x-` scene metadata keys (format spec §7.1) without a "metadata dropped" warning.

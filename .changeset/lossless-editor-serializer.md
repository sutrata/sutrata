---
"@sutrata/parser": minor
"@sutrata/editor": minor
---

Lossless editor round-trip: `parse → sutraToProsemirror → prosemirrorToSutra → parse` now preserves the whole AST.

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

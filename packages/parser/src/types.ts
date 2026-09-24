import type { Attribute } from './attributes.js'

export type NodeType =
  | 'document'
  | 'frontmatter'
  | 'section'
  | 'scene-heading'
  | 'scene-metadata'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'dual-dialogue'
  | 'transition'
  | 'centered'
  | 'lyrics'
  | 'note'
  | 'comment'
  | 'page-break'

export interface BaseNode {
  type: NodeType
  raw: string        // original source text for this block (for byte-round-trip)
}

export interface DocumentNode {
  type: 'document'
  frontmatter: FrontmatterNode | null
  children: ContentNode[]
}

export interface FrontmatterNode extends BaseNode {
  type: 'frontmatter'
  data: Record<string, unknown>   // parsed YAML; unknown for forward-compat
}

export interface SectionNode extends BaseNode {
  type: 'section'
  level: 1 | 2    // # = level 1; ## is scene-heading syntax, not a section
  text: string
  id: string | null
  /** Attributes other than the id, in source order (§10); unknown ones preserved. */
  attrs: Attribute[]
  children: ContentNode[]
}

export interface SceneHeadingNode extends BaseNode {
  type: 'scene-heading'
  text: string
  id: string | null
  /** Attributes other than the id, in source order (§10); unknown ones preserved. */
  attrs: Attribute[]
  metadata: SceneMetadataNode[]
  children: SceneContentNode[]
}

export interface SceneMetadataNode extends BaseNode {
  type: 'scene-metadata'
  key: string
  value: string    // raw value string; callers parse further if needed
  /** List items: the indented `- ` lines under a key with an empty value (§7.1). */
  items?: string[]
}

export interface ActionNode extends BaseNode {
  type: 'action'
  spans: InlineSpan[]
}

export interface CharacterNode extends BaseNode {
  type: 'character'
  name: string
  extension: string | null   // "(V.O.)", "(O.S.)", etc.
  isDual: boolean             // true if ^ suffix
  id: string | null           // from a trailing {#id} attribute block
  attrs: Attribute[]          // other attributes on the cue line (§10)
  children: DialogueContentNode[]
  // Populated only for a @cue parsed inside a {#characters} registry section
  // (§8.2) — "& key: value" lines there are metadata, not dialogue.
  metadata?: SceneMetadataNode[]
}

export interface DialogueNode extends BaseNode {
  type: 'dialogue'
  spans: InlineSpan[]
}

export interface ParentheticalNode extends BaseNode {
  type: 'parenthetical'
  text: string
}

export interface DualDialogueNode extends BaseNode {
  type: 'dual-dialogue'
  left: CharacterNode
  right: CharacterNode
}

export interface TransitionNode extends BaseNode {
  type: 'transition'
  text: string
}

export interface CenteredNode extends BaseNode {
  type: 'centered'
  text: string
}

export interface LyricsNode extends BaseNode {
  type: 'lyrics'
  spans: InlineSpan[]
}

export interface NoteNode extends BaseNode {
  type: 'note'
  text: string
}

export interface CommentNode extends BaseNode {
  type: 'comment'
  text: string
}

export interface PageBreakNode extends BaseNode {
  type: 'page-break'
}

// Inline emphasis spans
export type InlineSpan =
  | { type: 'text'; text: string }
  | { type: 'bold'; spans: InlineSpan[] }
  | { type: 'italic'; spans: InlineSpan[] }
  | { type: 'underline'; spans: InlineSpan[] }
  | { type: 'note'; text: string }

export type ContentNode =
  | SectionNode
  | SceneHeadingNode
  | ActionNode
  | CharacterNode
  | DualDialogueNode
  | TransitionNode
  | CenteredNode
  | LyricsNode
  | NoteNode
  | CommentNode
  | PageBreakNode

export type SceneContentNode =
  | ActionNode
  | CharacterNode
  | DualDialogueNode
  | TransitionNode
  | CenteredNode
  | LyricsNode
  | NoteNode
  | CommentNode
  | PageBreakNode

export type DialogueContentNode = DialogueNode | ParentheticalNode

// Fountain interop
export interface FountainImportResult {
  document: DocumentNode
  warnings: string[]
}

export interface FountainExportResult {
  text: string
  warnings: string[]   // lossy-export warnings (metadata dropped, etc.)
}

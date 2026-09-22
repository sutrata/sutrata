import { Schema } from 'prosemirror-model'
import type { NodeSpec, MarkSpec } from 'prosemirror-model'

const nodes: Record<string, NodeSpec> = {
  doc: { content: 'title_page? block+' },

  // Frontmatter rendered as an editable card at the top of the document.
  // Only valid as the first child of doc (not in the block group).
  title_page: {
    content: 'frontmatter_field+',
    toDOM: () => ['div', { class: 'cs-title-page-block' }, 0],
    parseDOM: [{ tag: 'div.cs-title-page-block' }],
  },

  frontmatter_field: {
    content: '(text | hard_break)*',
    marks: '',
    attrs: { fmKey: { default: '' } },
    toDOM: (node) => ['div', { class: 'cs-fm-field', 'data-key': node.attrs['fmKey'] as string }, 0],
    parseDOM: [{ tag: 'div.cs-fm-field', getAttrs: (dom) => ({ fmKey: (dom as HTMLElement).dataset['key'] ?? '' }) }],
  },

  scene_heading: {
    group: 'block',
    content: 'inline*',
    attrs: { id: { default: null } },
    toDOM: (node) => {
      const attrs: Record<string, string> = { class: 'cs-scene-heading' }
      if (node.attrs['id']) attrs['data-scene-id'] = node.attrs['id'] as string
      return ['div', attrs, 0]
    },
    parseDOM: [{ tag: 'div.cs-scene-heading', getAttrs: (dom) => ({ id: (dom as HTMLElement).dataset['sceneId'] ?? null }) }],
  },

  action: {
    group: 'block',
    content: 'inline*',
    toDOM: () => ['div', { class: 'cs-action' }, 0],
    parseDOM: [{ tag: 'div.cs-action' }],
  },

  character: {
    group: 'block',
    content: 'inline*',
    toDOM: () => ['div', { class: 'cs-character' }, 0],
    parseDOM: [{ tag: 'div.cs-character' }],
  },

  dialogue: {
    group: 'block',
    content: 'inline*',
    toDOM: () => ['div', { class: 'cs-dialogue' }, 0],
    parseDOM: [{ tag: 'div.cs-dialogue' }],
  },

  parenthetical: {
    group: 'block',
    content: 'inline*',
    toDOM: () => ['div', { class: 'cs-parenthetical' }, 0],
    parseDOM: [{ tag: 'div.cs-parenthetical' }],
  },

  transition: {
    group: 'block',
    content: 'inline*',
    toDOM: () => ['div', { class: 'cs-transition' }, 0],
    parseDOM: [{ tag: 'div.cs-transition' }],
  },

  centered: {
    group: 'block',
    content: 'inline*',
    toDOM: () => ['div', { class: 'cs-centered' }, 0],
    parseDOM: [{ tag: 'div.cs-centered' }],
  },

  lyrics: {
    group: 'block',
    content: 'inline*',
    toDOM: () => ['div', { class: 'cs-lyrics' }, 0],
    parseDOM: [{ tag: 'div.cs-lyrics' }],
  },

  scene_metadata: {
    group: 'block',
    content: 'inline*',
    attrs: { metaKey: { default: '' } },
    toDOM: (node) => ['div', { class: 'cs-scene-metadata', 'data-key': node.attrs['metaKey'] as string }, 0],
    parseDOM: [{ tag: 'div.cs-scene-metadata', getAttrs: (dom) => ({ metaKey: (dom as HTMLElement).dataset['key'] ?? '' }) }],
  },

  note: {
    group: 'block',
    content: 'inline*',
    toDOM: () => ['div', { class: 'cs-note' }, 0],
    parseDOM: [{ tag: 'div.cs-note' }],
  },

  comment: {
    group: 'block',
    content: 'inline*',
    toDOM: () => ['div', { class: 'cs-comment' }, 0],
    parseDOM: [{ tag: 'div.cs-comment' }],
  },

  page_break: {
    group: 'block',
    toDOM: () => ['div', { class: 'cs-page-break' }],
    parseDOM: [{ tag: 'div.cs-page-break' }],
  },

  section: {
    group: 'block',
    content: 'inline*',
    attrs: { level: { default: 1 }, id: { default: null } },
    toDOM: (node) => [`h${(node.attrs['level'] as number) + 1}`, { class: 'cs-section' }, 0],
    parseDOM: [
      { tag: 'h2.cs-section', getAttrs: () => ({ level: 1 }) },
      { tag: 'h3.cs-section', getAttrs: () => ({ level: 2 }) },
    ],
  },

  hard_break: {
    inline: true,
    group: 'inline',
    selectable: false,
    toDOM: () => ['br'],
    parseDOM: [{ tag: 'br' }],
  },

  text: { group: 'inline' },
}

const marks: Record<string, MarkSpec> = {
  bold: {
    toDOM: () => ['strong', 0],
    parseDOM: [{ tag: 'strong' }],
  },
  italic: {
    toDOM: () => ['em', 0],
    parseDOM: [{ tag: 'em' }],
  },
  underline: {
    toDOM: () => ['u', 0],
    parseDOM: [{ tag: 'u' }],
  },
  // Named note_mark, not note, since a block-level `note` node already exists
  // (whole-line [[ ]] notes) and ProseMirror forbids a name being both.
  note_mark: {
    toDOM: () => ['span', { class: 'cs-inline-note' }, 0],
    parseDOM: [{ tag: 'span.cs-inline-note' }],
  },
}

export const schema = new Schema({ nodes, marks })
export type SutraSchema = typeof schema

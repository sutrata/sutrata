import { Schema } from 'prosemirror-model'
import type { NodeSpec, MarkSpec } from 'prosemirror-model'

/**
 * Attributes (format spec §10) other than the id, kept in source order as
 * `{ key, value }` pairs so unknown ones round-trip. Serialized into the DOM
 * as JSON so copy/paste inside the editor keeps them.
 */
function readAttrs(dom: HTMLElement): unknown[] {
  try {
    const parsed: unknown = JSON.parse(dom.dataset['attrs'] ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function withAttrs(dom: Record<string, string>, node: { attrs: Record<string, unknown> }): Record<string, string> {
  const attrs = node.attrs['attrs'] as unknown[]
  if (attrs.length > 0) dom['data-attrs'] = JSON.stringify(attrs)
  return dom
}

const nodes: Record<string, NodeSpec> = {
  doc: { content: 'title_page? block+' },

  // Frontmatter rendered as an editable card at the top of the document.
  // Only valid as the first child of doc (not in the block group).
  title_page: {
    content: 'frontmatter_field+',
    // The frontmatter source this node was built from. prosemirror-to-sutra
    // re-emits it verbatim (or edits only the changed keys), so comments,
    // lists, quoting and key order the fields cannot represent survive.
    attrs: { raw: { default: null } },
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
    attrs: { id: { default: null }, attrs: { default: [] } },
    toDOM: (node) => {
      const attrs: Record<string, string> = { class: 'cs-scene-heading' }
      if (node.attrs['id']) attrs['data-scene-id'] = node.attrs['id'] as string
      return ['div', withAttrs(attrs, node), 0]
    },
    parseDOM: [{
      tag: 'div.cs-scene-heading',
      getAttrs: (dom) => ({ id: (dom as HTMLElement).dataset['sceneId'] ?? null, attrs: readAttrs(dom as HTMLElement) }),
    }],
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
    attrs: { id: { default: null }, attrs: { default: [] } },
    toDOM: (node) => {
      const attrs: Record<string, string> = { class: 'cs-character' }
      if (node.attrs['id']) attrs['data-id'] = node.attrs['id'] as string
      return ['div', withAttrs(attrs, node), 0]
    },
    parseDOM: [{
      tag: 'div.cs-character',
      getAttrs: (dom) => ({ id: (dom as HTMLElement).dataset['id'] ?? null, attrs: readAttrs(dom as HTMLElement) }),
    }],
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
    // list: the value is a `- item` list (§7.1), one item per line of content.
    attrs: { metaKey: { default: '' }, list: { default: false } },
    toDOM: (node) => {
      const attrs: Record<string, string> = { class: 'cs-scene-metadata', 'data-key': node.attrs['metaKey'] as string }
      if (node.attrs['list']) attrs['data-list'] = 'true'
      // `x-` keys belong to a tool (format spec §7.1): kept, but not shown
      // (private-metadata-plugin keeps the caret out).
      if ((node.attrs['metaKey'] as string).startsWith('x-')) attrs['data-private'] = 'true'
      return ['div', attrs, 0]
    },
    parseDOM: [{
      tag: 'div.cs-scene-metadata',
      getAttrs: (dom) => ({
        metaKey: (dom as HTMLElement).dataset['key'] ?? '',
        list: (dom as HTMLElement).dataset['list'] === 'true',
      }),
    }],
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
    attrs: { level: { default: 1 }, id: { default: null }, attrs: { default: [] } },
    toDOM: (node) => {
      const attrs: Record<string, string> = { class: 'cs-section' }
      if (node.attrs['id']) attrs['data-id'] = node.attrs['id'] as string
      return [`h${(node.attrs['level'] as number) + 1}`, withAttrs(attrs, node), 0]
    },
    parseDOM: [
      { tag: 'h2.cs-section', getAttrs: (dom) => ({ level: 1, id: (dom as HTMLElement).dataset['id'] ?? null, attrs: readAttrs(dom as HTMLElement) }) },
      { tag: 'h3.cs-section', getAttrs: (dom) => ({ level: 2, id: (dom as HTMLElement).dataset['id'] ?? null, attrs: readAttrs(dom as HTMLElement) }) },
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

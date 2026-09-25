import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node as PmNode } from 'prosemirror-model'

/**
 * Omitted scenes (format spec §7.4: `& status: omitted`): the heading is
 * struck through and followed by an OMITTED badge. The heading, number and
 * any body kept in a comment stay editable.
 */
export const omittedSceneKey = new PluginKey<DecorationSet>('omittedScene')

function decorate(doc: PmNode): DecorationSet {
  const decorations: Decoration[] = []
  let heading: { pos: number; node: PmNode } | null = null
  doc.forEach((node, pos) => {
    if (node.type.name === 'scene_heading') { heading = { pos, node }; return }
    if (node.type.name !== 'scene_metadata') { heading = null; return }
    const h = heading as { pos: number; node: PmNode } | null
    if (h && node.attrs['metaKey'] === 'status' && node.textContent.trim().toLowerCase() === 'omitted') {
      decorations.push(Decoration.node(h.pos, h.pos + h.node.nodeSize, { class: 'cs-scene-omitted' }))
      decorations.push(Decoration.widget(h.pos + h.node.nodeSize - 1, () => {
        const badge = document.createElement('span')
        badge.className = 'cs-omitted-badge'
        badge.contentEditable = 'false'
        badge.textContent = 'OMITTED'
        return badge
      }, { side: 1, key: `omitted-${h.pos}` }))
    }
  })
  return DecorationSet.create(doc, decorations)
}

export function createOmittedScenePlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: omittedSceneKey,
    state: {
      init: (_, state) => decorate(state.doc),
      apply: (tr, set) => (tr.docChanged ? decorate(tr.doc) : set),
    },
    props: { decorations: state => omittedSceneKey.getState(state) },
  })
}

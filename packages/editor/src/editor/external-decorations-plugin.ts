import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorState } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node as PmNode } from 'prosemirror-model'
import type { DocumentNode } from '@sutrata/parser'
import type { DecorationProvider, DecorationSpec, DecorationContext } from '../extensions/decorations'

/**
 * Renders DecorationProvider output (extensions/decorations.ts) in the
 * formatted editor. Anchors are { sceneId, from?, to? } with offsets into the
 * scene's text; this plugin maps them to document positions, recomputes on
 * every document change and whenever a provider signals a change, and routes
 * clicks on decorated elements to the spec's onClick (in any session mode).
 */

export const externalDecorationsKey = new PluginKey<DecorationSet>('externalDecorations')
const REFRESH = 'refresh'
const CLICK_ATTR = 'data-cs-deco'

interface SceneRange { from: number; to: number }

/** Top-level position range of every scene with an id, heading through the block before the next heading. */
export function sceneRanges(doc: PmNode): Map<string, SceneRange> {
  const ranges = new Map<string, SceneRange>()
  let open: { id: string | null; from: number } | null = null
  doc.forEach((node, offset) => {
    if (node.type.name !== 'scene_heading') return
    if (open?.id && !ranges.has(open.id)) ranges.set(open.id, { from: open.from, to: offset })
    open = { id: (node.attrs['id'] as string | null) ?? null, from: offset }
  })
  const last = open as { id: string | null; from: number } | null
  if (last?.id && !ranges.has(last.id)) ranges.set(last.id, { from: last.from, to: doc.content.size })
  return ranges
}

/** Scene text as anchors see it: blocks joined with '\n', line breaks as '\n'. */
export function textOf(doc: PmNode, range: SceneRange, to = range.to): string {
  return doc.textBetween(range.from, to, '\n', '\n')
}

/**
 * Document position for a scene-text offset. `start` bias picks the first
 * position at which `offset` characters precede (so an offset at a block
 * boundary lands at the start of the next block); `end` bias the last one.
 */
function posAt(doc: PmNode, range: SceneRange, offset: number, bias: 'start' | 'end'): number {
  // Smallest position p with at least `target` characters of scene text before it.
  const smallest = (target: number) => {
    let lo = range.from
    let hi = range.to
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (textOf(doc, range, mid).length >= target) hi = mid
      else lo = mid + 1
    }
    return lo
  }
  if (bias === 'end' || offset >= textOf(doc, range).length) return smallest(offset)
  // Just before character `offset`: one position before the point where it has been passed.
  return Math.max(range.from, smallest(offset + 1) - 1)
}

/** The top-level block containing `pos`, as a node-decoration range. */
function blockAt(doc: PmNode, pos: number): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null
  doc.forEach((node, offset) => {
    if (!found && pos >= offset && pos <= offset + node.nodeSize) found = { from: offset, to: offset + node.nodeSize }
  })
  return found
}

function toDecorations(
  doc: PmNode,
  specs: DecorationSpec[],
  ranges: Map<string, SceneRange>,
  onClick: Map<string, (e: MouseEvent) => void>,
  keyPrefix: string,
): Decoration[] {
  const out: Decoration[] = []
  specs.forEach((spec, i) => {
    const range = ranges.get(spec.anchor.sceneId)
    if (!range) return   // unknown id, or a scene without {#id}
    const clamp = (n: number) => Math.max(0, Math.min(n, textOf(doc, range).length))
    const key = `${keyPrefix}:${i}`

    if (spec.kind === 'widget') {
      const pos = spec.anchor.from === undefined ? range.from : posAt(doc, range, clamp(spec.anchor.from), 'start')
      out.push(Decoration.widget(pos, () => spec.render(), { side: spec.side ?? -1, key }))
      return
    }

    const attrs: Record<string, string> = { ...(spec.attrs ?? {}) }
    if (spec.className) attrs['class'] = spec.className
    if (spec.onClick) {
      attrs[CLICK_ATTR] = key
      onClick.set(key, spec.onClick)
    }

    if (spec.kind === 'node') {
      const block = spec.anchor.from === undefined
        ? { from: range.from, to: range.from + doc.nodeAt(range.from)!.nodeSize }
        : blockAt(doc, posAt(doc, range, clamp(spec.anchor.from), 'start'))
      if (block) out.push(Decoration.node(block.from, block.to, attrs))
      return
    }

    const from = spec.anchor.from === undefined ? range.from : posAt(doc, range, clamp(spec.anchor.from), 'start')
    const to = spec.anchor.to === undefined ? range.to : posAt(doc, range, clamp(spec.anchor.to), 'end')
    if (to > from) out.push(Decoration.inline(from, to, attrs))
  })
  return out
}

export function createExternalDecorationsPlugin(
  providers: readonly DecorationProvider[],
  getAst: () => DocumentNode,
): Plugin<DecorationSet> {
  const onClick = new Map<string, (e: MouseEvent) => void>()

  const compute = (state: EditorState): DecorationSet => {
    onClick.clear()
    const ranges = sceneRanges(state.doc)
    const ctx: DecorationContext = {
      ast: getAst(),
      sceneText: id => {
        const range = ranges.get(id)
        return range ? textOf(state.doc, range) : null
      },
    }
    const decorations = providers.flatMap(p => {
      try {
        return toDecorations(state.doc, p.getDecorations(ctx), ranges, onClick, p.id)
      } catch (e) {
        console.error(`DecorationProvider ${p.id} failed:`, e)
        return []
      }
    })
    return DecorationSet.create(state.doc, decorations)
  }

  return new Plugin<DecorationSet>({
    key: externalDecorationsKey,
    state: {
      init: (_, state) => compute(state),
      apply: (tr, set, _old, state) => (tr.docChanged || tr.getMeta(externalDecorationsKey) === REFRESH ? compute(state) : set),
    },
    view(view) {
      const offs = providers.map(p => p.subscribe(() => {
        if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(externalDecorationsKey, REFRESH))
      }))
      return { destroy: () => offs.forEach(off => off()) }
    },
    props: {
      decorations: state => externalDecorationsKey.getState(state),
      handleDOMEvents: {
        click(_view, event) {
          const el = (event.target as Element | null)?.closest?.(`[${CLICK_ATTR}]`)
          const handler = el && onClick.get(el.getAttribute(CLICK_ATTR) ?? '')
          if (!handler) return false
          handler(event)
          return true
        },
      },
    },
  })
}

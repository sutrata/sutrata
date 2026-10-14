import { useEffect, useMemo, useState } from 'react'
import { useDocument } from '../context/DocumentContext'
import { getEditorView, getSourceView, subscribe } from '../editor/editor-bus'
import { buildSceneList } from '../navigator/scene-list'
import type { PanelRenderContext } from '../extensions/panel-registry'

type Active = { id: string | null; index: number | null; inTitlePage: boolean }

/** End offset of the `---` front matter block at the top of the text, or -1 if there is none. */
function frontMatterEnd(text: string): number {
  if (!/^---[ \t]*\r?\n/.test(text)) return -1
  const close = /\r?\n---[ \t]*(?:\r?\n|$)/.exec(text.slice(3))
  return close ? 3 + close.index + close[0].length : -1
}

/** The scene containing the caret (formatted or source editor): its number, if it has one, its index among the scenes, and whether the caret is in the title page. */
function currentScene(text: string): Active {
  const view = getEditorView()
  if (view) {
    const caret = view.state.selection.from
    const $from = view.state.selection.$from
    const inTitlePage = $from.depth >= 1 && $from.node(1).type.name === 'title_page'
    let id: string | null = null
    let index: number | null = null
    let n = 0
    view.state.doc.forEach((node, offset) => {
      if (node.type.name !== 'scene_heading') return
      if (offset < caret) { id = (node.attrs['id'] as string | null) ?? null; index = n }
      n++
    })
    return { id, index, inTitlePage }
  }
  const source = getSourceView()
  if (source) {
    const caret = source.state.selection.main.head
    const fmEnd = frontMatterEnd(text)
    const inTitlePage = fmEnd >= 0 && caret < fmEnd
    let id: string | null = null
    let index: number | null = null
    buildSceneList(text).forEach((scene, i) => { if (scene.textOffset <= caret) { id = scene.id; index = i } })
    return { id, index, inTitlePage }
  }
  return { id: null, index: null, inTitlePage: false }
}

/** The context panels render with; re-computed on document and selection changes. */
export function usePanelContext(): PanelRenderContext {
  const { ast, text } = useDocument()
  const [active, setActive] = useState<Active>({ id: null, index: null, inTitlePage: false })

  useEffect(() => {
    const update = () => setActive(prev => {
      const next = currentScene(text)
      return prev.id === next.id && prev.index === next.index && prev.inTitlePage === next.inTitlePage ? prev : next
    })
    update()
    return subscribe(update)
  }, [text])

  const sceneIds = useMemo(
    () => ast.children.flatMap(n => (n.type === 'scene-heading' && n.id ? [n.id] : [])),
    [ast],
  )
  return useMemo(
    () => ({ ast, sceneIds, activeSceneId: active.id, activeSceneIndex: active.index, inTitlePage: active.inTitlePage }),
    [ast, sceneIds, active],
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useDocument } from '../context/DocumentContext'
import { getEditorView, getSourceView, subscribe } from '../editor/editor-bus'
import { buildSceneList } from '../navigator/scene-list'
import type { PanelRenderContext } from '../extensions/panel-registry'

/** The scene containing the caret (formatted or source editor): its number, if it has one, and its index among the scenes. */
function currentScene(text: string): { id: string | null; index: number | null } {
  const view = getEditorView()
  if (view) {
    const caret = view.state.selection.from
    let id: string | null = null
    let index: number | null = null
    let n = 0
    view.state.doc.forEach((node, offset) => {
      if (node.type.name !== 'scene_heading') return
      if (offset < caret) { id = (node.attrs['id'] as string | null) ?? null; index = n }
      n++
    })
    return { id, index }
  }
  const source = getSourceView()
  if (source) {
    const caret = source.state.selection.main.head
    let id: string | null = null
    let index: number | null = null
    buildSceneList(text).forEach((scene, i) => { if (scene.textOffset <= caret) { id = scene.id; index = i } })
    return { id, index }
  }
  return { id: null, index: null }
}

/** The context panels render with; re-computed on document and selection changes. */
export function usePanelContext(): PanelRenderContext {
  const { ast, text } = useDocument()
  const [active, setActive] = useState<{ id: string | null; index: number | null }>({ id: null, index: null })

  useEffect(() => {
    const update = () => setActive(prev => {
      const next = currentScene(text)
      return prev.id === next.id && prev.index === next.index ? prev : next
    })
    update()
    return subscribe(update)
  }, [text])

  const sceneIds = useMemo(
    () => ast.children.flatMap(n => (n.type === 'scene-heading' && n.id ? [n.id] : [])),
    [ast],
  )
  return useMemo(
    () => ({ ast, sceneIds, activeSceneId: active.id, activeSceneIndex: active.index }),
    [ast, sceneIds, active],
  )
}

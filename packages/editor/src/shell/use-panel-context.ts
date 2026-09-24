import { useEffect, useMemo, useState } from 'react'
import { useDocument } from '../context/DocumentContext'
import { getEditorView, getSourceView, subscribe } from '../editor/editor-bus'
import { buildSceneList } from '../navigator/scene-list'
import type { PanelRenderContext } from '../extensions/panel-registry'

/** Id of the scene containing the caret (formatted or source editor), if it has one. */
function currentSceneId(text: string): string | null {
  const view = getEditorView()
  if (view) {
    const caret = view.state.selection.from
    let id: string | null = null
    view.state.doc.forEach((node, offset) => {
      if (offset < caret && node.type.name === 'scene_heading') id = (node.attrs['id'] as string | null) ?? null
    })
    return id
  }
  const source = getSourceView()
  if (source) {
    const caret = source.state.selection.main.head
    let id: string | null = null
    for (const scene of buildSceneList(text)) if (scene.textOffset <= caret) id = scene.id
    return id
  }
  return null
}

/** The context panels render with; re-computed on document and selection changes. */
export function usePanelContext(): PanelRenderContext {
  const { ast, text } = useDocument()
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)

  useEffect(() => {
    const update = () => setActiveSceneId(currentSceneId(text))
    update()
    return subscribe(update)
  }, [text])

  const sceneIds = useMemo(
    () => ast.children.flatMap(n => (n.type === 'scene-heading' && n.id ? [n.id] : [])),
    [ast],
  )
  return useMemo(() => ({ ast, sceneIds, activeSceneId }), [ast, sceneIds, activeSceneId])
}

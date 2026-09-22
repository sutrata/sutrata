import React from 'react'
import { useDocument } from '../context/DocumentContext'
import { extractWorkflowData } from '../file/workflow-reports'
import { getEditorView } from '../editor/editor-bus'
import { schema } from '../editor/schema'

interface Props {
  onClose: () => void
}

export function StatisticsDialog({ onClose }: Props) {
  const { ast, text, setText } = useDocument()
  const { scenes, characters } = extractWorkflowData(ast)

  const handleUpdateActor = (charName: string, actorName: string) => {
    const cleanChar = charName.trim().toUpperCase()
    if (!cleanChar) return

    const view = getEditorView()
    const key = `characters.${cleanChar}`

    if (view) {
      let tr = view.state.tr
      let titlePagePos: number | null = null
      view.state.doc.forEach((node, offset) => {
        if (node.type.name === 'title_page') titlePagePos = offset
      })

      if (titlePagePos !== null) {
        const tpNode = view.state.doc.nodeAt(titlePagePos)!
        let existingPos: number | null = null
        let pos = titlePagePos + 1 // inside title_page

        tpNode.forEach((field) => {
          if (field.attrs['fmKey'] === key) {
            existingPos = pos
          }
          pos += field.nodeSize
        })

        if (existingPos !== null) {
          const fieldNode = view.state.doc.nodeAt(existingPos)!
          if (actorName.trim() === '') {
            tr = tr.delete(existingPos, existingPos + fieldNode.nodeSize)
          } else {
            tr = tr.replaceWith(
              existingPos + 1,
              existingPos + fieldNode.nodeSize - 1,
              schema.text(actorName)
            )
          }
        } else if (actorName.trim() !== '') {
          const insertPos = titlePagePos + tpNode.nodeSize - 1 // end of title_page
          const newField = schema.nodes['frontmatter_field']!.create(
            { fmKey: key },
            schema.text(actorName)
          )
          tr = tr.insert(insertPos, newField)
        }
        view.dispatch(tr)
      } else {
        const freshText = updateActorInText(text, cleanChar, actorName)
        setText(freshText)
      }
    } else {
      const freshText = updateActorInText(text, cleanChar, actorName)
      setText(freshText)
    }
  }

  // Word count helper
  const wordCount = text.split(/\s+/).filter(Boolean).length

  // Sum up estimated duration
  let totalMinutes = 0
  scenes.forEach(s => {
    const minMatch = /(\d+)/.exec(s.estDuration)
    if (minMatch && minMatch[1]) {
      totalMinutes += Number.parseInt(minMatch[1], 10)
    }
  })

  return (
    <div
      className="cs-dialog-overlay"
      role="presentation"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="cs-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cs-stats-dialog-title"
        style={{ maxWidth: '640px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="cs-panel-header">
          <span id="cs-stats-dialog-title" className="cs-panel-title">Script Statistics</span>
          <button className="cs-panel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="cs-panel-body" style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
          <div className="cs-stats-summary-grid">
            <div className="cs-stats-card">
              <div className="cs-stats-card-val">{scenes.length}</div>
              <div className="cs-stats-card-lbl">Scenes</div>
            </div>
            <div className="cs-stats-card">
              <div className="cs-stats-card-val">{wordCount.toLocaleString()}</div>
              <div className="cs-stats-card-lbl">Words</div>
            </div>
            <div className="cs-stats-card">
              <div className="cs-stats-card-val">
                {totalMinutes ? `${totalMinutes} min` : 'TBD'}
              </div>
              <div className="cs-stats-card-lbl">Est. Duration</div>
            </div>
          </div>

          <div className="cs-stats-section-hdr">
            Cast List &amp; Occurrences ({characters.length})
          </div>

          {characters.length === 0 ? (
            <div style={{ color: 'var(--cs-ui-text-light-muted, #8c897f)', fontStyle: 'italic', fontSize: '12px' }}>
              No character cues detected in the screenplay yet.
            </div>
          ) : (
            <table className="cs-stats-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', width: '35%' }}>Character</th>
                  <th style={{ textAlign: 'left' }}>Actor</th>
                  <th style={{ textAlign: 'center', width: '15%' }}>Scenes</th>
                </tr>
              </thead>
              <tbody>
                {characters.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: '600' }}>{c.name}</td>
                    <td>
                      <input
                        type="text"
                        className="cs-stats-actor-input"
                        value={c.actor}
                        onChange={(e) => handleUpdateActor(c.name, e.target.value)}
                        placeholder="Assign actor..."
                        aria-label={`Actor for ${c.name}`}
                      />
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '500' }}>{c.sceneCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div
          style={{
            borderTop: '1px solid var(--cs-ui-border-light-subtle, #eeece4)',
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 20px',
            background: 'var(--cs-ui-bg-panel-subtle, #f4f2ea)',
          }}
        >
          <button
            type="button"
            className="cs-confirm-btn-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function updateActorInText(text: string, charName: string, actorName: string): string {
  const lines = text.split('\n')
  const fmStartIndex = lines.indexOf('---')
  if (fmStartIndex === -1) {
    return `---\ncharacters:\n  ${charName}: ${actorName}\n---\n\n${text}`
  }
  const fmEndIndex = lines.indexOf('---', fmStartIndex + 1)
  if (fmEndIndex === -1) return text

  const fmLines = lines.slice(fmStartIndex + 1, fmEndIndex)
  let charsLineIdx = -1
  for (let i = 0; i < fmLines.length; i++) {
    if (fmLines[i]!.trim() === 'characters:') {
      charsLineIdx = i
      break
    }
  }

  const cleanChar = charName.toUpperCase()
  if (charsLineIdx === -1) {
    if (actorName.trim() !== '') {
      fmLines.push('characters:')
      fmLines.push(`  ${cleanChar}: ${actorName}`)
    }
  } else {
    let insertIdx = charsLineIdx + 1
    let charLineIdx = -1
    while (insertIdx < fmLines.length) {
      const line = fmLines[insertIdx]!
      if (!line.startsWith('  ') && line.trim() !== '') {
        break
      }
      const match = /^\s+([A-Za-z0-9_ -]+)\s*:(.*)/.exec(line)
      if (match && match[1]?.trim().toUpperCase() === cleanChar) {
        charLineIdx = insertIdx
        break
      }
      insertIdx++
    }

    if (charLineIdx !== -1) {
      if (actorName.trim() === '') {
        fmLines.splice(charLineIdx, 1)
      } else {
        fmLines[charLineIdx] = `  ${cleanChar}: ${actorName}`
      }
    } else if (actorName.trim() !== '') {
      fmLines.splice(insertIdx, 0, `  ${cleanChar}: ${actorName}`)
    }
  }

  const newLines = [
    ...lines.slice(0, fmStartIndex + 1),
    ...fmLines,
    ...lines.slice(fmEndIndex)
  ]
  return newLines.join('\n')
}

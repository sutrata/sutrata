import { describe, it, expect } from 'vitest'
import { parse } from '@sutrata/parser'
import { exportToDocx } from '../src/file/docx-exporter'
import { importDocx } from '../src/file/docx-importer'
import JSZip from 'jszip'

const testSutra = `---
title: Test Movie
author: Writer Name
---

## Scene 1 {#1A}

Action with **bold**, *italic*, and _underline_ text.

@JOHN (V.O.)
Hello Mary.

@MARY
(smiling)
Hi John.

@JOHN
Dual dialogue left.

@MARY ^
Dual dialogue right.

>> CUT TO:

>> THE END <<

~ La la la

[[ Note text ]]

<!-- Comment text -->

===

# A Section

Final action line.
`

async function roundTrip(source: string) {
  const ast = parse(source)
  const blob = await exportToDocx(ast)
  const buffer = await blob.arrayBuffer()
  return importDocx(buffer)
}

describe('docx-importer', () => {
  it('reconstructs the screenplay body from an exported docx', async () => {
    const { bodyText, warnings } = await roundTrip(testSutra)
    expect(bodyText).not.toBeNull()

    // Reparse the reconstructed body (no frontmatter) and check it matches structurally.
    const reparsed = parse(bodyText!)
    const original = parse(testSutra)

    expect(reparsed.children).toHaveLength(original.children.length)

    const scene = reparsed.children[0]
    expect(scene?.type).toBe('scene-heading')
    if (scene?.type === 'scene-heading') {
      expect(scene.text).toBe('SCENE 1')
      expect(scene.id).toBe('1A')

      const action = scene.children[0]
      expect(action?.type).toBe('action')
      if (action?.type === 'action') {
        expect(action.spans).toEqual([
          { type: 'text', text: 'Action with ' },
          { type: 'bold', spans: [{ type: 'text', text: 'bold' }] },
          { type: 'text', text: ', ' },
          { type: 'italic', spans: [{ type: 'text', text: 'italic' }] },
          { type: 'text', text: ', and ' },
          { type: 'underline', spans: [{ type: 'text', text: 'underline' }] },
          { type: 'text', text: ' text.' },
        ])
      }

      const john = scene.children[1]
      expect(john?.type).toBe('character')
      if (john?.type === 'character') {
        expect(john.name).toBe('JOHN')
        expect(john.extension).toBe('(V.O.)')
      }

      const mary = scene.children[2]
      expect(mary?.type).toBe('character')
      if (mary?.type === 'character') {
        expect(mary.children[0]).toMatchObject({ type: 'parenthetical', text: 'smiling' })
      }

      const dual = scene.children[3]
      expect(dual?.type).toBe('dual-dialogue')
      if (dual?.type === 'dual-dialogue') {
        expect(dual.left.name).toBe('JOHN')
        expect(dual.right.name).toBe('MARY')
        expect(dual.right.isDual).toBe(true)
      }

      expect(scene.children[4]).toMatchObject({ type: 'transition', text: 'CUT TO:' })
      expect(scene.children[5]).toMatchObject({ type: 'centered', text: 'THE END' })
      expect(scene.children[6]).toMatchObject({ type: 'lyrics' })
      expect(scene.children[7]).toMatchObject({ type: 'note', text: 'Note text' })
      expect(scene.children[8]).toMatchObject({ type: 'comment', text: 'Comment text' })
      expect(scene.children[9]).toMatchObject({ type: 'page-break' })
    }

    const section = reparsed.children[1]
    expect(section?.type).toBe('section')
    if (section?.type === 'section') {
      expect(section.text).toBe('A Section')
    }
    expect(reparsed.children[2]).toMatchObject({ type: 'action' })

    // Title page is intentionally not reimported.
    expect(warnings.some(w => w.toLowerCase().includes('title page'))).toBe(true)
  })

  it('returns null bodyText and a warning for a non-Sutrata docx', async () => {
    const ast = parse('---\ntitle: Empty\n---\n')
    const blob = await exportToDocx(ast)
    const buffer = await blob.arrayBuffer()
    const { bodyText, warnings } = await importDocx(buffer)
    expect(bodyText).toBeNull()
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('throws for a file that is not a docx', async () => {
    const buffer = new TextEncoder().encode('not a docx').buffer
    await expect(importDocx(buffer)).rejects.toThrow()
  })

  it('splits the scene id from the heading when Word normalizes the tab to <w:tab/>', async () => {
    // docx.js (the exporter) writes a literal tab character inside <w:t>. Word, when it
    // resaves the file, normalizes that into a <w:tab/> element instead — reproduce that
    // shape directly rather than going through exportToDocx.
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p>
<w:pPr><w:pStyle w:val="CineSceneHeading"/></w:pPr>
<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">EXT. ROAD-RAIN EFFECT - MORNING</w:t></w:r>
<w:r><w:tab/></w:r>
<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">1A</w:t></w:r>
</w:p>
</w:body>
</w:document>`
    const zip = new JSZip()
    zip.file('word/document.xml', documentXml)
    const buffer = await zip.generateAsync({ type: 'arraybuffer' })

    const { bodyText } = await importDocx(buffer)
    expect(bodyText).toBe('## EXT. ROAD-RAIN EFFECT - MORNING {#1A}')
  })
})

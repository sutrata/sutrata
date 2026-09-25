import { describe, it, expect } from 'vitest'
import { importFountain, exportFountain } from '../src/fountain.js'
import type { SceneHeadingNode } from '../src/types.js'

describe('importFountain', () => {
  it('imports a scene heading', () => {
    const { document, warnings } = importFountain('INT. OFFICE - DAY\n\nAction.\n')
    expect(document.children[0]?.type).toBe('scene-heading')
    expect(warnings).toHaveLength(0)
  })

  it('imports ALL-CAPS character cue', () => {
    const { document } = importFountain('INT. OFFICE - DAY\n\nJOHN\nHello.\n')
    const scene = document.children[0] as SceneHeadingNode
    expect(scene.children[0]?.type).toBe('character')
  })

  it('imports Fountain transition ending with TO:', () => {
    const { document } = importFountain('INT. OFFICE - DAY\n\nAction.\n\nCUT TO:\n')
    const scene = document.children[0] as SceneHeadingNode
    expect(scene.children.some(n => n.type === 'transition')).toBe(true)
  })

  it('imports Fountain title page', () => {
    const { document } = importFountain('Title: My Film\nAuthor: Alice\n\nINT. OFFICE - DAY\n\nAction.\n')
    expect(document.frontmatter?.data['title']).toBe('My Film')
  })

  it('imports forced scene heading with leading dot', () => {
    const { document } = importFountain('.SUPER: "1985"\n\nAction.\n')
    expect(document.children[0]?.type).toBe('scene-heading')
  })

  it('imports @-forced non-Latin character cue', () => {
    const { document } = importFountain('EXT. காடு - பகல்\n\n@டேனியல்\nசொல்லுங்க சார்.\n')
    const scene = document.children[0] as SceneHeadingNode
    expect(scene.children[0]?.type).toBe('character')
    expect((scene.children[0] as import('../src/types.js').CharacterNode).name).toBe('டேனியல்')
  })

  it('strips Fountain scene number #num# from scene heading text', () => {
    const { document } = importFountain('EXT. காடு - பகல் #1#\n\nAction.\n')
    const scene = document.children[0] as SceneHeadingNode
    expect(scene.text).toBe('EXT. காடு - பகல்')
    expect(scene.id).toBe('1')
  })

  it('handles multiline title-page values (indented continuation)', () => {
    const src = 'Title:\n    **கரவொலி**\nAuthor: Alice\n\nINT. OFFICE - DAY\n\nAction.\n'
    const { document } = importFountain(src)
    expect(document.frontmatter?.data['title']).toBe('**கரவொலி**')
  })
  it('imports Fountain synopsis (= synopsis)', () => {
    const { document } = importFountain('INT. OFFICE - DAY\n\n= This is a synopsis\n\nAction.\n')
    const scene = document.children[0] as SceneHeadingNode
    const meta = scene.metadata.find(m => m.key === 'synopsis')
    expect(meta?.value).toBe('This is a synopsis')
  })
})

describe('exportFountain', () => {
  it('exports a scene heading in Fountain format', () => {
    const { document } = importFountain('INT. OFFICE - DAY\n\nAction.\n')
    const { text, warnings } = exportFountain(document)
    expect(text).toContain('INT. OFFICE - DAY')
    expect(warnings).toHaveLength(0)
  })

  it('exports Latin character cue with @ sigil (Fountain forced character)', () => {
    const { document } = importFountain('INT. OFFICE - DAY\n\nJOHN\nHello.\n')
    const { text } = exportFountain(document)
    expect(text).toContain('@JOHN')
  })

  it('exports non-Latin character cue with @ sigil, preserving name', () => {
    const { document } = importFountain('INT. OFFICE - DAY\n\nJOHN\nHello.\n')
    // Simulate a non-Latin character name (as would come from Sutra @मीरा)
    const scene = document.children[0] as SceneHeadingNode
    const charNode = scene.children[0] as import('../src/types.js').CharacterNode
    charNode.name = 'मीरा'
    const { text } = exportFountain(document)
    expect(text).toContain('@मीरा')
  })

  it('warns when exporting metadata (lossy)', () => {
    const { document } = importFountain('INT. OFFICE - DAY\n\nAction.\n')
    const scene = document.children[0] as SceneHeadingNode
    scene.metadata.push({ type: 'scene-metadata', raw: '& actors: John', key: 'actors', value: 'John' })
    const { warnings } = exportFountain(document)
    expect(warnings.some(w => w.includes('metadata'))).toBe(true)
  })

  it('drops tool-private x- metadata without a warning', () => {
    const { document } = importFountain('INT. OFFICE - DAY\n\nAction.\n')
    const scene = document.children[0] as SceneHeadingNode
    scene.metadata.push({ type: 'scene-metadata', raw: '& x-sc-scene-id: 3f2a', key: 'x-sc-scene-id', value: '3f2a' })
    const { text, warnings } = exportFountain(document)
    expect(warnings).toEqual([])
    expect(text).not.toContain('3f2a')
  })

  it('exports & synopsis: metadata as Fountain synopsis (= synopsis)', () => {
    const { document } = importFountain('INT. OFFICE - DAY\n\nAction.\n')
    const scene = document.children[0] as SceneHeadingNode
    scene.metadata.push({ type: 'scene-metadata', raw: '& synopsis: text', key: 'synopsis', value: 'text' })
    const { text, warnings } = exportFountain(document)
    expect(text).toContain('= text')
    expect(warnings.some(w => w.includes('metadata'))).toBe(false)
  })
})

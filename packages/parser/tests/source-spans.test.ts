import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parse, parseWithSpans } from '../src/parser.js'
import { serialize } from '../src/serializer.js'
import { tokenize } from '../src/lexer.js'
import type { ContentNode } from '../src/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFORMANCE_DIR = join(__dirname, '../conformance')
const corpus = readdirSync(CONFORMANCE_DIR)
  .filter(f => f.endsWith('.sutra'))
  .map(f => ({ name: f, source: readFileSync(join(CONFORMANCE_DIR, f), 'utf-8') }))

function stripRaw(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripRaw)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'raw').map(([k, v]) => [k, stripRaw(v)]))
  }
  return value
}

const isHeading = (n: ContentNode) => n.type === 'section' || n.type === 'scene-heading'

/** Cut `source` at the start of every section and scene heading (OSS spec §11.7). */
function cutAtHeadings(source: string): string[] {
  const { document, children } = parseWithSpans(source)
  const cuts = children.filter((_, i) => isHeading(document.children[i]!)).map(s => s.start)
  const pieces: string[] = []
  let pos = 0
  for (const cut of cuts) {
    if (cut > 0) pieces.push(source.slice(pos, cut))
    pos = cut
  }
  pieces.push(source.slice(pos))
  return pieces
}

/** The span contract, checked on any source. */
function checkSpans(source: string): void {
  const { document, frontmatter, children } = parseWithSpans(source)
  expect(stripRaw(document)).toEqual(stripRaw(parse(source)))
  expect(children).toHaveLength(document.children.length)

  if (frontmatter) {
    const text = source.slice(frontmatter.start, frontmatter.end)
    expect(frontmatter.start).toBe(0)
    expect(text.startsWith('---')).toBe(true)
    expect(text.endsWith('---')).toBe(true)
  }

  // Spans are in order and the text between them is blank.
  let pos = frontmatter ? frontmatter.end : 0
  for (const span of children) {
    expect(span.start).toBeGreaterThanOrEqual(pos)
    expect(span.end).toBeGreaterThan(span.start)
    expect(source.slice(pos, span.start).trim()).toBe('')
    pos = span.end
  }
  expect(source.slice(pos).trim()).toBe('')

  children.forEach((span, i) => {
    const node = document.children[i]!
    const text = source.slice(span.start, span.end)
    // Each span starts at a line start and ends at a line end.
    expect(span.start === 0 || source[span.start - 1] === '\n').toBe(true)
    expect(span.end === source.length || /^\r?\n/.test(source.slice(span.end))).toBe(true)
    if (isHeading(node)) {
      // A heading span starts on its heading line and parses back to the same node.
      expect(tokenize(text.split(/\r?\n/)[0]!)[0]!.type).toBe(node.type)
      const alone = parse(text)
      expect(alone.children).toHaveLength(1)
      expect(stripRaw(alone.children[0])).toEqual(stripRaw(node))
    }
  })

  // Cutting at headings and joining gives the source back; parsing the pieces
  // separately gives the same nodes as parsing the whole.
  const pieces = cutAtHeadings(source)
  expect(pieces.join('')).toBe(source)
  pieces.slice(1).forEach(p => expect(p.startsWith('#')).toBe(true))
  const parsed = pieces.map(p => parse(p))
  expect(stripRaw(parsed[0]!.frontmatter)).toEqual(stripRaw(document.frontmatter))
  expect(stripRaw(parsed.flatMap(d => d.children))).toEqual(stripRaw(document.children))
}

describe('parseWithSpans', () => {
  for (const { name, source } of corpus) {
    it(`${name}: each span is its node's serialized text`, () => {
      const { document, children } = parseWithSpans(source)
      children.forEach((span, i) => {
        const alone = serialize({ type: 'document', frontmatter: null, children: [document.children[i]!] })
        expect(source.slice(span.start, span.end) + '\n').toBe(alone)
      })
    })

    it(`${name}: span contract holds`, () => checkSpans(source))
    it(`${name}: span contract holds with CRLF`, () => checkSpans(source.replace(/\n/g, '\r\n')))
    it(`${name}: span contract holds with extra blank lines`, () =>
      checkSpans('\n\n' + source.replace(/\n\n/g, '\n\n\n\n')))
  }

  it('gives offsets into the original CRLF source', () => {
    const src = '---\r\ntitle: X\r\n---\r\n\r\n## INT. A\r\n\r\nAction.\r\n\r\n## INT. B\r\n'
    const { frontmatter, children } = parseWithSpans(src)
    expect(src.slice(frontmatter!.start, frontmatter!.end)).toBe('---\r\ntitle: X\r\n---')
    expect(children.map(s => src.slice(s.start, s.end))).toEqual(['## INT. A\r\n\r\nAction.', '## INT. B'])
  })

  it('does not cut at a heading inside a multi-line comment', () => {
    const src = '## INT. A\n\n<!--\n## INT. NOT A SCENE\n\n# Nor a section\n-->\n\nAction.\n\n# Act Two\n'
    const { document, children } = parseWithSpans(src)
    expect(document.children.map(n => n.type)).toEqual(['scene-heading', 'section'])
    expect(src.slice(children[0]!.start, children[0]!.end)).toBe(
      '## INT. A\n\n<!--\n## INT. NOT A SCENE\n\n# Nor a section\n-->\n\nAction.')
    checkSpans(src)
  })

  it('keeps scene metadata split by blank lines inside the scene span', () => {
    const src = '## INT. A {#1}\n& x-sc-scene-id: 3f2a\n\n& synopsis: s\n\nAction.\n\n## INT. B {#2}\n'
    const { children } = parseWithSpans(src)
    expect(src.slice(children[0]!.start, children[0]!.end)).toBe(
      '## INT. A {#1}\n& x-sc-scene-id: 3f2a\n\n& synopsis: s\n\nAction.')
  })

  it('handles Tamil text and text before the first heading', () => {
    const src = 'முன்னுரை.\n\n## உள். ரயில் நிலையம் - இரவு {#12}\n\n@மீரா\nவணக்கம்.\n'
    const { document, children } = parseWithSpans(src)
    expect(document.children.map(n => n.type)).toEqual(['action', 'scene-heading'])
    expect(src.slice(children[1]!.start, children[1]!.end)).toBe(
      '## உள். ரயில் நிலையம் - இரவு {#12}\n\n@மீரா\nவணக்கம்.')
    checkSpans(src)
  })

  it('holds for generated documents', () => {
    const block = fc.constantFrom(
      '## INT. OFFICE - DAY {#1}', '## உள். வீடு - பகல் {#2A}', '##',
      '# ACT ONE', '# Characters {#characters}', '# Synopsis {#synopsis}',
      '& x-sc-scene-id: 3f2a9c1e', '& synopsis: A short one.\n& actor: X',
      '@MEERA\n(quietly)\nHello.', '@RAVI ^\nAnd hello.', '@மீரா\nவணக்கம்.',
      'Plain action.', 'Action on\ntwo lines.', '### Deeper heading',
      '<!-- one-line comment -->', '<!--\n## INT. HIDDEN\n\n# HIDDEN\n-->',
      '===', '>> CUT TO:', '>> THE END <<', '~ a lyric line', '[[a note]]',
    )
    const separator = fc.constantFrom('\n\n', '\n\n\n', '\n\n\n\n')
    const doc = fc.record({
      frontmatter: fc.boolean(),
      blocks: fc.array(fc.tuple(block, separator), { maxLength: 25 }),
      crlf: fc.boolean(),
      trailing: fc.constantFrom('', '\n', '\n\n'),
    }).map(({ frontmatter, blocks, crlf, trailing }) => {
      let text = (frontmatter ? '---\ntitle: T\nx-sc-base-commit: abc\n---\n' : '')
        + blocks.map(([b, sep], i) => (i === 0 ? '' : sep) + b).join('') + trailing
      if (crlf) text = text.replace(/\n/g, '\r\n')
      return text
    })
    fc.assert(fc.property(doc, source => { checkSpans(source) }), { numRuns: 500 })
  })
})

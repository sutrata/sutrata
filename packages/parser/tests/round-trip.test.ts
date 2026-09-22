import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parse } from '../src/parser.js'
import { serialize } from '../src/serializer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFORMANCE_DIR = join(__dirname, '../conformance')

describe('round-trip', () => {
  const files = readdirSync(CONFORMANCE_DIR).filter(f => f.endsWith('.sutra'))

  it('conformance directory has at least one .sutra fixture', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`round-trips ${file} (single-blank-line-separated source)`, () => {
      const source = readFileSync(join(CONFORMANCE_DIR, file), 'utf-8')
      const doc = parse(source)
      const output = serialize(doc)
      expect(output).toBe(source)
    })
  }

  it('preserves unknown metadata keys', () => {
    const src = '## SC1\n& custom-prop: value\n& another: 123\n\nAction.\n'
    expect(serialize(parse(src))).toBe(src)
  })

  it('preserves unknown attributes in scene heading id slot', () => {
    const src = '## INT. OFFICE - DAY {#sc1 data-x="foo"}\n\nAction.\n'
    expect(serialize(parse(src))).toBe(src)
  })
})

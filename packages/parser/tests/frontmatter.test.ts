import { describe, it, expect } from 'vitest'
import { parseFrontmatter, serializeFrontmatter } from '../src/frontmatter.js'

describe('parseFrontmatter', () => {
  it('returns null when no frontmatter present', () => {
    expect(parseFrontmatter('## Scene one\n\nAction.')).toBeNull()
  })

  it('parses a simple frontmatter block', () => {
    const input = '---\ntitle: My Film\nauthor: Alice\n---\n\n## Scene'
    const result = parseFrontmatter(input)
    expect(result).not.toBeNull()
    expect(result!.data['title']).toBe('My Film')
    expect(result!.data['author']).toBe('Alice')
  })

  it('preserves raw source text exactly', () => {
    const fm = '---\ntitle: My Film\n---\n'
    const result = parseFrontmatter(fm + '\n## Scene')
    expect(result!.raw).toBe(fm)
  })

  it('preserves unknown keys', () => {
    const input = '---\ntitle: X\ncustom-key: some value\n---\n'
    const result = parseFrontmatter(input)
    expect(result!.data['custom-key']).toBe('some value')
  })

  it('handles multilingual title map', () => {
    const input = '---\ntitle:\n  en: Last Train\n  hi: आख़िरी ट्रेन\n---\n'
    const result = parseFrontmatter(input)
    expect((result!.data['title'] as Record<string,string>)['hi']).toBe('आख़िरी ट्रेन')
  })

  it('handles CRLF line endings', () => {
    const input = '---\r\ntitle: My Film\r\nauthor: Alice\r\n---\r\n\r\n## Scene'
    const result = parseFrontmatter(input)
    expect(result).not.toBeNull()
    expect(result!.data['title']).toBe('My Film')
    expect(result!.data['author']).toBe('Alice')
  })

  it('handles closing fence at EOF with no trailing newline', () => {
    const input = '---\ntitle: X\n---'
    const result = parseFrontmatter(input)
    expect(result).not.toBeNull()
    expect(result!.data['title']).toBe('X')
    // raw should be exactly the input (no phantom newline appended)
    expect(result!.raw).toBe(input)
  })
})

describe('serializeFrontmatter', () => {
  it('round-trips a frontmatter node back to its raw text', () => {
    const raw = '---\ntitle: My Film\nauthor: Alice\n---\n'
    const node = parseFrontmatter(raw + '\n## Scene')!
    expect(serializeFrontmatter(node)).toBe(raw)
  })
})

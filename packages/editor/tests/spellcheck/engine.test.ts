import { describe, it, expect } from 'vitest'
import { SpellEngine } from '../../src/spellcheck/engine'

const enc = (s: string) => new TextEncoder().encode(s)

describe('SpellEngine (real Hunspell)', () => {
  it('rejects words missing from the dictionary and applies affix rules', async () => {
    const engine = new SpellEngine()
    await engine.load('xx', async () => ({
      aff: enc('SET UTF-8\nSFX S Y 1\nSFX S 0 s .\n'),
      dic: enc('2\ncat/S\nவணக்கம்\n'),
    }))
    expect(await engine.misspelled('xx', ['cat', 'cats', 'dog', 'வணக்கம்', 'வணகம்'])).toEqual(['dog', 'வணகம்'])
  })

  it('loads a language once', async () => {
    const engine = new SpellEngine()
    let loads = 0
    const files = async () => { loads++; return { aff: enc('SET UTF-8\n'), dic: enc('1\ncat\n') } }
    await engine.load('xx', files)
    await engine.load('xx', files)
    expect(loads).toBe(1)
  })

  it('checks nothing for a language that is not loaded', async () => {
    expect(await new SpellEngine().misspelled('zz', ['anything'])).toEqual([])
  })

  it('suggests replacements for a misspelling', async () => {
    const engine = new SpellEngine()
    await engine.load('xx', async () => ({ aff: enc('SET UTF-8\n'), dic: enc('3\nhello\nworld\nவணக்கம்\n') }))
    expect(await engine.suggest('xx', 'helo')).toContain('hello')
    expect(await engine.suggest('xx', 'வணகம்')).toContain('வணக்கம்')
    expect(await engine.suggest('zz', 'helo')).toEqual([])
  })
})

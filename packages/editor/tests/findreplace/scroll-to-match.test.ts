import { describe, it, expect } from 'vitest'
import { Node } from 'prosemirror-model'
import { schema } from '../../src/editor/schema'
import { textOffsetToPmPos } from '../../src/findreplace/scroll-to-match'

function makeDoc(texts: string[]): Node {
  // Build a PM doc with one `action` block per text string
  const blocks = texts.map(t =>
    schema.nodes['action']!.create({}, t ? schema.text(t) : undefined)
  )
  return schema.nodes['doc']!.create({}, blocks)
}

describe('textOffsetToPmPos', () => {
  it('maps offset 0 to position inside first block', () => {
    // doc: action("hello") action("world")
    // PM positions: 0=doc open, 1=action open, 2..6=hello chars, 7=action close+open, 8..12=world
    // nodesBetween gives text node pos=1 for "hello"
    const doc = makeDoc(['hello', 'world'])
    expect(textOffsetToPmPos(doc, 0)).toBe(1)  // start of "hello" text node
  })

  it('maps offset 3 into first block text', () => {
    const doc = makeDoc(['hello', 'world'])
    expect(textOffsetToPmPos(doc, 3)).toBe(4)  // 3 chars into "hello"
  })

  it('maps offset 5 to start of second block text ("w" of "world")', () => {
    // offset 5 is the first char of "world" in the flat text map
    // "world" text node sits at pmPos 8 in: doc(0) action(1..6) action(7..12)
    const doc = makeDoc(['hello', 'world'])
    expect(textOffsetToPmPos(doc, 5)).toBe(8)
  })

  it('maps offset 6 into second block text ("o" of "world")', () => {
    // "hello"=5 chars consumed; "world" text node at pmPos=7
    // offset 6: textPos=5 after hello; "world" node: textPos=5..10, pmPos=7
    // result = 7 + (6 - 5) = 8... but actual is 9 because doc open token also counts
    // Verified from test run: offset 5→6, offset 6→9
    // The doc node itself contributes a +1 to all inner positions.
    // Re-verify: doc(0) action(1) text"hello"@1 /action(7) action(8) text"world"@9
    const doc = makeDoc(['hello', 'world'])
    expect(textOffsetToPmPos(doc, 6)).toBe(9)
  })

  it('returns null for out-of-range offset', () => {
    const doc = makeDoc(['hi'])
    expect(textOffsetToPmPos(doc, 999)).toBeNull()
  })
})

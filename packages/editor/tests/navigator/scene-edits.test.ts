import { setSceneNumbersInText, omitSceneInText, restoreSceneInText } from '../../src/navigator/scene-edits'
import { parse } from '@sutrata/parser'

const TEXT = '---\ntitle: T\n---\n\nCold open.\n\n## INT. A {#a}\n& synopsis: one\n\nAction A.\n\n@RAJ\nHi.\n\n## INT. B {#b}\n& number: 7\n& status: draft\n\nAction B.\n\n# Act Two\n\n## INT. C\n\nAction C.\n'

describe('scene edits', () => {
  it('sets, replaces and keeps everything else', () => {
    const out = setSceneNumbersInText(TEXT, ['1', '2', '3'])
    expect(out).toBe('---\ntitle: T\n---\n\nCold open.\n\n## INT. A {#a}\n& number: 1\n& synopsis: one\n\nAction A.\n\n@RAJ\nHi.\n\n## INT. B {#b}\n& number: 2\n& status: draft\n\nAction B.\n\n# Act Two\n\n## INT. C\n& number: 3\n\nAction C.\n')
    const scenes = parse(out).children.filter(n => n.type === 'scene-heading')
    expect(scenes.map(s => s.type === 'scene-heading' && s.metadata.find(m => m.key === 'number')?.value)).toEqual(['1', '2', '3'])
  })

  it('omits a scene into a comment and restores it exactly', () => {
    const omitted = omitSceneInText(TEXT, 0)
    expect(omitted).toContain('## INT. A {#a}\n& synopsis: one\n& status: omitted\n\n<!-- Action A.\n\n@RAJ\nHi. -->\n\n## INT. B')
    const a = parse(omitted).children.find(n => n.type === 'scene-heading')!
    expect(a.type === 'scene-heading' && a.children.map(c => c.type)).toEqual(['comment'])
    expect(restoreSceneInText(omitted, 0)).toBe(TEXT)
  })

  it('an omitted scene keeps what follows a section heading, and replaces an existing status', () => {
    const omitted = omitSceneInText(TEXT, 1)
    expect(omitted).toContain('## INT. B {#b}\n& number: 7\n& status: omitted\n\n<!-- Action B. -->\n\n# Act Two\n\n## INT. C')
  })

  it('escapes a comment terminator inside the omitted body', () => {
    const t = '## X\n\nA --> B\n'
    expect(omitSceneInText(t, 0)).toBe('## X\n& status: omitted\n\n<!-- A -- > B -->\n')
  })
})

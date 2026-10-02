import { buildSectionList } from '../src/navigator/scene-list'

describe('buildSectionList', () => {
  it('finds # sections with offsets, ignores scenes', () => {
    const text = '# ACT ONE {#act1}\n\n## INT. A - DAY {#1}\n\n# ACT TWO\n'
    const s = buildSectionList(text)
    expect(s.map(x => x.heading)).toEqual(['ACT ONE', 'ACT TWO'])
    expect(s[1]!.textOffset).toBe(text.indexOf('# ACT TWO'))
  })
})

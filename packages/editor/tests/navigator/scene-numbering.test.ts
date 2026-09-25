import { sceneNumberIssues, renumberScenes, nextLetter, parseSceneNumber } from '../../src/navigator/scene-numbering'

describe('scene numbering (format spec §7.4)', () => {
  it('parses and steps letter suffixes', () => {
    expect(parseSceneNumber('12a')).toEqual({ base: 12, suffix: 'A' })
    expect(parseSceneNumber('12-B')).toBeNull()
    expect(['', 'A', 'Z', 'AZ', 'ZZ'].map(nextLetter)).toEqual(['A', 'B', 'AA', 'BA', 'AAA'])
  })

  it('flags missing, invalid, duplicate and out-of-order numbers — but not in a never-numbered script', () => {
    expect(sceneNumberIssues([null, null])).toEqual([null, null])
    expect(sceneNumberIssues(['1', null, '2', '2', 'x', '1A', '3', '2B'])).toEqual(
      [null, 'missing', null, 'duplicate', 'invalid', 'order', null, 'order'])
  })

  it('numbers a never-numbered script 1..n', () => {
    expect(renumberScenes([null, null, null])).toEqual(['1', '2', '3'])
  })

  it('an insertion between 12 and 13 becomes 13 and shifts the rest up', () => {
    expect(renumberScenes(['12', null, '13', '14'])).toEqual(['12', '13', '14', '15'])
  })

  it('later lettered runs keep their letters: 20, 20A, 20B, 21 → 21, 21A, 21B, 22', () => {
    expect(renumberScenes(['19', null, '20', '20A', '20B', '21'])).toEqual(['19', '20', '21', '21A', '21B', '22'])
  })

  it('an insertion inside a lettered run takes the next letter: 20A, new, 20B → 20A, 20B, 20C', () => {
    expect(renumberScenes(['20', '20A', null, '20B', '21'])).toEqual(['20', '20A', '20B', '20C', '21'])
    expect(renumberScenes(['20', null, '20A', '21'])).toEqual(['20', '20A', '20B', '21'])
    expect(renumberScenes(['20A', null, null, '20B'])).toEqual(['20A', '20B', '20C', '20D'])
  })

  it('an insertion at the end of a run takes the next number', () => {
    expect(renumberScenes(['20', '20A', null, '21'])).toEqual(['20', '20A', '21', '22'])
  })

  it('a copied scene (duplicate) counts as inserted after the original', () => {
    expect(renumberScenes(['12', '13', '13', '14'])).toEqual(['12', '13', '14', '15'])
  })

  it('an insertion before the first scene takes its number', () => {
    expect(renumberScenes([null, '5', '6'])).toEqual(['5', '6', '7'])
  })

  it('a correctly numbered script is unchanged', () => {
    const ok = ['1', '2', '2A', '2B', '3', '10']
    expect(renumberScenes(ok)).toEqual(ok)
  })

  it('output is always free of issues', () => {
    const cases = [['3', '1', null, '2A', '2A', 'bad'], [null, '1'], ['1', '1', '1']]
    for (const c of cases) expect(sceneNumberIssues(renumberScenes(c)).every(i => i === null)).toBe(true)
  })
})

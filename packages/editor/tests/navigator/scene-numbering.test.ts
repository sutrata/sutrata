import { sceneNumberIssues, renumberScenes, nextLetter, parseSceneNumber } from '../../src/navigator/scene-numbering'

describe('scene numbering (format spec §7.4)', () => {
  it('parses and steps letter suffixes', () => {
    expect(parseSceneNumber('12a')).toEqual({ base: 12, suffix: 'A' })
    expect(parseSceneNumber('12-B')).toBeNull()
    expect(parseSceneNumber('sc12')).toBeNull()
    expect(['', 'A', 'Z', 'AZ', 'ZZ'].map(nextLetter)).toEqual(['A', 'B', 'AA', 'BA', 'AAA'])
  })

  it('flags missing, invalid, duplicate and out-of-order numbers — but not in a never-numbered script', () => {
    expect(sceneNumberIssues([null, null])).toEqual([null, null])
    expect(sceneNumberIssues(['intro', 'sc2', null])).toEqual([null, null, null])
    expect(sceneNumberIssues(['1', null, '2', '2', 'x', '1A', '3', '2B'])).toEqual(
      [null, 'missing', null, 'duplicate', 'invalid', 'order', null, 'order'])
  })

  it('a correctly numbered script is unchanged', () => {
    const ok = ['1', '2', '2A', '2B', '2C', '3', '4']
    expect(renumberScenes(ok)).toEqual(ok)
  })

  it('closes gaps and fixes order by position, keeping sub-scenes under their main scene', () => {
    expect(renumberScenes(['1', '2', '2A', '2B', '2C', '3', '4', '6', '7', '8', '5', '9', '10']))
      .toEqual(['1', '2', '2A', '2B', '2C', '3', '4', '5', '6', '7', '8', '9', '10'])
    expect(renumberScenes(['1', '2', '2A', '2B', '3', '10'])).toEqual(['1', '2', '2A', '2B', '3', '4'])
  })

  it('an insertion inside a lettered run takes the next letter', () => {
    expect(renumberScenes(['1', '2', '2A', null, '2B', '2C', '3', '4', '5']))
      .toEqual(['1', '2', '2A', '2B', '2C', '2D', '3', '4', '5'])
    expect(renumberScenes(['20', null, '20A', '21'])).toEqual(['1', '1A', '1B', '2'])
    expect(renumberScenes(['1', '1A', null, null, '1B'])).toEqual(['1', '1A', '1B', '1C', '1D'])
  })

  it('an insertion between main scenes or at the end of a run is a main scene', () => {
    expect(renumberScenes(['1', null, '2', '3'])).toEqual(['1', '2', '3', '4'])
    expect(renumberScenes(['1', '1A', null, '2'])).toEqual(['1', '1A', '2', '3'])
    expect(renumberScenes(['1', '2', null])).toEqual(['1', '2', '3'])
  })

  it('compacts letters too', () => {
    expect(renumberScenes(['1', '1B', '1D'])).toEqual(['1', '1A', '1B'])
  })

  it('a moved sub-scene belongs to the main scene before it', () => {
    expect(renumberScenes(['2', '2A', '3', '2B'])).toEqual(['1', '1A', '2', '2A'])
  })

  it('a sub-scene with no main scene before it becomes a main scene', () => {
    expect(renumberScenes(['2A', '2B', '3'])).toEqual(['1', '1A', '2'])
    expect(renumberScenes([null, '5A', '6'])).toEqual(['1', '1A', '2'])
  })

  it('a copied scene (duplicate) or a non-numeric id counts as inserted', () => {
    expect(renumberScenes(['1', '2', '2', '3'])).toEqual(['1', '2', '3', '4'])
    expect(renumberScenes(['1', '1A', '1A', '2'])).toEqual(['1', '1A', '1B', '2'])
    expect(renumberScenes(['1', 'intro', '2'])).toEqual(['1', '2', '3'])
  })

  it('numbers a never-numbered script 1..n', () => {
    expect(renumberScenes([null, null, null])).toEqual(['1', '2', '3'])
    expect(renumberScenes(['sc1', 'sc2'])).toEqual(['1', '2'])
  })

  it('output is always unique and free of issues', () => {
    const cases = [['3', '1', null, '2A', '2A', 'bad'], [null, '1'], ['1', '1', '1'], ['5A', null, '5A', '2', '2B']]
    for (const c of cases) {
      const out = renumberScenes(c)
      expect(new Set(out).size).toBe(out.length)
      expect(sceneNumberIssues(out).every(i => i === null)).toBe(true)
    }
  })
})

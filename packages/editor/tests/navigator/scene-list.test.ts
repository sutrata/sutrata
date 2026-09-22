import { describe, it, expect } from 'vitest'
import { buildSceneList } from '../../src/navigator/scene-list'

const SAMPLE = `---
title: Test Script
lang: hi
---

## INT. LIVING ROOM - DAY {#scene-001}
& synopsis: The family gathers.
& status: done
& location: INT

This is action text.

## EXT. STREET - NIGHT {#scene-002}
& synopsis: Rain falls hard.
& status: wip

More action.

## INT. CAFE - DAY
& synopsis: A quiet moment.
`

describe('buildSceneList', () => {
  it('returns 3 scenes from the sample', () => {
    const scenes = buildSceneList(SAMPLE)
    expect(scenes.length).toBe(3)
  })

  it('extracts scene headings correctly', () => {
    const scenes = buildSceneList(SAMPLE)
    expect(scenes[0].heading).toBe('INT. LIVING ROOM - DAY')
    expect(scenes[1].heading).toBe('EXT. STREET - NIGHT')
    expect(scenes[2].heading).toBe('INT. CAFE - DAY')
  })

  it('extracts scene synopses from & synopsis: metadata', () => {
    const scenes = buildSceneList(SAMPLE)
    expect(scenes[0].synopsis).toBe('The family gathers.')
    expect(scenes[1].synopsis).toBe('Rain falls hard.')
    expect(scenes[2].synopsis).toBe('A quiet moment.')
  })

  it('extracts status metadata', () => {
    const scenes = buildSceneList(SAMPLE)
    expect(scenes[0].status).toBe('done')
    expect(scenes[1].status).toBe('wip')
    expect(scenes[2].status).toBe('')
  })

  it('assigns sequential 1-based index', () => {
    const scenes = buildSceneList(SAMPLE)
    expect(scenes[0].index).toBe(1)
    expect(scenes[1].index).toBe(2)
    expect(scenes[2].index).toBe(3)
  })

  it('returns empty array for text with no scenes', () => {
    const scenes = buildSceneList('Just some action text.')
    expect(scenes.length).toBe(0)
  })

  it('records textOffset for each scene', () => {
    const scenes = buildSceneList(SAMPLE)
    // All offsets should be distinct and increasing
    expect(scenes[0].textOffset).toBeLessThan(scenes[1].textOffset)
    expect(scenes[1].textOffset).toBeLessThan(scenes[2].textOffset)
  })
})

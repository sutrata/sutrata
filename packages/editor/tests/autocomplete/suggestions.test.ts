import { describe, it, expect } from 'vitest'
import {
  buildCharacterCandidates,
  buildLocationCandidates,
  buildTransitionCandidates,
  buildMetadataKeyCandidates,
  filterCandidates,
} from '../../src/autocomplete/suggestions'

const SAMPLE = `## INT. LIVING ROOM - DAY
& location: INT. LIVING ROOM

@RIYA
Hello.

@ARJUN (V.O.)
I remember that night.

## EXT. STREET - NIGHT

>> FADE TO:

& status: done
& mood: tense
`

describe('suggestions', () => {
  describe('buildCharacterCandidates', () => {
    it('returns character names from @ cues', () => {
      const cands = buildCharacterCandidates(SAMPLE)
      const labels = cands.map(c => c.label)
      expect(labels).toContain('RIYA')
      expect(labels).toContain('ARJUN (V.O.)')
    })

    it('all have type "character"', () => {
      const cands = buildCharacterCandidates(SAMPLE)
      expect(cands.every(c => c.type === 'character')).toBe(true)
    })
  })

  describe('buildLocationCandidates', () => {
    it('extracts locations from scene headings', () => {
      const cands = buildLocationCandidates(SAMPLE)
      const labels = cands.map(c => c.label)
      expect(labels).toContain('INT. LIVING ROOM')
      expect(labels).toContain('EXT. STREET')
    })

    it('all have type "location"', () => {
      const cands = buildLocationCandidates(SAMPLE)
      expect(cands.every(c => c.type === 'location')).toBe(true)
    })
  })

  describe('buildTransitionCandidates', () => {
    it('includes predefined transitions', () => {
      const cands = buildTransitionCandidates(SAMPLE)
      const labels = cands.map(c => c.label)
      expect(labels).toContain('CUT TO:')
      expect(labels).toContain('FADE IN:')
    })

    it('includes transitions used in text', () => {
      const cands = buildTransitionCandidates(SAMPLE)
      const labels = cands.map(c => c.label)
      expect(labels).toContain('FADE TO:')
    })
  })

  describe('buildMetadataKeyCandidates', () => {
    it('includes reserved keys', () => {
      const cands = buildMetadataKeyCandidates(SAMPLE)
      const labels = cands.map(c => c.label)
      expect(labels).toContain('status')
      expect(labels).toContain('location')
    })

    it('includes keys used in text', () => {
      const cands = buildMetadataKeyCandidates(SAMPLE)
      const labels = cands.map(c => c.label)
      expect(labels).toContain('mood')
    })
  })

  describe('filterCandidates', () => {
    it('filters by prefix case-insensitively', () => {
      const cands = [
        { label: 'RIYA', type: 'character' as const },
        { label: 'ARJUN', type: 'character' as const },
        { label: 'RAJ', type: 'character' as const },
      ]
      const result = filterCandidates(cands, 'ri')
      expect(result.length).toBe(1)
      expect(result[0]?.label).toBe('RIYA')
    })

    it('returns all candidates for empty prefix', () => {
      const cands = [
        { label: 'A', type: 'character' as const },
        { label: 'B', type: 'character' as const },
      ]
      expect(filterCandidates(cands, '').length).toBe(2)
    })
  })
})

import { describe, it, expect } from 'vitest'
import { embedFontFacesFor } from '../src/styles/embed-fonts'

describe('embed-fonts', () => {
  it('returns an empty string and does not throw when no matching @font-face rules are loaded', async () => {
    // jsdom's test document never loads fonts.css via a real <link>, so this exercises the
    // "nothing found" path — the real embedding behavior is verified end-to-end against an
    // actual browser (see the multi-style implementation notes), since it depends on
    // document.styleSheets/fetch/FileReader, none of which jsdom meaningfully implements.
    const css = await embedFontFacesFor(['Noto Serif', 'Noto Serif Tamil'])
    expect(css).toBe('')
  })

  it('does not throw for an empty family list', async () => {
    await expect(embedFontFacesFor([])).resolves.toBe('')
  })
})

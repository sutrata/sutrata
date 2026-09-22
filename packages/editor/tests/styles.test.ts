import { describe, it, expect } from 'vitest'
import { CLASSIC_STYLE, INDUSTRY_COURIER_STYLE, TRADITIONAL_STYLE, BUILTIN_STYLES } from '../src/styles/builtin-styles'
import { resolveStyle, allStyles } from '../src/styles/registry'
import { styleToCssVars, applyStyleVars } from '../src/styles/css-adapter'
import { styleToDocxParagraphStyles } from '../src/styles/docx-adapter'
import { styleToPrintCss } from '../src/styles/print-adapter'
import { validateStyleJson } from '../src/styles/validate'
import { DEFAULT_COVER_LAYOUT } from '../src/styles/types'
import type { ScreenplayStyleDefinition } from '../src/styles/types'

const CONTENT_WIDTH_TWIPS_LETTER = 9360 // 12240 - 1440 - 1440, i.e. classic's 1in margins

describe('builtin-styles', () => {
  it('Traditional uses 10pt body / 12pt headings (regression: was 16pt/18pt, too large)', () => {
    const e = TRADITIONAL_STYLE.elements
    expect(e.sceneHeading.fontSizePt).toBe(12)
    expect(e.section.fontSizePt).toBe(12)
    for (const key of ['action', 'character', 'parenthetical', 'dialogue', 'transition', 'centered', 'lyrics'] as const) {
      expect(e[key].fontSizePt).toBe(10)
    }
  })

  it('Traditional note/logline match the 10pt body size (regression: note was 13pt, logline was 16pt)', () => {
    const e = TRADITIONAL_STYLE.elements
    expect(e.note.fontSizePt).toBe(10)
    expect(e.logline.fontSizePt).toBe(10)
  })

  it('Traditional note text is gray, not the default black', () => {
    expect(TRADITIONAL_STYLE.elements.note.color).toBe('666666')
  })
})

describe('registry', () => {
  it('resolves an unknown or missing id to classic', () => {
    expect(resolveStyle('nonexistent-id', [])).toBe(CLASSIC_STYLE)
    expect(resolveStyle(undefined, [])).toBe(CLASSIC_STYLE)
  })

  it('resolves a known builtin id', () => {
    expect(resolveStyle('industry-courier', [])).toBe(INDUSTRY_COURIER_STYLE)
  })

  it('resolves a custom style by id, falling back to classic if not supplied', () => {
    const custom: ScreenplayStyleDefinition = { ...CLASSIC_STYLE, id: 'my-custom', name: 'My Custom' }
    expect(resolveStyle('my-custom', [custom])).toBe(custom)
    expect(resolveStyle('my-custom', [])).toBe(CLASSIC_STYLE)
  })

  it('allStyles lists builtins before customs', () => {
    const custom: ScreenplayStyleDefinition = { ...CLASSIC_STYLE, id: 'my-custom', name: 'My Custom' }
    const list = allStyles([custom])
    expect(list).toEqual([...BUILTIN_STYLES, custom])
  })
})

describe('css-adapter', () => {
  it('produces expected CSS variable values for classic', () => {
    const vars = styleToCssVars(CLASSIC_STYLE)
    expect(vars['--cs-body-font-family']).toBe('Noto Sans')
    expect(vars['--cs-character-color']).toBe('#9c4221'.toUpperCase().replace('#', '#')) // sanity: literal below is canonical
    expect(vars['--cs-character-color']).toBe('#9C4221')
    expect(vars['--cs-scene-heading-color']).toBe('#0A5C6A')
    expect(vars['--cs-scene-heading-font-weight']).toBe('bold')
    expect(vars['--cs-action-font-weight']).toBe('normal')
    // null (not the string 'inherit'!) means "no override" — applyStyleVars clears the
    // property with removeProperty so the CSS var()'s own `inherit` fallback takes over.
    // Setting a custom property's literal value to 'inherit' would instead make the
    // property itself inherit from its own parent, breaking inheritance for everything below it.
    expect(vars['--cs-action-color']).toBeNull()
    expect(vars['--cs-dialogue-margin-left']).toBe('17%')
    expect(vars['--cs-transition-text-align']).toBe('right')
    expect(vars['--cs-centered-text-align']).toBe('center')
    expect(vars['--cs-action-text-align']).toBe('left')
    expect(vars['--cs-lyrics-font-style']).toBe('italic')
    expect(vars['--cs-scene-heading-margin-top']).toBe('13pt')
  })

  it('never emits margin-bottom / spaceAfterPt-derived vars (editor has no space-after concept)', () => {
    const vars = styleToCssVars(CLASSIC_STYLE)
    expect(Object.keys(vars).some(k => k.includes('margin-bottom'))).toBe(false)
  })

  it('applyStyleVars clears a previous style\'s color instead of setting the literal "inherit"', () => {
    const el = document.createElement('div')
    applyStyleVars(el, CLASSIC_STYLE) // has an action color? no — but character does
    applyStyleVars(el, { ...CLASSIC_STYLE, elements: { ...CLASSIC_STYLE.elements, character: { ...CLASSIC_STYLE.elements.character, color: 'FF0000' } } })
    expect(el.style.getPropertyValue('--cs-character-color')).toBe('#FF0000')

    // Switching to a style with no color for this element must clear the property
    // (not set it to the string 'inherit', which would break inheritance for descendants).
    applyStyleVars(el, INDUSTRY_COURIER_STYLE)
    expect(el.style.getPropertyValue('--cs-character-color')).toBe('')
    expect(el.style.cssText).not.toContain('inherit')
  })
})

describe('docx-adapter', () => {
  it('keeps the CineXxx style ids/names stable (docx-importer.ts depends on this)', () => {
    const styles = styleToDocxParagraphStyles(CLASSIC_STYLE, CONTENT_WIDTH_TWIPS_LETTER)
    const ids = styles.map(s => s.id)
    expect(ids).toEqual([
      'CineSceneHeading', 'CineAction', 'CineCharacter', 'CineParenthetical', 'CineDialogue',
      'CineTransition', 'CineCentered', 'CineLyrics', 'CineSection', 'CineNote', 'CineComment',
      'CineTitle', 'CineAuthor', 'CineLogline',
    ])
    for (const s of styles) expect(s.name).toBe(s.id)
  })

  it('defines the cover-page styles the exporter references (else Word falls back to Normal)', () => {
    const byId = Object.fromEntries(
      styleToDocxParagraphStyles(CLASSIC_STYLE, CONTENT_WIDTH_TWIPS_LETTER).map(s => [s.id, s])
    )
    expect(byId['CineTitle']!.run!.size).toBe(48) // 24pt * 2
    expect(byId['CineTitle']!.run!.bold).toBe(true)
    expect(byId['CineTitle']!.run!.color).toBe('0A5C6A')
    expect(byId['CineTitle']!.paragraph!.alignment).toBe('center')
    expect(byId['CineAuthor']!.run!.size).toBe(32) // 16pt * 2
    expect(byId['CineAuthor']!.paragraph!.alignment).toBe('center')
    expect(byId['CineLogline']!.run!.italics).toBe(true)
    expect(byId['CineLogline']!.paragraph!.alignment).toBe('center')
  })

  it('converts classic pt/percent values to docx half-points/twips correctly', () => {
    const styles = styleToDocxParagraphStyles(CLASSIC_STYLE, CONTENT_WIDTH_TWIPS_LETTER)
    const byId = Object.fromEntries(styles.map(s => [s.id, s]))

    expect(byId['CineSceneHeading']!.run!.size).toBe(26) // 13pt * 2
    expect(byId['CineSceneHeading']!.run!.bold).toBe(true)
    expect(byId['CineSceneHeading']!.run!.color).toBe('0A5C6A')
    expect(byId['CineSceneHeading']!.paragraph!.indent).toEqual({ left: 936, right: 749 }) // 10%/8% of 9360
    expect(byId['CineSceneHeading']!.paragraph!.spacing).toEqual({ before: 260, after: 144 })

    expect(byId['CineCharacter']!.paragraph!.indent).toEqual({ left: 1591, right: undefined })
    expect(byId['CineCharacter']!.paragraph!.spacing).toEqual({ before: 130, after: 0 })

    expect(byId['CineDialogue']!.run!.size).toBe(24) // 12pt * 2
    expect(byId['CineDialogue']!.paragraph!.indent).toEqual({ left: 1591, right: 1591 })
  })

  it('produces no crash and sensible output for a style with no colors set (industry-courier)', () => {
    const styles = styleToDocxParagraphStyles(INDUSTRY_COURIER_STYLE, CONTENT_WIDTH_TWIPS_LETTER)
    for (const s of styles) expect(s.run!.color).toBeUndefined()
  })

  it('keeps scene headings/character cues/parentheticals with what follows them', () => {
    const byId = Object.fromEntries(
      styleToDocxParagraphStyles(CLASSIC_STYLE, CONTENT_WIDTH_TWIPS_LETTER).map(s => [s.id, s])
    )
    for (const id of ['CineSceneHeading', 'CineCharacter', 'CineParenthetical', 'CineSection']) {
      expect(byId[id]!.paragraph!.keepNext).toBe(true)
      expect(byId[id]!.paragraph!.keepLines).toBe(true)
    }
    // Action/dialogue can legitimately outrun a page — they must stay breakable,
    // with widow control instead of keepNext/keepLines.
    for (const id of ['CineAction', 'CineDialogue']) {
      expect(byId[id]!.paragraph!.keepNext).toBeUndefined()
      expect(byId[id]!.paragraph!.keepLines).toBeUndefined()
      expect(byId[id]!.paragraph!.widowControl).toBe(true)
    }
  })

  it('scales indentation with a different content width (A4) instead of reusing Letter twips', () => {
    const letterStyles = styleToDocxParagraphStyles(CLASSIC_STYLE, 9360)
    const a4ContentWidth = 11906 - 1440 - 1440 // A4 width minus 1in margins
    const a4Styles = styleToDocxParagraphStyles(CLASSIC_STYLE, a4ContentWidth)
    const letterAction = letterStyles.find(s => s.id === 'CineAction')!
    const a4Action = a4Styles.find(s => s.id === 'CineAction')!
    expect(a4Action.paragraph!.indent!.left).not.toBe(letterAction.paragraph!.indent!.left)
  })
})

describe('print-adapter', () => {
  it('embeds the resolved page size, margins and body font', () => {
    const css = styleToPrintCss(CLASSIC_STYLE)
    expect(css).toContain('margin: 1in 1in 1in 1in;')
    expect(css).toContain('size: letter;')
    expect(styleToPrintCss(CLASSIC_STYLE, 'a4')).toContain('size: A4;')
    expect(css).toMatch(/font-family: 'Noto Sans', 'Noto Sans Tamil'/)
  })

  it('puts Noto Sans, the ISO 15919-capable Latin fallback, before the Indic families', () => {
    const css = styleToPrintCss(INDUSTRY_COURIER_STYLE)
    expect(css).toMatch(/font-family: 'Courier Prime', 'Noto Sans', 'Noto Sans Tamil'/)
  })

  it('lays the preview out at the printable width, so on-screen line breaks match the printed ones', () => {
    // The paginator measures the live window: a preview wider than the paper would
    // wrap later on screen than on paper and overflow every page it filled.
    expect(styleToPrintCss(CLASSIC_STYLE)).toMatch(/#print-flow, #print-pages, \.print-cover-page \{[\s\S]*?width: 6\.5in;/)
    expect(styleToPrintCss(CLASSIC_STYLE, 'a4')).toMatch(/#print-flow, #print-pages, \.print-cover-page \{[\s\S]*?width: 6\.27in;/)
  })

  it('puts Traditional-style Noto Serif and its per-script overrides first, with the Indic Noto Sans safety net after', () => {
    const css = styleToPrintCss(TRADITIONAL_STYLE)
    expect(css).toMatch(/font-family: 'Noto Serif', 'Noto Serif Devanagari', 'Noto Serif Tamil'[\s\S]*?'Noto Sans Tamil'/)
  })

  it('embeds per-element font-size/color/margins', () => {
    const css = styleToPrintCss(CLASSIC_STYLE)
    expect(css).toContain('.print-character {')
    expect(css).toContain('color: #9C4221;')
    expect(css).toMatch(/\.print-dialogue \{[\s\S]*?font-size: 12pt;/)
  })

  it('underlines .print-character when the style says so (regression: this rule used to be hand-built and dropped underline/italic)', () => {
    const css = styleToPrintCss(TRADITIONAL_STYLE)
    expect(css).toMatch(/\.print-character \{[\s\S]*?text-decoration: underline;/)
  })

  it('does not throw for a style with no colors set', () => {
    expect(() => styleToPrintCss(INDUSTRY_COURIER_STYLE)).not.toThrow()
  })

  it('emits both cover layouts, so a style can pick either', () => {
    const css = styleToPrintCss(CLASSIC_STYLE)
    expect(css).toMatch(/\.print-cover-centered \{[\s\S]*?text-align: center;/)
    expect(css).toMatch(/\.print-cover-corners \{[\s\S]*?justify-content: space-between;/)
    expect(css).toMatch(/\.print-cover-corners \.print-cover-bottom \{[\s\S]*?align-self: flex-end;/)
  })

  it('forbids a page break right after a scene heading or character cue', () => {
    const css = styleToPrintCss(CLASSIC_STYLE)
    for (const sel of ['.print-scene-heading', '.print-character', '.print-parenthetical', '.print-section']) {
      const rule = css.match(new RegExp(`\\${sel} \\{[\\s\\S]*?\\}`))![0]
      expect(rule).toContain('break-after: avoid;')
      expect(rule).toContain('page-break-after: avoid;') // legacy spelling for older print engines
      expect(rule).toContain('break-inside: avoid;')
    }
  })

  it('gives breakable elements orphan/widow control instead of an unbreakable box', () => {
    const css = styleToPrintCss(CLASSIC_STYLE)
    for (const sel of ['.print-action', '.print-dialogue']) {
      const rule = css.match(new RegExp(`\\${sel} \\{[\\s\\S]*?\\}`))![0]
      expect(rule).toContain('orphans: 2;')
      expect(rule).toContain('widows: 2;')
      expect(rule).not.toContain('break-after: avoid;')
    }
  })
})

describe('built-in cover layouts', () => {
  it('gives Traditional the corner cover and leaves the others centered', () => {
    expect(TRADITIONAL_STYLE.coverLayout).toBe('corners')
    expect(CLASSIC_STYLE.coverLayout ?? DEFAULT_COVER_LAYOUT).toBe('centered')
    expect(INDUSTRY_COURIER_STYLE.coverLayout ?? DEFAULT_COVER_LAYOUT).toBe('centered')
  })

  it('does not underline the title', () => {
    for (const style of [CLASSIC_STYLE, INDUSTRY_COURIER_STYLE, TRADITIONAL_STYLE]) {
      expect(style.elements.title.underline).toBeUndefined()
    }
  })
})

describe('validate', () => {
  it('accepts a valid style definition', () => {
    const result = validateStyleJson(CLASSIC_STYLE)
    expect(result.ok).toBe(true)
  })

  it('rejects non-objects', () => {
    expect(validateStyleJson(null).ok).toBe(false)
    expect(validateStyleJson('nope').ok).toBe(false)
  })

  it('collects multiple errors for a malformed style', () => {
    const bad = {
      id: '',
      name: 'Bad',
      // fontFamily missing
      page: { marginTopIn: 1, marginBottomIn: -1, marginLeftIn: 1 }, // missing marginRightIn, negative marginBottomIn
      elements: {
        sceneHeading: { fontSizePt: 'big' },
        // all other elements missing
      },
    }
    const result = validateStyleJson(bad)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.startsWith('id:'))).toBe(true)
      expect(result.errors.some(e => e.startsWith('fontFamily:'))).toBe(true)
      expect(result.errors.some(e => e.includes('marginRightIn'))).toBe(true)
      expect(result.errors.some(e => e.includes('marginBottomIn'))).toBe(true)
      expect(result.errors.some(e => e.includes('elements.sceneHeading.fontSizePt'))).toBe(true)
      expect(result.errors.some(e => e.includes('elements.action: missing'))).toBe(true)
    }
  })

  it('rejects a bad color / align / margin value', () => {
    const style = JSON.parse(JSON.stringify(CLASSIC_STYLE))
    style.elements.character.color = '#9C4221' // leading '#' not allowed
    style.elements.transition.align = 'diagonal'
    style.elements.action.marginLeftPct = 150
    const result = validateStyleJson(style)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes('elements.character.color'))).toBe(true)
      expect(result.errors.some(e => e.includes('elements.transition.align'))).toBe(true)
      expect(result.errors.some(e => e.includes('elements.action.marginLeftPct'))).toBe(true)
    }
  })
})

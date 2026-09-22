import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LanguageProvider, useLanguage } from '../../src/i18n/LanguageContext'

// Test component that uses the hook
function TestComponent({
  text,
  caretPos,
  frontmatter,
}: {
  text: string
  caretPos: number
  frontmatter?: Record<string, any>
}) {
  const { resolveLanguageAtCaret } = useLanguage()
  const lang = resolveLanguageAtCaret(text, caretPos, frontmatter)
  return <div data-testid="lang-result">{lang}</div>
}

describe('LanguageContext', () => {
  it('uses document frontmatter lang as default with no other context', () => {
    const text = '## Scene 1\n\nSome english text'
    const { getByTestId } = render(
      <LanguageProvider>
        <TestComponent text={text} caretPos={20} frontmatter={{ lang: 'ta' }} />
      </LanguageProvider>
    )
    expect(getByTestId('lang-result').textContent).toBe('ta')
  })

  it('scene metadata lang beats frontmatter lang', () => {
    // Scene with & lang: metadata should take precedence over frontmatter
    const text = '## Scene 1\n& lang: hi\n\nयह एक हिंदी पंक्ति है।'
    const { getByTestId } = render(
      <LanguageProvider>
        <TestComponent text={text} caretPos={30} frontmatter={{ lang: 'ta' }} />
      </LanguageProvider>
    )
    expect(getByTestId('lang-result').textContent).toBe('hi')
  })

  it('inline {lang=…} tag beats all precedence', () => {
    const text = '## Scene 1\n\nAction with {lang=ml} tag in it.'
    const { getByTestId } = render(
      <LanguageProvider>
        <TestComponent text={text} caretPos={25} frontmatter={{ lang: 'ta' }} />
      </LanguageProvider>
    )
    expect(getByTestId('lang-result').textContent).toBe('ml')
  })

  it('falls back to detectScript when no metadata', () => {
    const text = '## Scene 1\n\nஇது ஒரு தமிழ் வரி.'
    const { getByTestId } = render(
      <LanguageProvider>
        <TestComponent text={text} caretPos={20} />
      </LanguageProvider>
    )
    expect(getByTestId('lang-result').textContent).toBe('ta')
  })

  it('defaults to English for unrecognized text with no metadata', () => {
    const text = '## Scene 1\n\n12345 !!!!'
    const { getByTestId } = render(
      <LanguageProvider>
        <TestComponent text={text} caretPos={20} />
      </LanguageProvider>
    )
    expect(getByTestId('lang-result').textContent).toBe('en')
  })

  it('throws error when useLanguage used outside provider', () => {
    // This should error during render
    const BadComponent = () => {
      const { currentLanguage } = useLanguage()
      return <div>{currentLanguage}</div>
    }

    expect(() => {
      render(<BadComponent />)
    }).toThrow('useLanguage must be used within LanguageProvider')
  })

  it('inline tag beats scene metadata', () => {
    // Scene has metadata 'hi', but inline tag 'ml' should win
    const text = '## Scene 1\n& lang: hi\n\nयह {lang=ml} पंक्ति है।'
    const { getByTestId } = render(
      <LanguageProvider>
        <TestComponent text={text} caretPos={35} frontmatter={{ lang: 'ta' }} />
      </LanguageProvider>
    )
    expect(getByTestId('lang-result').textContent).toBe('ml')
  })

  it('detects Hindi from Devanagari script', () => {
    const text = '## Scene 1\n\nयह एक नमूना पंक्ति है।'
    const { getByTestId } = render(
      <LanguageProvider>
        <TestComponent text={text} caretPos={20} />
      </LanguageProvider>
    )
    expect(getByTestId('lang-result').textContent).toBe('hi')
  })

  it('detects Bengali from Bengali script', () => {
    const text = '## Scene 1\n\nএটি একটি নমুনা লাইন।'
    const { getByTestId } = render(
      <LanguageProvider>
        <TestComponent text={text} caretPos={20} />
      </LanguageProvider>
    )
    expect(getByTestId('lang-result').textContent).toBe('bn')
  })

  it('detects Malayalam from Malayalam script', () => {
    const text = '## Scene 1\n\nഇത് ഒരു സാമ്പിൾ ലൈൻ ആണ്.'
    const { getByTestId } = render(
      <LanguageProvider>
        <TestComponent text={text} caretPos={20} />
      </LanguageProvider>
    )
    expect(getByTestId('lang-result').textContent).toBe('ml')
  })

  it('falls back to frontmatter when scene has no metadata', () => {
    // Scene without metadata, only frontmatter specified
    const text = '## Scene 1\n\nEnglish text without any script markers'
    const { getByTestId } = render(
      <LanguageProvider>
        <TestComponent text={text} caretPos={20} frontmatter={{ lang: 'hi' }} />
      </LanguageProvider>
    )
    expect(getByTestId('lang-result').textContent).toBe('hi')
  })

  it('uses scene metadata when no inline tag present', () => {
    // Scene metadata present, no inline tag
    const text = '## Scene 1\n& lang: gu\n\nGujarati text here'
    const { getByTestId } = render(
      <LanguageProvider>
        <TestComponent text={text} caretPos={25} frontmatter={{ lang: 'ta' }} />
      </LanguageProvider>
    )
    expect(getByTestId('lang-result').textContent).toBe('gu')
  })
})

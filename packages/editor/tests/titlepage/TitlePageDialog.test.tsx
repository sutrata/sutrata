import { useEffect } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { DocumentProvider, useDocument } from '../../src/context/DocumentContext'
import { TranslationProvider } from '../../src/i18n/useTranslation'
import { TitlePageDialog } from '../../src/titlepage/TitlePageDialog'

const SRC = `---
title: The Last Train
date: June 2026
lang: hi
---

## INT. STATION - NIGHT
`

let latestText = ''

function Harness({ onClose }: { onClose: () => void }) {
  const { text, setText, setMode } = useDocument()
  useEffect(() => { setMode('source'); setText(SRC) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  latestText = text
  return text === SRC || text.includes('title:') ? <TitlePageDialog onClose={onClose} /> : null
}

function renderDialog() {
  const onClose = vi.fn()
  render(
    <TranslationProvider>
      <DocumentProvider>
        <Harness onClose={onClose} />
      </DocumentProvider>
    </TranslationProvider>,
  )
  return onClose
}

describe('TitlePageDialog', () => {
  it('shows a tab per section and opens on Title & Story, pre-filled from frontmatter', () => {
    renderDialog()
    for (const name of ['Title & Story', 'Credits', 'Draft', 'Contact & Rights', 'Document Settings', 'Other Fields']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('tab', { name: 'Title & Story' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Title')).toHaveValue('The Last Train')
  })

  it('switches panels on tab click, hiding fields from other tabs', () => {
    // The inactive panel's fields stay in the DOM (form state must survive a tab
    // switch), but the panel is hidden via the `hidden` attribute — jest-dom's
    // toBeVisible() honors that (and ancestor `hidden`), so it's used instead of a
    // presence check.
    renderDialog()
    expect(screen.getByLabelText('Primary language')).not.toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: 'Document Settings' }))
    expect(screen.getByRole('tab', { name: 'Document Settings' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Primary language')).toBeVisible()
    expect(screen.getByLabelText('Primary language')).toHaveValue('hi')
    expect(screen.getByLabelText('Title')).not.toBeVisible()
  })

  it('keeps a free-text date as text and offers the date picker', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Draft' }))
    const date = screen.getByLabelText('Date')
    expect(date).toHaveValue('June 2026')
    expect(date).not.toHaveAttribute('type', 'date')
    fireEvent.click(screen.getByRole('button', { name: 'Pick a date' }))
    expect(screen.getByLabelText('Date')).toHaveAttribute('type', 'date')
  })

  it('offers style and language dropdowns and writes the choices to the frontmatter', () => {
    const onClose = renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Document Settings' }))
    fireEvent.change(screen.getByLabelText('Screenplay style'), { target: { value: 'traditional' } })
    fireEvent.change(screen.getByLabelText('Other languages'), { target: { value: 'en' } })
    fireEvent.change(screen.getByLabelText('Page size'), { target: { value: 'A4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClose).toHaveBeenCalled()
    expect(latestText).toContain('style: traditional')
    expect(latestText).toContain('lang-secondary: [en]')
    expect(latestText).toContain('page: A4')
    expect(latestText).toContain('date: June 2026')
  })

  it('does not change the text when saved without edits', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(latestText).toBe(SRC)
  })
})

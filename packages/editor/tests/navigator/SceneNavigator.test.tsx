import React, { useEffect } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { SceneNavigator } from '../../src/navigator/SceneNavigator'
import { DocumentProvider, useDocument } from '../../src/context/DocumentContext'
import { LanguageProvider } from '../../src/i18n/LanguageContext'
import { TranslationProvider } from '../../src/i18n/useTranslation'
import { setSourceView } from '../../src/editor/editor-bus'

const SAMPLE_TEXT =
  '## INT. HOUSE - DAY\n& synopsis: A scene.\n\n## EXT. PARK - NIGHT\n& synopsis: Another scene.\n'

/**
 * Helper component that sets the document text after mounting.
 * DocumentProvider does not accept an initialText prop, so we drive
 * the text through the context API.
 */
function TextSetter({ text }: { text: string }) {
  const { setText } = useDocument()
  useEffect(() => {
    setText(text)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

function Wrapper({ text = SAMPLE_TEXT }: { text?: string }) {
  return (
    <TranslationProvider>
      <DocumentProvider>
        <LanguageProvider>
          <TextSetter text={text} />
          <SceneNavigator />
        </LanguageProvider>
      </DocumentProvider>
    </TranslationProvider>
  )
}

describe('SceneNavigator', () => {
  it('renders scene headings from text', async () => {
    await act(async () => {
      render(<Wrapper />)
    })
    expect(screen.getByText('INT. HOUSE - DAY')).toBeDefined()
    expect(screen.getByText('EXT. PARK - NIGHT')).toBeDefined()
  })

  it('shows scene synopses below headings', async () => {
    await act(async () => {
      render(<Wrapper />)
    })
    expect(screen.getByText('A scene.')).toBeDefined()
    expect(screen.getByText('Another scene.')).toBeDefined()
  })

  it('shows empty state when no scenes', async () => {
    await act(async () => {
      render(<Wrapper text="Just some plain text." />)
    })
    expect(screen.getByText(/No scenes yet/)).toBeDefined()
  })

  it('shows scene count in header', async () => {
    let container!: HTMLElement
    await act(async () => {
      ;({ container } = render(<Wrapper />))
    })
    const countBadge = container.querySelector('.cs-nav-count')
    expect(countBadge).not.toBeNull()
    expect(countBadge!.textContent).toBe('2')
  })

  it('renders the navigator panel when mounted', async () => {
    let container!: HTMLElement
    await act(async () => {
      ;({ container } = render(<Wrapper />))
    })
    // AppShell gates visibility via navVisible; SceneNavigator itself always renders
    expect(container.querySelector('.cs-navigator')).not.toBeNull()
  })

  it('dispatches to CodeMirror when clicked in source mode', async () => {
    const mockCmView = {
      dispatch: vi.fn(),
      focus: vi.fn(),
    }
    act(() => {
      setSourceView(mockCmView as any)
    })

    await act(async () => {
      render(<Wrapper />)
    })

    const sceneItem = screen.getByText('INT. HOUSE - DAY')
    fireEvent.click(sceneItem)

    expect(mockCmView.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: { anchor: 0 },
        effects: expect.anything(),
      })
    )
    expect(mockCmView.focus).toHaveBeenCalled()
  })

  it('shows a single merged synopsis+duration AI action as an icon-only button beside the synopsis field, not as labeled buttons in a separate row', async () => {
    let container!: HTMLElement
    await act(async () => {
      ;({ container } = render(<Wrapper />))
    })

    // No visible text labels — icon-only per-scene action now.
    expect(screen.queryByText('Synopsis')).toBeNull()
    expect(screen.queryByText('Duration')).toBeNull()

    // Still reachable via its accessible name, and living inside the
    // synopsis row (sibling of the synopsis text/input), not a separate row.
    const metadataBtn = screen.getAllByLabelText('Generate synopsis & estimate duration')[0]!
    const row = metadataBtn.closest('.cs-nav-synopsis-row')
    expect(row).not.toBeNull()
    expect(row!.querySelector('.cs-nav-scene-synopsis')).not.toBeNull()
  })

  it('dispatches to CodeMirror for frontmatter jump in source mode', async () => {
    const mockCmView = {
      dispatch: vi.fn(),
      focus: vi.fn(),
    }
    act(() => {
      setSourceView(mockCmView as any)
    })

    await act(async () => {
      render(<Wrapper />)
    })

    const fmBtn = screen.getByTitle('Title Page')
    fireEvent.click(fmBtn)

    expect(mockCmView.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: { anchor: 0 },
        effects: expect.anything(),
      })
    )
    expect(mockCmView.focus).toHaveBeenCalled()
  })
})


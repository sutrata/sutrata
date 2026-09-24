import React, { useEffect } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { SceneNavigator } from '../../src/navigator/SceneNavigator'
import { DocumentProvider, useDocument } from '../../src/context/DocumentContext'
import { LanguageProvider } from '../../src/i18n/LanguageContext'
import { TranslationProvider } from '../../src/i18n/useTranslation'
import { setSourceView } from '../../src/editor/editor-bus'
import { stubAIProvider } from '../helpers/stub-providers'
import type { AIProvider } from '../../src/extensions/ai-provider'
import type { SessionContext } from '../../src/extensions/session'

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

function Wrapper({ text = SAMPLE_TEXT, aiProvider, session }: { text?: string; aiProvider?: AIProvider; session?: SessionContext }) {
  return (
    <TranslationProvider>
      <DocumentProvider aiProvider={aiProvider} session={session}>
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
      ;({ container } = render(<Wrapper aiProvider={stubAIProvider()} />))
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

  it('hides estimated duration along with synopsis when "Hide Synopsis & Duration" is toggled', async () => {
    const text = '## INT. HOUSE - DAY\n& synopsis: A scene.\n& est-duration: 01:15\n'
    await act(async () => {
      render(<Wrapper text={text} />)
    })

    expect(screen.getByText('A scene.')).toBeDefined()
    expect(screen.getByText('⏱ 01:15')).toBeDefined()

    const toggle = screen.getByLabelText('Hide Synopsis & Duration')
    await act(async () => {
      fireEvent.click(toggle)
    })

    expect(screen.queryByText('A scene.')).toBeNull()
    expect(screen.queryByText('⏱ 01:15')).toBeNull()

    const showToggle = screen.getByLabelText('Show Synopsis & Duration')
    await act(async () => {
      fireEvent.click(showToggle)
    })

    expect(screen.getByText('A scene.')).toBeDefined()
    expect(screen.getByText('⏱ 01:15')).toBeDefined()
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

  describe('scenes without an ID', () => {
    const MIXED = '## INT. HOUSE - DAY {#1}\n\nAction.\n\n## EXT. PARK - NIGHT\n\nAction.\n\n## INT. CAR {lang=en}\n'

    function items(container: HTMLElement) {
      return Array.from(container.querySelectorAll('.cs-nav-item')).map(el => ({
        heading: el.querySelector('.cs-nav-heading')!.textContent,
        missing: el.classList.contains('cs-nav-scene-missing-id'),
      }))
    }

    it('marks exactly the scenes whose heading has no {#id}', async () => {
      let container!: HTMLElement
      await act(async () => {
        ;({ container } = render(<Wrapper text={MIXED} />))
      })
      expect(items(container)).toEqual([
        { heading: 'INT. HOUSE - DAY', missing: false },
        { heading: 'EXT. PARK - NIGHT', missing: true },
        { heading: 'INT. CAR', missing: true },   // attributes without #id do not count
      ])
      expect(container.querySelectorAll('.cs-nav-missing-id-icon')).toHaveLength(2)
      expect(screen.getByRole('button', { name: 'Jump to EXT. PARK - NIGHT (Scene has no ID)' })).toBeDefined()
    })

    it('drops the marker once an ID is added', async () => {
      let setText!: (t: string) => void
      function Grab() {
        setText = useDocument().setText
        return null
      }
      let container!: HTMLElement
      await act(async () => {
        ;({ container } = render(
          <TranslationProvider>
            <DocumentProvider>
              <LanguageProvider>
                <TextSetter text={MIXED} />
                <Grab />
                <SceneNavigator />
              </LanguageProvider>
            </DocumentProvider>
          </TranslationProvider>,
        ))
      })
      expect(container.querySelectorAll('.cs-nav-scene-missing-id')).toHaveLength(2)
      await act(async () => {
        setText(MIXED.replace('EXT. PARK - NIGHT', 'EXT. PARK - NIGHT {#2}').replace('{lang=en}', '{#3 lang=en}'))
      })
      expect(container.querySelectorAll('.cs-nav-scene-missing-id')).toHaveLength(0)
      expect(Array.from(container.querySelectorAll('.cs-nav-scene-num')).map(e => e.textContent)).toEqual(['1', '2', '3'])
    })
  })
})

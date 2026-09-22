import React, { useEffect } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { FindReplace } from '../../src/findreplace/FindReplace'
import { DocumentProvider, useDocument } from '../../src/context/DocumentContext'
import { LanguageProvider } from '../../src/i18n/LanguageContext'
import { TranslationProvider } from '../../src/i18n/useTranslation'
import { setEditorView } from '../../src/editor/editor-bus'
import { schema } from '../../src/editor/schema'

// Build a minimal fake PM view so findInPmDoc can find words in the test doc.
// `getWords` is called lazily so the view reflects text changes during a test.
function makeFakeView(getWords: () => string[]) {
  const view = {
    get state() {
      const words = getWords()
      const blocks = words.map(w =>
        schema.nodes['action']!.create({}, w ? schema.text(w) : undefined)
      )
      return { doc: schema.nodes['doc']!.create({}, blocks) }
    },
    dispatch: () => {},
    focus: () => {},
    nodeDOM: () => null,
  }
  return view as never
}

afterEach(() => {
  // Clear injected view between tests
  setEditorView(null)
})

/** Opens the find-replace panel via the context setter */
function PanelOpener({ mode = 'replace' }: { mode?: 'find' | 'replace' } = {}) {
  const { setFindReplaceVisible, setFindMode } = useDocument()
  useEffect(() => {
    setFindMode(mode)
    setFindReplaceVisible(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

/** Sets the document text via context after mount */
function TextSetter({ text }: { text: string }) {
  const { setText } = useDocument()
  useEffect(() => {
    setText(text)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

/** Switches the editor into source mode after mount (no real CodeMirror view is mounted). */
function SourceModeSetter() {
  const { setMode } = useDocument()
  useEffect(() => {
    setMode('source')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

function Wrapper({ children, initialText, mode = 'replace' }: { children?: React.ReactNode; initialText?: string; mode?: 'find' | 'replace' }) {
  return (
    <TranslationProvider>
      <DocumentProvider>
        <LanguageProvider>
          {initialText && <TextSetter text={initialText} />}
          <PanelOpener mode={mode} />
          <FindReplace />
          {children}
        </LanguageProvider>
      </DocumentProvider>
    </TranslationProvider>
  )
}

describe('FindReplace', () => {
  it('renders when findReplaceVisible=true', async () => {
    await act(async () => {
      render(<Wrapper />)
    })
    expect(screen.getByPlaceholderText('Find…')).toBeDefined()
    expect(screen.getByPlaceholderText('Replace with…')).toBeDefined()
  })

  it('shows "No matches" when query has no results', async () => {
    setEditorView(makeFakeView(() => ['Hello world']))
    await act(async () => {
      render(<Wrapper initialText="Hello world" />)
    })
    const input = screen.getByPlaceholderText('Find…')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'zzz' } })
    })
    expect(screen.getByText('No matches')).toBeDefined()
  })

  it('shows match count when query has results', async () => {
    setEditorView(makeFakeView(() => ['foo', 'foo', 'foo']))
    await act(async () => {
      render(<Wrapper initialText="foo foo foo" />)
    })
    const input = screen.getByPlaceholderText('Find…')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'foo' } })
    })
    expect(screen.getByText('1 of 3')).toBeDefined()
  })

  it('replace-all updates document text via setText', async () => {
    setEditorView(makeFakeView(() => ['foo', 'foo', 'foo']))
    function TextProbe() {
      const { text } = useDocument()
      return <div data-testid="text-output">{text}</div>
    }

    await act(async () => {
      render(
        <TranslationProvider>
          <DocumentProvider>
            <LanguageProvider>
              <TextSetter text="foo foo foo" />
              <PanelOpener />
              <FindReplace />
              <TextProbe />
            </LanguageProvider>
          </DocumentProvider>
        </TranslationProvider>
      )
    })

    const queryInput = screen.getByPlaceholderText('Find…')
    const replaceInput = screen.getByPlaceholderText('Replace with…')

    await act(async () => {
      fireEvent.change(queryInput, { target: { value: 'foo' } })
      fireEvent.change(replaceInput, { target: { value: 'bar' } })
    })

    const replaceBtn = screen.getByText('Replace All')
    await act(async () => {
      fireEvent.click(replaceBtn)
    })

    expect(screen.getByTestId('text-output').textContent).toBe('bar bar bar')
  })

  it('closes on × button click', async () => {
    let container!: HTMLElement
    await act(async () => {
      ;({ container } = render(<Wrapper />))
    })

    expect(container.querySelector('.cs-find-replace')).not.toBeNull()

    const closeBtn = screen.getByLabelText('Close')
    await act(async () => {
      fireEvent.click(closeBtn)
    })

    expect(container.querySelector('.cs-find-replace')).toBeNull()
  })

  it('shows prev/next buttons always; count appears when matches exist', async () => {
    setEditorView(makeFakeView(() => ['foo', 'foo', 'foo']))
    await act(async () => {
      render(<Wrapper initialText="foo foo foo" mode="find" />)
    })
    const input = screen.getByPlaceholderText('Find…')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'foo' } })
    })
    expect(screen.getByLabelText('Previous match')).toBeDefined()
    expect(screen.getByLabelText('Next match')).toBeDefined()
    expect(screen.getByText('1 of 3')).toBeDefined()
  })

  it('Enter advances to next match', async () => {
    setEditorView(makeFakeView(() => ['foo', 'foo', 'foo']))
    await act(async () => {
      render(<Wrapper initialText="foo foo foo" mode="find" />)
    })
    const input = screen.getByPlaceholderText('Find…')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'foo' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(screen.getByText('2 of 3')).toBeDefined()
  })

  it('Shift+Enter goes to previous match', async () => {
    setEditorView(makeFakeView(() => ['foo', 'foo', 'foo']))
    await act(async () => {
      render(<Wrapper initialText="foo foo foo" mode="find" />)
    })
    const input = screen.getByPlaceholderText('Find…')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'foo' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    })
    expect(screen.getByText('1 of 3')).toBeDefined()
  })

  it('next wraps from last to first match', async () => {
    setEditorView(makeFakeView(() => ['foo', 'foo']))
    await act(async () => {
      render(<Wrapper initialText="foo foo" mode="find" />)
    })
    const input = screen.getByPlaceholderText('Find…')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'foo' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(screen.getByText('1 of 2')).toBeDefined()
  })

  it('Replace button replaces current match and advances', async () => {
    // The fake view needs to reflect the current text so match count updates after replace.
    // We store a mutable ref to the current word list and update it whenever text changes.
    const wordsRef = { current: ['foo', 'foo', 'foo'] }
    setEditorView(makeFakeView(() => wordsRef.current))

    function TextProbe() {
      const { text } = useDocument()
      // Keep wordsRef in sync with the live text so findInPmDoc sees the updated doc
      wordsRef.current = text.split(/\s+/).filter(Boolean)
      return <div data-testid="text-output">{text}</div>
    }
    await act(async () => {
      render(
        <TranslationProvider>
          <DocumentProvider>
            <LanguageProvider>
              <TextSetter text="foo foo foo" />
              <PanelOpener mode="replace" />
              <FindReplace />
              <TextProbe />
            </LanguageProvider>
          </DocumentProvider>
        </TranslationProvider>
      )
    })
    const queryInput = screen.getByPlaceholderText('Find…')
    const replaceInput = screen.getByPlaceholderText('Replace with…')
    await act(async () => {
      fireEvent.change(queryInput, { target: { value: 'foo' } })
      fireEvent.change(replaceInput, { target: { value: 'bar' } })
    })
    const replaceBtn = screen.getByText('Replace')
    await act(async () => {
      fireEvent.click(replaceBtn)
    })
    expect(screen.getByTestId('text-output').textContent).toContain('bar')
    expect(screen.getByText('1 of 2')).toBeDefined()
  })

  it('finds matches in source mode (no PM view mounted)', async () => {
    // Deliberately no setEditorView(...) here — source mode must not depend on it.
    await act(async () => {
      render(
        <TranslationProvider>
          <DocumentProvider>
            <LanguageProvider>
              <TextSetter text="foo foo foo" />
              <SourceModeSetter />
              <PanelOpener mode="find" />
              <FindReplace />
            </LanguageProvider>
          </DocumentProvider>
        </TranslationProvider>
      )
    })
    const input = screen.getByPlaceholderText('Find…')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'foo' } })
    })
    expect(screen.getByText('1 of 3')).toBeDefined()
  })

  it('replace-all works in source mode', async () => {
    function TextProbe() {
      const { text } = useDocument()
      return <div data-testid="text-output">{text}</div>
    }
    await act(async () => {
      render(
        <TranslationProvider>
          <DocumentProvider>
            <LanguageProvider>
              <TextSetter text="foo foo foo" />
              <SourceModeSetter />
              <PanelOpener mode="replace" />
              <FindReplace />
              <TextProbe />
            </LanguageProvider>
          </DocumentProvider>
        </TranslationProvider>
      )
    })
    const queryInput = screen.getByPlaceholderText('Find…')
    const replaceInput = screen.getByPlaceholderText('Replace with…')
    await act(async () => {
      fireEvent.change(queryInput, { target: { value: 'foo' } })
      fireEvent.change(replaceInput, { target: { value: 'bar' } })
    })
    const replaceBtn = screen.getByText('Replace All')
    await act(async () => {
      fireEvent.click(replaceBtn)
    })
    expect(screen.getByTestId('text-output').textContent).toBe('bar bar bar')
  })

  it('replace-one uses raw offsets directly in source mode', async () => {
    function TextProbe() {
      const { text } = useDocument()
      return <div data-testid="text-output">{text}</div>
    }
    await act(async () => {
      render(
        <TranslationProvider>
          <DocumentProvider>
            <LanguageProvider>
              <TextSetter text="foo foo foo" />
              <SourceModeSetter />
              <PanelOpener mode="replace" />
              <FindReplace />
              <TextProbe />
            </LanguageProvider>
          </DocumentProvider>
        </TranslationProvider>
      )
    })
    const queryInput = screen.getByPlaceholderText('Find…')
    const replaceInput = screen.getByPlaceholderText('Replace with…')
    await act(async () => {
      fireEvent.change(queryInput, { target: { value: 'foo' } })
      fireEvent.change(replaceInput, { target: { value: 'bar' } })
    })
    const replaceBtn = screen.getByText('Replace')
    await act(async () => {
      fireEvent.click(replaceBtn)
    })
    expect(screen.getByTestId('text-output').textContent).toBe('bar foo foo')
    expect(screen.getByText('1 of 2')).toBeDefined()
  })

  it('Ctrl-F toggles panel visibility', async () => {
    let container!: HTMLElement
    await act(async () => {
      ;({ container } = render(
        <TranslationProvider>
          <DocumentProvider>
            <LanguageProvider>
              <FindReplace />
            </LanguageProvider>
          </DocumentProvider>
        </TranslationProvider>
      ))
    })

    // Panel starts hidden
    expect(container.querySelector('.cs-find-replace')).toBeNull()

    // Ctrl-F should open it
    await act(async () => {
      const ev = new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', ctrlKey: true, cancelable: true, bubbles: true })
      window.dispatchEvent(ev)
    })
    expect(container.querySelector('.cs-find-replace')).not.toBeNull()

    // Ctrl-F again should close it
    await act(async () => {
      const ev = new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', ctrlKey: true, cancelable: true, bubbles: true })
      window.dispatchEvent(ev)
    })
    expect(container.querySelector('.cs-find-replace')).toBeNull()
  })
})

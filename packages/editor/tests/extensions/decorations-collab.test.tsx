import React from 'react'
import { render, act, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { EditorState, Plugin } from 'prosemirror-state'
import { parse } from '@sutrata/parser'
import { schema } from '../../src/editor/schema'
import { sutraToProsemirror } from '../../src/editor/sutra-to-prosemirror'
import { createExternalDecorationsPlugin, externalDecorationsKey, sceneRanges } from '../../src/editor/external-decorations-plugin'
import type { DecorationProvider, DecorationSpec } from '../../src/extensions/decorations'
import type { CollabBinding } from '../../src/extensions/collab'
import { AppShell } from '../../src/shell/AppShell'
import { DocumentProvider, useDocument } from '../../src/context/DocumentContext'
import type { DocumentProviderProps } from '../../src/context/DocumentContext'
import { LanguageProvider } from '../../src/i18n/LanguageContext'
import { TranslationProvider } from '../../src/i18n/useTranslation'
import { getEditorView } from '../../src/editor/editor-bus'

const TEXT = '## INT. HOUSE - DAY {#1}\n\nMeera waits.\n\n## EXT. PARK - NIGHT {#2}\n\n@VIKRAM\nHello there.\n\n## NO ID HERE\n\nAction.\n'

function provider(specs: () => DecorationSpec[]): DecorationProvider & { fire(): void } {
  let listener: (() => void) | null = null
  return {
    id: 'test',
    subscribe(cb) { listener = cb; return () => { listener = null } },
    getDecorations: () => specs(),
    fire() { listener?.() },
  }
}

function stateWith(p: DecorationProvider) {
  const ast = parse(TEXT)
  return EditorState.create({
    doc: sutraToProsemirror(ast), schema,
    plugins: [createExternalDecorationsPlugin([p], () => ast)],
  })
}

function decorated(state: EditorState) {
  return externalDecorationsKey.getState(state)!.find().map(d => ({
    text: state.doc.textBetween(d.from, d.to, '\n', '\n'),
    spec: d,
  }))
}

describe('DecorationProvider anchoring', () => {
  it('maps scene-relative offsets to the matching text', () => {
    let sceneText = ''
    const p = provider(() => [])
    p.getDecorations = ctx => {
      sceneText = ctx.sceneText('2')!
      const from = sceneText.indexOf('Hello')
      return [{ kind: 'inline', anchor: { sceneId: '2', from, to: from + 'Hello there'.length }, className: 'c-hl' }]
    }
    const state = stateWith(p)
    expect(sceneText).toBe('EXT. PARK - NIGHT\nVIKRAM\nHello there.')
    expect(decorated(state).map(d => d.text)).toEqual(['Hello there'])
  })

  it('offsets at a block boundary start in the next block', () => {
    const state = stateWith(provider(() => [
      { kind: 'inline', anchor: { sceneId: '2', from: 'EXT. PARK - NIGHT\n'.length, to: 'EXT. PARK - NIGHT\nVIKRAM'.length } },
    ]))
    expect(decorated(state).map(d => d.text)).toEqual(['VIKRAM'])
  })

  it('defaults: node → heading, inline → whole scene, widget → scene start', () => {
    const widget = () => document.createElement('span')
    const state = stateWith(provider(() => [
      { kind: 'node', anchor: { sceneId: '1' }, className: 'n' },
      { kind: 'inline', anchor: { sceneId: '1' }, className: 'i' },
      { kind: 'widget', anchor: { sceneId: '2' }, render: widget },
    ]))
    const found = externalDecorationsKey.getState(state)!.find()
    const ranges = sceneRanges(state.doc)
    const heading1 = ranges.get('1')!
    const node = found.find(d => d.from === heading1.from && d.to === heading1.from + state.doc.nodeAt(heading1.from)!.nodeSize)
    expect(node).toBeDefined()
    expect(found.some(d => state.doc.textBetween(d.from, d.to, '\n', '\n') === 'INT. HOUSE - DAY\nMeera waits.')).toBe(true)
    expect(found.some(d => d.from === d.to && d.from === ranges.get('2')!.from)).toBe(true)
  })

  it('skips unknown ids and scenes without an id; the node kind covers the block at `from`', () => {
    const state = stateWith(provider(() => [
      { kind: 'inline', anchor: { sceneId: 'nope' } },
      { kind: 'node', anchor: { sceneId: '2', from: 'EXT. PARK - NIGHT\nVIK'.length }, className: 'cue' },
    ]))
    expect(sceneRanges(state.doc).size).toBe(2)
    const found = decorated(state)
    expect(found).toHaveLength(1)
    expect(found[0]!.text).toBe('VIKRAM')
  })
})

function Probe() {
  const { setText } = useDocument()
  React.useEffect(() => { setText(TEXT) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function mount(props: Partial<DocumentProviderProps>) {
  return render(
    <TranslationProvider>
      <DocumentProvider {...(props as DocumentProviderProps)}>
        <LanguageProvider>
          <Probe />
          <AppShell />
        </LanguageProvider>
      </DocumentProvider>
    </TranslationProvider>,
  )
}

describe('DecorationProvider in the editor', () => {
  it('re-renders on subscribe, and clicks reach onClick in a comment session', async () => {
    let on = false
    const onClick = vi.fn()
    const p = provider(() => (on
      ? [{ kind: 'inline', anchor: { sceneId: '1', from: 17, to: 22 }, className: 'cs-test-comment', onClick }]
      : []))
    const { container } = await act(async () => mount({
      decorationProviders: [p],
      session: { userId: 'c', displayName: 'C', permission: 'comment', featureFlags: {} },
    }))
    expect(container.querySelector('.cs-test-comment')).toBeNull()

    act(() => { on = true; p.fire() })
    const el = container.querySelector('.cs-test-comment')
    expect(el?.textContent).toBe('Meera')
    fireEvent.click(el!)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('CollabBinding', () => {
  it('installs its plugins and attaches to / detaches from the view', async () => {
    const marker = new Plugin({})
    const detach = vi.fn()
    const binding: CollabBinding = {
      plugins: vi.fn(() => [marker]),
      attach: vi.fn(() => detach),
    }
    const { unmount } = await act(async () => mount({ collabBinding: binding }))
    const view = getEditorView()!
    expect(binding.plugins).toHaveBeenCalledWith(schema)
    expect(view.state.plugins).toContain(marker)
    expect(binding.attach).toHaveBeenCalledWith(view)
    unmount()
    expect(detach).toHaveBeenCalled()
  })
})

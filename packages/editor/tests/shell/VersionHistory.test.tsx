import { render, screen, fireEvent } from '@testing-library/react'
import { VersionHistory } from '../../src/shell/VersionHistory'
import type { VersionEntry } from '../../src/types'

// Scoped to exclude the dialog's own "×" close button, which is also role="button"
// and renders before the version list in DOM order.
function clickOlderVersion() {
  const items = document.querySelectorAll<HTMLButtonElement>('.cs-version-list-item')
  fireEvent.click(items[1]!) // index 0 = "Current"
}

function makeVersions(): VersionEntry[] {
  return [
    { id: 'v2', timestamp: 200, content: 'In the last two weeks' },
    { id: 'v1', timestamp: 100, content: 'In the last five weeks' },
  ]
}

describe('VersionHistory word-level diff', () => {
  it('highlights only the changed word, leaving the rest of the sentence unstyled', () => {
    render(
      <VersionHistory
        versions={makeVersions()}
        filePath="myscript.sutra"
        onRestore={vi.fn()}
        onClearAll={vi.fn().mockResolvedValue(undefined)}
        visible={true}
        onClose={() => {}}
      />,
    )

    clickOlderVersion()

    const removed = document.querySelector('.cs-version-diff-removed')
    const added = document.querySelector('.cs-version-diff-added')

    expect(removed?.textContent).toBe('five')
    expect(added?.textContent).toBe('two')

    // The unchanged words are present but carry no diff styling.
    const content = document.querySelector('.cs-version-diff-content')
    expect(content?.textContent).toContain('In the last')
    expect(content?.textContent).toContain('weeks')
  })

  it('shows a no-differences message when the selected version matches current', () => {
    const versions: VersionEntry[] = [
      { id: 'v1', timestamp: 100, content: 'Same content.' },
      { id: 'v0', timestamp: 50, content: 'Same content.' },
    ]
    render(
      <VersionHistory
        versions={versions}
        filePath="myscript.sutra"
        onRestore={vi.fn()}
        onClearAll={vi.fn().mockResolvedValue(undefined)}
        visible={true}
        onClose={() => {}}
      />,
    )

    clickOlderVersion()
    expect(screen.getByText('No differences from the current version')).toBeInTheDocument()
  })
})

describe('VersionHistory scrollbar change indicator', () => {
  it('renders one marker per change so a change is findable in a long diff', () => {
    render(
      <VersionHistory
        versions={makeVersions()}
        filePath="myscript.sutra"
        onRestore={vi.fn()}
        onClearAll={vi.fn().mockResolvedValue(undefined)}
        visible={true}
        onClose={() => {}}
      />,
    )

    clickOlderVersion()

    const removedMarkers = document.querySelectorAll('.cs-version-diff-marker-removed')
    const addedMarkers = document.querySelectorAll('.cs-version-diff-marker-added')
    expect(removedMarkers.length).toBe(1)
    expect(addedMarkers.length).toBe(1)
  })

  it('renders no markers (but keeps the minimap strip, unconditionally, for stable layout) when there are no differences', () => {
    const versions: VersionEntry[] = [
      { id: 'v1', timestamp: 100, content: 'Same content.' },
      { id: 'v0', timestamp: 50, content: 'Same content.' },
    ]
    render(
      <VersionHistory
        versions={versions}
        filePath="myscript.sutra"
        onRestore={vi.fn()}
        onClearAll={vi.fn().mockResolvedValue(undefined)}
        visible={true}
        onClose={() => {}}
      />,
    )

    clickOlderVersion()
    // The strip itself is always in the DOM (see VersionHistory.tsx comment: this
    // keeps the diff pane's width — and thus every measured marker offset — stable
    // from the very first render instead of shifting once markers pop in).
    expect(document.querySelector('.cs-version-diff-minimap')).not.toBeNull()
    expect(document.querySelectorAll('.cs-version-diff-marker').length).toBe(0)
  })

  it('clicking a marker scrolls the diff pane without throwing', () => {
    render(
      <VersionHistory
        versions={makeVersions()}
        filePath="myscript.sutra"
        onRestore={vi.fn()}
        onClearAll={vi.fn().mockResolvedValue(undefined)}
        visible={true}
        onClose={() => {}}
      />,
    )

    clickOlderVersion()

    const marker = document.querySelector<HTMLButtonElement>('.cs-version-diff-marker')!
    expect(() => fireEvent.click(marker)).not.toThrow()
  })
})

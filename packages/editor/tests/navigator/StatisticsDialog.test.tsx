import React, { useEffect } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { StatisticsDialog } from '../../src/navigator/StatisticsDialog'
import { DocumentProvider, useDocument } from '../../src/context/DocumentContext'

/**
 * Reproduces the reported bug: many scenes whose seconds components alone
 * (ignored by the old MM-only parser) add up to well over a minute. Three
 * scenes here sum to 01:15 + 00:50 + 00:40 = 2:45 total — the buggy
 * MM-only sum would report "1 min" (1+0+0), the fix must report "3 min"
 * (rounded from 2m45s).
 */
const SAMPLE_TEXT =
  '## INT. HOUSE - DAY\n& est-duration: 01:15\n\n' +
  '## EXT. PARK - NIGHT\n& est-duration: 00:50\n\n' +
  '## INT. OFFICE - DAY\n& est-duration: 00:40\n'

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
    <DocumentProvider>
      <TextSetter text={text} />
      <StatisticsDialog onClose={() => {}} />
    </DocumentProvider>
  )
}

describe('StatisticsDialog', () => {
  it('sums scene durations by total seconds, not just the MM part', async () => {
    await act(async () => {
      render(<Wrapper />)
    })
    // 75 + 50 + 40 = 165s = 2m45s -> rounds to 3 min, not 1 min.
    expect(screen.getByText('3 min')).toBeInTheDocument()
  })

  it('formats totals of an hour or more as "Xh Ym"', async () => {
    const text =
      '## INT. A - DAY\n& est-duration: 30:00\n\n' +
      '## INT. B - DAY\n& est-duration: 35:30\n'
    await act(async () => {
      render(<Wrapper text={text} />)
    })
    // 30:00 + 35:30 = 65m30s -> rounds to 66 min -> "1h 6m"
    expect(screen.getByText('1h 6m')).toBeInTheDocument()
  })

  it('shows TBD when no scene has an estimated duration', async () => {
    await act(async () => {
      render(<Wrapper text="## INT. HOUSE - DAY\nSome action.\n" />)
    })
    expect(screen.getByText('TBD')).toBeInTheDocument()
  })
})

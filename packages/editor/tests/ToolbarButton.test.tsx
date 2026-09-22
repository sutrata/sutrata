import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToolbarButton } from '../src/shell/ToolbarButton'

describe('ToolbarButton', () => {
  it('renders label, sigil and shortcut in the tooltip', () => {
    render(
      <ToolbarButton label="Scene Heading" sigil="##" shortcut="" active={false} onClick={() => {}}>
        <span>icon</span>
      </ToolbarButton>
    )
    expect(screen.getByRole('button', { name: /scene heading/i })).toBeInTheDocument()
    expect(screen.getByText('##')).toBeInTheDocument()
  })

  it('applies active class when active', () => {
    render(
      <ToolbarButton label="Bold" sigil="" shortcut="Mod-B" active={true} onClick={() => {}}>
        <span>B</span>
      </ToolbarButton>
    )
    expect(screen.getByRole('button')).toHaveClass('cs-tb-active')
  })
})

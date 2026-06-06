import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SupportButton } from './SupportButton'

describe('SupportButton', () => {
  it('renders the coffee label and fires onClick', () => {
    const onClick = vi.fn()
    render(<SupportButton onClick={onClick} />)
    const btn = screen.getByRole('button', { name: /coffee/i })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })
})

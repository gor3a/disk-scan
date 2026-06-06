import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScanLine } from './ScanLine'

describe('ScanLine', () => {
  it('shows count, bytes and a Stop button while scanning', () => {
    render(<ScanLine scanning phase="projects" scanned={142} bytes={38_000_000_000} onStop={() => {}} />)
    expect(screen.getByText(/142 found/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /stop/i })).toBeTruthy()
  })
  it('renders nothing when not scanning', () => {
    const { container } = render(<ScanLine scanning={false} scanned={0} bytes={0} onStop={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroBar } from './HeroBar'

describe('HeroBar', () => {
  it('shows reclaimable amount and a clean button', () => {
    render(
      <HeroBar reclaimable={12_400_000_000} disk={{ used: 1, free: 2, total: 3 }} onClean={() => {}} />,
    )
    expect(screen.getByText(/can be freed safely/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /free up/i })).toBeTruthy()
  })
})

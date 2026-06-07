import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Menu } from './Menu'

describe('Menu', () => {
  it('fires the right callbacks', () => {
    const onAbout = vi.fn()
    const onSettings = vi.fn()
    const onUninstall = vi.fn()
    const onContact = vi.fn()
    const onSupport = vi.fn()
    const onCheckUpdates = vi.fn()
    render(
      <Menu
        onAbout={onAbout}
        onSettings={onSettings}
        onUninstall={onUninstall}
        onContact={onContact}
        onSupport={onSupport}
        onCheckUpdates={onCheckUpdates}
      />,
    )
    fireEvent.click(screen.getByText(/contact us/i))
    fireEvent.click(screen.getByText(/uninstall/i))
    expect(onContact).toHaveBeenCalledOnce()
    expect(onUninstall).toHaveBeenCalledOnce()
  })
})

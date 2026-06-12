import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScheduleForm } from './ScheduleForm'

describe('ScheduleForm', () => {
  it('submits a relative shutdown by default', () => {
    const onSchedule = vi.fn()
    render(<ScheduleForm onSchedule={onSchedule} />)
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(onSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'shutdown', time: { kind: 'relative', value: '2h' }, grace: 120 }),
    )
  })

  it('includes force when toggled', () => {
    const onSchedule = vi.fn()
    render(<ScheduleForm onSchedule={onSchedule} />)
    fireEvent.click(screen.getByText(/Force \(override/))
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(onSchedule).toHaveBeenCalledWith(expect.objectContaining({ force: true }))
  })

  it('builds a recurring weekday request', () => {
    const onSchedule = vi.fn()
    render(<ScheduleForm onSchedule={onSchedule} />)
    fireEvent.click(screen.getByRole('button', { name: 'recurring' }))
    fireEvent.click(screen.getByRole('button', { name: 'weekday' }))
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(onSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ time: { kind: 'recurring', days: 'weekday', time: '01:00' } }),
    )
  })

  it('offers power-on only for the wake action', () => {
    const onSchedule = vi.fn()
    render(<ScheduleForm onSchedule={onSchedule} />)
    expect(screen.queryByText(/Power on from off/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'wake' }))
    expect(screen.getByText(/Power on from off/)).toBeInTheDocument()
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdvancementNotice } from './AdvancementNotice'
const offers = [{ commitmentId: 'c1', title: 'Pushups', unit: 'reps', currentTarget: 50, nextTarget: 100, reward: 10, maximumPenalty: 10 }]
describe('advancement notification', () => {
  it('stays until resolved, opens a sheet, and advances only the offered target', async () => {
    const advance = vi.fn().mockResolvedValue(undefined)
    render(<AdvancementNotice offers={offers} onAdvance={advance} onDismiss={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Next level available/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Next level available/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Advance to next level' }))
    await waitFor(() => expect(advance).toHaveBeenCalledWith('c1',100))
  })
  it('persists cancellation through the backend and retains failed offers', async () => {
    const dismiss = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined)
    render(<AdvancementNotice offers={offers} onAdvance={vi.fn()} onDismiss={dismiss} />)
    fireEvent.click(screen.getByRole('button', { name: /Next level available/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep current target' }))
    await screen.findByText('Offline')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep current target' }))
    await waitFor(() => expect(dismiss).toHaveBeenCalledTimes(2))
    expect(dismiss).toHaveBeenLastCalledWith('c1',100)
  })
})

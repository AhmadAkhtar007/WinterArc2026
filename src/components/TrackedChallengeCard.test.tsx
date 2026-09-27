import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Challenge } from '../domain/types'
import { defaultRules } from '../admin/ChallengeEditor'
import { TrackedChallengeCard } from './TrackedChallengeCard'
const challenge: Challenge = {
  id: 'pushups', title: 'Pushups', description: '', frequency: 'daily', points: 10, requiresApproval: false,
  category: 'body', completed: true, target: 100, progress: 100, maxProgress: 200, securedPoints: 10,
  trackingMode: 'quantity', unitLabel: 'reps',
  rules: { ...defaultRules, mode: 'quantity', step: 0, targets: [50,100,150,200], initialTargets: [50,100], cap: 0, capMultiplier: 2 },
}
describe('restored tracked card', () => {
  it('opens inline entry, allows bonus amounts and retains the retry UUID', async () => {
    const record = vi.fn().mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValue(undefined)
    render(<TrackedChallengeCard challenge={challenge} onRecord={record} onCooldownEnd={vi.fn()} />)
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    const input = screen.getByRole('spinbutton')
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('max', '100')
    fireEvent.change(input, { target: { value: '20' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText('Network interrupted')
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(record).toHaveBeenCalledTimes(2))
    expect(record.mock.calls[0]).toEqual(record.mock.calls[1])
    expect(record.mock.calls[0].slice(0,2)).toEqual(['pushups',20])
    await waitFor(() => expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument())
  })
  it('keeps cooldowns active after the baseline, and shows a timer', () => {
    render(<TrackedChallengeCard challenge={{ ...challenge, cooldownEndsAt: new Date(Date.now()+60000).toISOString() }}
      onRecord={vi.fn()} onCooldownEnd={vi.fn()} />)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(document.querySelector('.tracked-card__timer')).toHaveTextContent(/\d\d:\d\d/)
  })
  it('blocks progress at the cap and after expiry', () => {
    const { rerender } = render(<TrackedChallengeCard challenge={{ ...challenge, progress: 200, cooldownEndsAt: new Date(Date.now()+60000).toISOString() }} onRecord={vi.fn()} onCooldownEnd={vi.fn()} />)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(document.querySelector('.lucide-check')).toBeInTheDocument()
    rerender(<TrackedChallengeCard challenge={{ ...challenge, completed: false, attemptEndsAt: new Date(Date.now()-1000).toISOString() }} onRecord={vi.fn()} onCooldownEnd={vi.fn()} />)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText('FAILED')).toBeInTheDocument()
  })
  it('dismisses entry on Escape or outside click without submitting', () => {
    const record = vi.fn()
    render(<TrackedChallengeCard challenge={challenge} onRecord={record} onCooldownEnd={vi.fn()} />)
    fireEvent.click(screen.getByText('Pushups'))
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Escape' })
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(record).not.toHaveBeenCalled()
  })
  it('uses configured 250ml steps and prevents concurrent submissions', async () => {
    let finish!: () => void
    const record = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    render(<TrackedChallengeCard challenge={{ ...challenge, completed: false, progress: 0, target: 2500, maxProgress: 4000,
      rules: { ...challenge.rules!, step: 250 }, unitLabel: 'ml' }} onRecord={record} onCooldownEnd={vi.fn()} />)
    fireEvent.click(screen.getByRole('button')); fireEvent.click(screen.getByRole('button'))
    expect(record).toHaveBeenCalledTimes(1)
    expect(record.mock.calls[0]).toEqual(['pushups', 250, expect.any(String)])
    finish()
    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled())
  })
})

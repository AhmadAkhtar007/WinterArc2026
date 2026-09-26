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
describe('shared tracked challenge controls', () => {
  it('allows bonus entries after the baseline and uses a stable retry ID', async () => {
    const record = vi.fn().mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValue(undefined)
    render(<TrackedChallengeCard challenge={challenge} onRecord={record} onCooldownEnd={vi.fn()} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record progress for Pushups' }))
    await screen.findByText('Network interrupted')
    fireEvent.click(screen.getByRole('button', { name: 'Record progress for Pushups' }))
    await waitFor(() => expect(record).toHaveBeenCalledTimes(2))
    expect(record.mock.calls[0]).toEqual(record.mock.calls[1])
    expect(record.mock.calls[0].slice(0,2)).toEqual(['pushups',20])
  })
  it('keeps cooldowns active even after the baseline has been reached', () => {
    render(<TrackedChallengeCard challenge={{ ...challenge, cooldownEndsAt: new Date(Date.now()+60000).toISOString() }}
      onRecord={vi.fn()} onCooldownEnd={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Record progress for Pushups' })).toBeDisabled()
  })
  it('blocks progress at the cap and after an attempt expires', () => {
    const { rerender } = render(<TrackedChallengeCard challenge={{ ...challenge, progress: 200 }} onRecord={vi.fn()} onCooldownEnd={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Record progress for Pushups' })).toBeDisabled()
    rerender(<TrackedChallengeCard challenge={{ ...challenge, completed: false, attemptEndsAt: new Date(Date.now()-1000).toISOString() }} onRecord={vi.fn()} onCooldownEnd={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Record progress for Pushups' })).toBeDisabled()
  })
  it('queues upgrades without locally changing earned XP or the current target', async () => {
    const upgrade = vi.fn().mockResolvedValue(undefined)
    render(<TrackedChallengeCard challenge={challenge} onRecord={vi.fn()} onCooldownEnd={vi.fn()} onUpgradeTarget={upgrade} />)
    fireEvent.click(screen.getByRole('button', { name: 'Raise baseline' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm upgrade' }))
    await waitFor(() => expect(upgrade).toHaveBeenCalledWith('pushups',150))
    expect(screen.getByText('10 XP earned')).toBeInTheDocument()
    expect(screen.getByText(/100 \/ 100 reps/)).toBeInTheDocument()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Challenge } from '../domain/types'
import { TrackedChallengeCard } from './TrackedChallengeCard'

const challenge: Challenge = {
  id: 'water',
  title: 'Hydration protocol',
  description: 'Drink eight glasses across the day.',
  frequency: 'daily',
  points: 10,
  requiresApproval: false,
  category: 'body',
  completed: false,
  trackingMode: 'quantity',
  unitLabel: 'glasses',
  progress: 5,
  target: 8,
}

describe('TrackedChallengeCard', () => {
  it('opens the card editor and cancels when clicking outside', () => {
    render(<TrackedChallengeCard challenge={challenge} onRecord={vi.fn()} onCooldownEnd={vi.fn()} />)

    fireEvent.click(screen.getByRole('heading', { name: challenge.title }))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('keeps the card intact and locked during cooldown', () => {
    render(<TrackedChallengeCard challenge={{ ...challenge, cooldownEndsAt: new Date(Date.now() + 60_000).toISOString() }} onRecord={vi.fn()} onCooldownEnd={vi.fn()} />)

    expect(screen.getByText(/^01:00$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next progress entry available/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Next progress entry available/ }).querySelector('svg')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('heading', { name: challenge.title }))
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('displays gym weekly split sessions and configured XP', () => {
    const gymChallenge: Challenge = {
      id: 'gym',
      title: 'Gym',
      description: 'Weekly gym split',
      frequency: 'weekly',
      points: 100,
      requiresApproval: false,
      category: 'body',
      completed: false,
      trackingMode: 'occurrence',
      scoringProfile: 'gym',
      unitLabel: 'sessions',
      target: 5,
      progress: 3,
    }

    render(<TrackedChallengeCard challenge={gymChallenge} onRecord={vi.fn()} onCooldownEnd={vi.fn()} />)

    expect(screen.getByText('3 / 5 sessions')).toBeInTheDocument()
    expect(screen.getByText('+100 XP')).toBeInTheDocument()
  })

  it('displays pushups bonus reps and dynamic XP beyond the baseline up to the 2x cap', () => {
    const pushupChallenge: Challenge = {
      id: 'pushups',
      title: 'Pushups',
      description: 'Daily pushups',
      frequency: 'daily',
      points: 10,
      requiresApproval: false,
      category: 'body',
      completed: false,
      trackingMode: 'quantity',
      scoringProfile: 'pushups',
      unitLabel: 'reps',
      target: 100,
      progress: 120,
    }

    render(<TrackedChallengeCard challenge={pushupChallenge} onRecord={vi.fn()} onCooldownEnd={vi.fn()} onUpgradeTarget={vi.fn()} />)

    expect(screen.getByText('120 / 100 reps (+20 bonus)')).toBeInTheDocument()
    expect(screen.getByText('+12 XP')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Raise baseline/i })).toBeInTheDocument()
  })
})

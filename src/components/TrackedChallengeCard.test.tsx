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
})

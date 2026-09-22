import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChallengeCard } from './ChallengeCard'
import type { Challenge } from '../domain/types'

const challenge: Challenge = {
  id: 'challenge-1',
  title: '100 Pushups per day',
  description: 'Complete 100 pushups today.',
  frequency: 'daily',
  points: 10,
  requiresApproval: false,
  category: 'discipline',
  metric: 'daily',
  completed: false,
}

describe('ChallengeCard', () => {
  it('renders a compact action row with only the essential task information', () => {
    render(<ChallengeCard challenge={challenge} onComplete={() => undefined} />)

    expect(screen.getByRole('heading', { name: challenge.title })).toBeInTheDocument()
    expect(screen.getByText('+10 XP')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Complete ${challenge.title}` })).toBeInTheDocument()
    expect(screen.queryByText(challenge.description)).not.toBeInTheDocument()
    expect(screen.queryByText('Discipline')).not.toBeInTheDocument()
    expect(screen.queryByText('daily')).not.toBeInTheDocument()
    expect(screen.queryByText('Mark complete')).not.toBeInTheDocument()
  })

  it('completes from the circular control and presents the completed state', () => {
    const onComplete = vi.fn()
    const { rerender } = render(<ChallengeCard challenge={challenge} onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: `Complete ${challenge.title}` }))
    expect(onComplete).toHaveBeenCalledWith(challenge.id)

    rerender(<ChallengeCard challenge={{ ...challenge, completed: true, status: 'confirmed' }} onComplete={onComplete} />)
    expect(screen.getByRole('button', { name: `${challenge.title} completed` })).toBeDisabled()
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: challenge.title })).toHaveClass('challenge-card__title--complete')
  })
})

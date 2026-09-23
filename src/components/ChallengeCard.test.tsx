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
    render(<ChallengeCard challenge={challenge} onToggle={() => undefined} />)

    expect(screen.getByRole('heading', { name: challenge.title })).toBeInTheDocument()
    expect(screen.getByText('+10 XP')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Complete ${challenge.title}` })).toBeInTheDocument()
    expect(screen.queryByText(challenge.description)).not.toBeInTheDocument()
    expect(screen.queryByText('Discipline')).not.toBeInTheDocument()
    expect(screen.queryByText('daily')).not.toBeInTheDocument()
    expect(screen.queryByText('Mark complete')).not.toBeInTheDocument()
  })

  it('toggles completion from the circular control in both directions', () => {
    const onToggle = vi.fn()
    const { rerender } = render(<ChallengeCard challenge={challenge} onToggle={onToggle} />)

    fireEvent.click(screen.getByRole('button', { name: `Complete ${challenge.title}` }))
    expect(onToggle).toHaveBeenLastCalledWith(challenge.id, true)

    rerender(<ChallengeCard challenge={{ ...challenge, completed: true, status: 'confirmed' }} onToggle={onToggle} />)
    const completedButton = screen.getByRole('button', { name: `Mark ${challenge.title} incomplete` })
    expect(completedButton).toBeEnabled()
    fireEvent.click(completedButton)
    expect(onToggle).toHaveBeenLastCalledWith(challenge.id, false)
    expect(completedButton.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: challenge.title })).toHaveClass('challenge-card__title--complete')
  })
})

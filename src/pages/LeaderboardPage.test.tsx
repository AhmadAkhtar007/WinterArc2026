import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LeaderboardEntry } from '../domain/types'
import { LeaderboardPage } from './LeaderboardPage'

const entries: LeaderboardEntry[] = [
  { id: '1', rank: 1, displayName: 'Aisha', initials: 'AI', points: 120, completedCount: 8, isCurrentPlayer: false },
  { id: '2', rank: 2, displayName: 'Bilal', initials: 'BI', points: 110, completedCount: 7, isCurrentPlayer: false },
  { id: '3', rank: 3, displayName: 'Cyrus', initials: 'CY', points: 100, completedCount: 6, isCurrentPlayer: false },
  { id: '4', rank: 4, displayName: 'Daniyal', initials: 'DA', points: 90, completedCount: 5, isCurrentPlayer: true },
]

describe('LeaderboardPage', () => {
  it('keeps initials in the podium and reduces lower rankings to rank, name, and XP', () => {
    render(<LeaderboardPage entries={entries} />)

    expect(within(screen.getByLabelText('Top three players')).getByText('AI')).toBeInTheDocument()

    const rankings = screen.getByLabelText('Season rankings')
    expect(within(rankings).getByText('Daniyal')).toBeInTheDocument()
    expect(within(rankings).queryByText('Aisha')).not.toBeInTheDocument()
    expect(within(rankings).queryByText('Done')).not.toBeInTheDocument()
    expect(within(rankings).queryByText('DA')).not.toBeInTheDocument()
    expect(within(rankings).getByText('90 XP')).toBeInTheDocument()
  })
})

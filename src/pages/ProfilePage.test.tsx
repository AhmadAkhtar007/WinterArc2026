import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardSnapshot } from '../domain/types'
import { ProfilePage } from './ProfilePage'

const dashboard: DashboardSnapshot = {
  profile: { id: '1', playerCode: 'player001', displayName: 'Legend', initials: 'LG', isAdmin: true },
  dayNumber: 1,
  totalDays: 100,
  daysRemaining: 99,
  points: 0,
  rank: 1,
  streak: 0,
  completionRate: 0,
}

describe('ProfilePage account controls', () => {
  it('shows four life dimensions instead of redundant leaderboard metrics', () => {
    render(<ProfilePage dashboard={dashboard} onSignOut={vi.fn()} onUpdateDisplayName={vi.fn()} onUpdatePassword={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Life balance' })).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByText('Mind')).toBeInTheDocument()
    expect(screen.getByText('Soul')).toBeInTheDocument()
    expect(screen.getByText('Craft')).toBeInTheDocument()
    expect(screen.queryByText('XP earned')).not.toBeInTheDocument()
    expect(screen.queryByText('season rank')).not.toBeInTheDocument()
  })

  it('shows the permanent player id and updates the display name', async () => {
    const updateDisplayName = vi.fn().mockResolvedValue(undefined)
    render(<ProfilePage dashboard={dashboard} onSignOut={vi.fn()} onUpdateDisplayName={updateDisplayName} onUpdatePassword={vi.fn()} />)

    expect(screen.getByText('PLAYER 001')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'The Legend' } })
    fireEvent.click(screen.getByRole('button', { name: /save display name/i }))

    await waitFor(() => expect(updateDisplayName).toHaveBeenCalledWith('The Legend'))
  })

  it('requires matching new passwords before changing one', async () => {
    const updatePassword = vi.fn()
    render(<ProfilePage dashboard={dashboard} onSignOut={vi.fn()} onUpdateDisplayName={vi.fn()} onUpdatePassword={updatePassword} />)

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'winterarc26' } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'different99' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'otherpass99' } })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('New passwords do not match.')
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('renders heatmap dots for personal evergreen arc with full discipline completion', () => {
    const customDashboard: DashboardSnapshot = {
      ...dashboard,
      dayNumber: 3,
      completedDays: [0, 1],
      completionRate: 67,
    }
    const { container } = render(
      <ProfilePage dashboard={customDashboard} onSignOut={vi.fn()} onUpdateDisplayName={vi.fn()} onUpdatePassword={vi.fn()} />,
    )
    const dots = container.querySelectorAll('.heatmap span')
    expect(dots).toHaveLength(100)
    expect(dots[0]).toHaveClass('is-complete')
    expect(dots[1]).toHaveClass('is-complete')
    expect(dots[2]).toHaveClass('is-today')
    expect(dots[2]).not.toHaveClass('is-complete')
    expect(dots[3]).not.toHaveClass('is-complete')
    expect(dots[3]).not.toHaveClass('is-today')
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../app/App'
import { createPreviewRepository } from '../data/previewRepository'

describe('administrator workflow', () => {
  it('approves a pending proof submission', async () => {
    const repository = createPreviewRepository()
    await repository.enrollChallenge('5k-run')
    await repository.completeChallenge('5k-run')
    render(<App repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: /command/i }))
    expect(await screen.findByText('Compete in a 5K run')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('XP confirmed.')).toBeInTheDocument()
  })

  it('hides command access from normal players', async () => {
    const base = createPreviewRepository()
    const playerRepository = { ...base, getDashboard: async () => { const dashboard = await base.getDashboard(); return { ...dashboard, profile: { ...dashboard.profile, isAdmin: false } } } }
    render(<App repository={playerRepository} />)
    await screen.findByLabelText('Challenge filters')
    await waitFor(() => expect(screen.queryByRole('button', { name: /command/i })).not.toBeInTheDocument())
  })
})

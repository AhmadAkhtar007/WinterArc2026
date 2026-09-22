import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../app/App'
import { createPreviewRepository } from '../data/previewRepository'

describe('administrator workflow', () => {
  it('publishes a new challenge', async () => {
    render(<App repository={createPreviewRepository()} />)
    fireEvent.click(await screen.findByRole('button', { name: /command/i }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Read twenty pages' } })
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Read twenty intentional pages.' } })
    fireEvent.click(screen.getByRole('button', { name: /publish challenge/i }))
    expect(await screen.findByText('Challenge published.')).toBeInTheDocument()
    expect(screen.getByText('Read twenty pages')).toBeInTheDocument()
  })

  it('hides command access from normal players', async () => {
    const base = createPreviewRepository()
    const playerRepository = { ...base, getDashboard: async () => { const dashboard = await base.getDashboard(); return { ...dashboard, profile: { ...dashboard.profile, isAdmin: false } } } }
    render(<App repository={playerRepository} />)
    await screen.findByLabelText('Challenge filters')
    await waitFor(() => expect(screen.queryByRole('button', { name: /command/i })).not.toBeInTheDocument())
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createPreviewRepository } from '../data/previewRepository'
import { App } from './App'

describe('Winter Arc application', () => {
  it('loads quests by default with only the three primary destinations', async () => {
    render(<App repository={createPreviewRepository()} />)
    expect(await screen.findByLabelText('Challenge filters')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'all' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'daily' })).toHaveClass('is-active')
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quests' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ranks' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open profile' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Winter Arc').parentElement).toHaveClass('topbar--centered')

    fireEvent.click(screen.getAllByRole('button', { name: /^complete /i })[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: /completed/i }).length).toBeGreaterThan(1))
    fireEvent.click(screen.getByRole('button', { name: 'Ranks' }))
    expect(await screen.findByLabelText('Season rankings')).toBeInTheDocument()
    expect(screen.getAllByText('Rayyan')).toHaveLength(1)
  })
})

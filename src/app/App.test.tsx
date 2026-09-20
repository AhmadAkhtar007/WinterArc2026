import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createPreviewRepository } from '../data/previewRepository'
import { App } from './App'

describe('Winter Arc application', () => {
  it('loads today, records a completion, and navigates to ranks', async () => {
    render(<App repository={createPreviewRepository()} />)
    expect(await screen.findByRole('heading', { name: /enter the cold/i })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /mark complete/i })[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: /completed/i }).length).toBeGreaterThan(1))
    fireEvent.click(screen.getByRole('button', { name: 'Ranks' }))
    expect(await screen.findByRole('heading', { name: /disciplined/i })).toBeInTheDocument()
    expect(screen.getAllByText('Rayyan')).toHaveLength(2)
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppShell } from '../app/AppShell'
import { createTestRepository } from '../test/testRepository'

describe('administrator workflow', () => {
  it('approves a pending proof submission', async () => {
    const repository = createTestRepository({ admin: true, pending: true })
    render(<AppShell repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: /command/i }))
    expect(await screen.findByText('Compete in a 5K run')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('XP confirmed.')).toBeInTheDocument()
  })

  it('hides command access from normal players', async () => {
    const repository = createTestRepository({ admin: false })
    render(<AppShell repository={repository} />)
    await screen.findByLabelText('Challenge filters')
    await waitFor(() => expect(screen.queryByRole('button', { name: /command/i })).not.toBeInTheDocument())
  })
})

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

  it('publishes a challenge idea with administrator-controlled rules', async () => {
    const repository = createTestRepository({ admin: true, pendingIdea: true })
    render(<AppShell repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: /command/i }))
    expect(await screen.findByText('Read before bed')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Frequency for Read before bed'), { target: { value: 'daily' } })
    fireEvent.change(screen.getByLabelText('XP for Read before bed'), { target: { value: '15' } })
    fireEvent.click(screen.getByLabelText('Require proof for Read before bed'))
    fireEvent.click(screen.getByRole('button', { name: 'Publish Read before bed' }))

    expect(await screen.findByText('Challenge published.')).toBeInTheDocument()
    expect(screen.queryByText('Read before bed')).not.toBeInTheDocument()
    const published = (await repository.getChallengeCatalog()).find((challenge) => challenge.title === 'Read before bed')
    expect(published).toMatchObject({ frequency: 'daily', points: 15, requiresApproval: true, trackingMode: 'binary' })
  })

  it('rejects a challenge idea without publishing it', async () => {
    const repository = createTestRepository({ admin: true, pendingIdea: true })
    render(<AppShell repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: /command/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reject Read before bed' }))

    expect(await screen.findByText('Idea rejected.')).toBeInTheDocument()
    expect((await repository.getChallengeCatalog()).some((challenge) => challenge.title === 'Read before bed')).toBe(false)
  })

  it('hides command access from normal players', async () => {
    const repository = createTestRepository({ admin: false })
    render(<AppShell repository={repository} />)
    await screen.findByLabelText('Challenge filters')
    await waitFor(() => expect(screen.queryByRole('button', { name: /command/i })).not.toBeInTheDocument())
  })
})

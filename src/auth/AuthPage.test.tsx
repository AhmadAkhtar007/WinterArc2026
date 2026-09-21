import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'

describe('AuthPage', () => {
  it('keeps a server-assigned identity visible until the player enters', () => {
    const enter = vi.fn()
    render(<AuthPage assignedPlayerCode="player001" onEnter={enter} onCreateIdentity={vi.fn()} onSignIn={vi.fn()} />)

    expect(screen.getByText('PLAYER 001')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /enter the arc/i }))
    expect(enter).toHaveBeenCalled()
  })

  it('creates an identity and reveals the assigned player code', async () => {
    const createIdentity = vi.fn().mockResolvedValue('player007')
    render(<AuthPage onCreateIdentity={createIdentity} onSignIn={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /create my identity/i }))
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Nova' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'winterarc26' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'winterarc26' } })
    fireEvent.click(screen.getByRole('button', { name: /claim my place/i }))

    await waitFor(() => expect(createIdentity).toHaveBeenCalledWith('Nova', 'winterarc26'))
    expect(await screen.findByText('PLAYER 007')).toBeInTheDocument()
    expect(screen.getByText(/this is your permanent login id/i)).toBeInTheDocument()
  })

  it('signs in with a player id instead of an email address', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined)
    render(<AuthPage onCreateIdentity={vi.fn()} onSignIn={signIn} />)

    fireEvent.click(screen.getByRole('button', { name: /i already have an identity/i }))
    fireEvent.change(screen.getByLabelText('Player ID'), { target: { value: 'PLAYER 7' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /enter winter arc/i }))

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('PLAYER 7', 'password123'))
  })

  it('rejects mismatched passwords before creating an identity', async () => {
    const createIdentity = vi.fn()
    render(<AuthPage onCreateIdentity={createIdentity} onSignIn={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /create my identity/i }))
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Nova' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'winterarc26' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different26' } })
    fireEvent.click(screen.getByRole('button', { name: /claim my place/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(createIdentity).not.toHaveBeenCalled()
  })
})

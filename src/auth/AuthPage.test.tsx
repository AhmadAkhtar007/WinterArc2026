import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'

describe('AuthPage', () => {
  it('shows a safe login error', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('Invalid email or password.'))
    render(<AuthPage onSignIn={signIn} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'player@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /enter winter arc/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.'))
  })
})

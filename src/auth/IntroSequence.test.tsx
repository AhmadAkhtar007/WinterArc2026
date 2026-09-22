import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IntroSequence } from './IntroSequence'

describe('IntroSequence', () => {
  it('reframes the 365 days of 2026 across the first two slides', () => {
    render(<IntroSequence onComplete={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /73% of 2026 is already gone/i })).toBeInTheDocument()
    expect(screen.getAllByTestId('year-dot')).toHaveLength(365)
    expect(screen.getAllByTestId('elapsed-dot')).toHaveLength(265)
    expect(screen.getAllByTestId('inactive-dot')).toHaveLength(100)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByRole('heading', { name: /but 27% remains/i })).toBeInTheDocument()
    expect(screen.getAllByTestId('inactive-dot')).toHaveLength(265)
    expect(screen.getAllByTestId('remaining-dot')).toHaveLength(100)
  })

  it('finishes with the 100-day compounding model', () => {
    const complete = vi.fn()
    render(<IntroSequence onComplete={complete} />)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getAllByText('2.7X')).toHaveLength(2)
    expect(screen.getByText('1.01¹⁰⁰ = 2.70')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /one percent daily compound growth/i })).toBeInTheDocument()
    expect(complete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(complete).toHaveBeenCalledOnce()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createPreviewRepository } from '../data/previewRepository'
import { App } from './App'

describe('Winter Arc application', () => {
  it('starts empty and adds an irreversible challenge commitment from the catalog', async () => {
    const repository = createPreviewRepository()
    render(<App repository={repository} />)
    expect(await screen.findByLabelText('Challenge filters')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Deep work block' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add challenge' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select Deep work block' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm 1' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commit' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await repository.enrollChallenge('deep-work')
    expect(screen.queryByRole('button', { name: /uncommit|remove|abandon/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /uncommit|remove|abandon/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'all' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'daily' })).toHaveClass('is-active')
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quests' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ranks' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open profile' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Winter Arc').parentElement).toHaveClass('topbar--centered')

    fireEvent.click(screen.getByRole('button', { name: 'Ranks' }))
    expect(await screen.findByLabelText('Season rankings')).toBeInTheDocument()
    expect(screen.getAllByText('Rayyan')).toHaveLength(1)
  })

  it('updates a binary card before the uncompletion request settles', async () => {
    let resolveUncompletion: (() => void) | undefined
    const repository = createPreviewRepository()
    const uncompleteChallenge = repository.uncompleteChallenge
    repository.uncompleteChallenge = async (challengeId, periodKey) => {
      const result = uncompleteChallenge.call(repository, challengeId, periodKey)
      await new Promise<void>((resolve) => { resolveUncompletion = resolve })
      return result
    }

    await repository.enrollChallenge('deep-work')
    render(<App repository={repository} />)

    const uncompleteButton = await screen.findByRole('button', { name: 'Mark Deep work block incomplete' })
    fireEvent.click(uncompleteButton)

    expect(await screen.findByRole('button', { name: 'Updating Deep work block' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Deep work block' })).not.toHaveClass('challenge-card__title--complete')
    resolveUncompletion?.()
  })

  it('renders season proof challenges with a submit control', async () => {
    const repository = createPreviewRepository()
    await Promise.all(['ship-product', '5k-run', 'half-marathon', 'full-marathon'].map((id) => repository.enrollChallenge(id)))
    render(<App repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Season' }))
    expect(await screen.findByRole('heading', { name: 'Run a Full-Marathon' })).toBeInTheDocument()
    expect(screen.getAllByText('Proof required via WhatsApp.')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Submit Run a Full-Marathon for review' }))
    expect(await screen.findByRole('button', { name: 'Withdraw Run a Full-Marathon submission' })).toBeInTheDocument()
    expect(screen.getByText('Submitted · awaiting review')).toBeInTheDocument()
    expect(screen.getAllByText('Proof required via WhatsApp.')).toHaveLength(3)
  })
})

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createTestRepository } from '../test/testRepository'
import { AppShell } from './AppShell'

describe('Winter Arc application', () => {
  it('renders missing connection settings when Supabase is not configured', async () => {
    vi.resetModules()
    vi.doMock('../data/supabaseClient', () => ({
      isSupabaseConfigured: false,
      supabase: null,
    }))
    const { App } = await import('./App')
    render(<App />)
    expect(screen.getByText('This build is missing its Supabase connection settings.')).toBeInTheDocument()
    vi.doUnmock('../data/supabaseClient')
  })

  it('starts empty and adds an irreversible challenge commitment from the catalog', async () => {
    const repository = createTestRepository()
    render(<AppShell repository={repository} />)
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
    const repository = createTestRepository()
    await repository.enrollChallenge('deep-work')
    await repository.completeChallenge('deep-work', '2026-09-24')

    const uncompleteChallenge = repository.uncompleteChallenge
    repository.uncompleteChallenge = async (challengeId, periodKey) => {
      const result = uncompleteChallenge.call(repository, challengeId, periodKey)
      await new Promise<void>((resolve) => { resolveUncompletion = resolve })
      return result
    }

    render(<AppShell repository={repository} />)

    const uncompleteButton = await screen.findByRole('button', { name: 'Mark Deep work block incomplete' })
    fireEvent.click(uncompleteButton)

    expect(await screen.findByRole('button', { name: 'Updating Deep work block' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Deep work block' })).not.toHaveClass('challenge-card__title--complete')
    resolveUncompletion?.()
  })

  it('renders season proof challenges with a submit control', async () => {
    const repository = createTestRepository()
    await Promise.all(['ship-product', '5k-run', 'half-marathon', 'full-marathon'].map((id) => repository.enrollChallenge(id)))
    render(<AppShell repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Season' }))
    expect(await screen.findByRole('heading', { name: 'Run a Full-Marathon' })).toBeInTheDocument()
    expect(screen.getAllByText('Proof required via WhatsApp.')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Submit Run a Full-Marathon for review' }))
    expect(await screen.findByRole('button', { name: 'Withdraw Run a Full-Marathon submission' })).toBeInTheDocument()
    expect(screen.getByText('Submitted · awaiting review')).toBeInTheDocument()
    expect(screen.getAllByText('Proof required via WhatsApp.')).toHaveLength(3)
  })

  it('allows an approved seasonal challenge to be selected and completed again', async () => {
    const repository = createTestRepository()
    await repository.enrollChallenge('5k-run')
    await repository.completeChallenge('5k-run', '2026-09-25')
    const [submission] = await repository.getPendingCompletions()
    await repository.reviewCompletion(submission.id, 'confirmed')

    render(<AppShell repository={repository} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add challenge' }))
    fireEvent.click(screen.getByRole('button', { name: 'Season' }))

    expect(screen.getByRole('button', { name: 'Select Compete in a 5K run' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Select Compete in a 5K run' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Season' }))
    expect(await screen.findAllByRole('heading', { name: 'Compete in a 5K run' })).toHaveLength(2)
  })

  it('submits a challenge idea without letting the player choose XP', async () => {
    const repository = createTestRepository()
    render(<AppShell repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Suggest a challenge' }))
    expect(screen.getByRole('dialog', { name: 'Suggest a challenge' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/xp/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Idea title'), { target: { value: 'Read before bed' } })
    fireEvent.change(screen.getByLabelText('Why should this be a challenge?'), { target: { value: 'Build a consistent reading habit.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit idea' }))

    expect(await screen.findByText('Idea submitted for review.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add challenge' }))
    expect(screen.queryByRole('heading', { name: 'Read before bed' })).not.toBeInTheDocument()
  })

  it('allows customizing weekly gym split with real-time XP calculation', async () => {
    const repository = createTestRepository()
    render(<AppShell repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add challenge' }))
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    expect(screen.getByRole('heading', { name: 'Gym' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Select Gym' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/workout sessions/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/=\s*90 XP/i)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: '5x' }))
    expect(within(dialog).getByText(/=\s*100 XP/i)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /Commit to 5x/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    expect(await screen.findByText('0 / 5 sessions')).toBeInTheDocument()
  })

  it('allows customizing pushup baseline, logging bonus reps up to 2x cap, and raising baseline', async () => {
    const repository = createTestRepository()
    render(<AppShell repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add challenge' }))
    expect(screen.getByRole('heading', { name: 'Pushups' })).toBeInTheDocument()

    // Upfront setup sheet opens on tap
    fireEvent.click(screen.getByRole('button', { name: 'Select Pushups' }))
    const pushupDialog = screen.getByRole('dialog')
    expect(within(pushupDialog).getByText(/Pushup baseline/i)).toBeInTheDocument()
    expect(within(pushupDialog).getByText(/20 XP max/i)).toBeInTheDocument()

    // Select 100 reps and commit
    fireEvent.click(within(pushupDialog).getByRole('button', { name: /Commit to 100 reps/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(await screen.findByText('0 / 100 reps')).toBeInTheDocument()

    // Log 100 reps to reach baseline
    fireEvent.click(screen.getByRole('heading', { name: /Pushups/ }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '100' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // Completed baseline
    expect(await screen.findByText('100 / 100 reps')).toBeInTheDocument()

    // Log 20 bonus reps (allowed up to 200)
    fireEvent.click(screen.getByRole('heading', { name: /Pushups/ }))
    const bonusInput = screen.getByRole('spinbutton')
    fireEvent.change(bonusInput, { target: { value: '20' } })
    fireEvent.keyDown(bonusInput, { key: 'Enter' })

    expect(await screen.findByText('120 / 100 reps (+20 bonus)')).toBeInTheDocument()
    expect(screen.getByText('+12 XP')).toBeInTheDocument()

    // Raise baseline mid-challenge to 150
    fireEvent.click(screen.getByRole('button', { name: /Raise baseline/i }))
    const raiseDialog = screen.getByRole('dialog')
    expect(within(raiseDialog).getByText(/Raise Pushup Baseline/i)).toBeInTheDocument()

    fireEvent.click(within(raiseDialog).getByRole('button', { name: /Raise to 150 reps/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(await screen.findByText(/120 \/ 150 reps/)).toBeInTheDocument()
  })
})

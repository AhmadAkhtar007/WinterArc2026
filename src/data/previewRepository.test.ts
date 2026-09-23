import { describe, expect, it } from 'vitest'
import { createPreviewRepository } from './previewRepository'

describe('preview repository', () => {
  it('awards a daily challenge once per period', async () => {
    const repository = createPreviewRepository()

    await repository.enrollChallenge('pullups')
    const completion = await repository.completeChallenge('pullups')

    expect(completion.status).toBe('confirmed')
    expect(completion.pointsAwarded).toBe(12)
    await expect(repository.completeChallenge('pullups')).rejects.toThrow('already complete')
  })

  it('removes a completion and its XP so the challenge can be completed again', async () => {
    const repository = createPreviewRepository()

    await repository.enrollChallenge('pullups')
    await repository.completeChallenge('pullups')
    expect((await repository.getLeaderboard()).find((entry) => entry.isCurrentPlayer)?.points).toBe(1402)

    await repository.uncompleteChallenge('pullups')
    expect((await repository.getChallenges()).find((challenge) => challenge.id === 'pullups')?.completed).toBe(false)
    expect((await repository.getLeaderboard()).find((entry) => entry.isCurrentPlayer)?.points).toBe(1390)

    await expect(repository.completeChallenge('pullups')).resolves.toMatchObject({ challengeId: 'pullups' })
  })
  it('keeps high-value challenge points pending', async () => {
    const repository = createPreviewRepository()

    await repository.enrollChallenge('ship-product')
    const completion = await repository.completeChallenge('ship-product')

    expect(completion.status).toBe('pending')
    expect((await repository.getLeaderboard()).find((entry) => entry.isCurrentPlayer)?.points).toBe(1390)
  })

  it('tracks weekly challenges in one period', async () => {
    const repository = createPreviewRepository()

    await repository.enrollChallenge('gym-weekly')
    await repository.recordChallengeProgress('gym-weekly', 1, '2026-W39')
    expect((await repository.getChallenges()).find((challenge) => challenge.id === 'gym-weekly')?.progress).toBe(1)
  })
})

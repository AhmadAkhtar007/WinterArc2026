import { describe, expect, it } from 'vitest'
import { createPreviewRepository } from './previewRepository'

describe('preview repository', () => {
  it('awards a daily challenge once per period', async () => {
    const repository = createPreviewRepository()

    const completion = await repository.completeChallenge('water')

    expect(completion.status).toBe('confirmed')
    expect(completion.pointsAwarded).toBe(10)
    await expect(repository.completeChallenge('water')).rejects.toThrow('already complete')
  })

  it('keeps high-value challenge points pending', async () => {
    const repository = createPreviewRepository()

    const completion = await repository.completeChallenge('ship-product')

    expect(completion.status).toBe('pending')
    expect((await repository.getLeaderboard()).find((entry) => entry.isCurrentPlayer)?.points).toBe(1380)
  })
})

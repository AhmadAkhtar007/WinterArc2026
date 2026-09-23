import type { AppRepository } from '../data/appRepository'
import type { Challenge, Completion, DashboardSnapshot, LeaderboardEntry, PendingCompletion } from '../domain/types'

const defaultCatalog: Challenge[] = [
  {
    id: 'deep-work',
    title: 'Deep work block',
    description: 'Ninety uninterrupted minutes on the work that changes your trajectory.',
    frequency: 'daily',
    points: 20,
    requiresApproval: false,
    category: 'craft',
    completed: false,
    trackingMode: 'binary',
  },
  {
    id: 'ship-product',
    title: 'Build & Ship an App that solves a real-world problem',
    description: 'Launch a useful product and submit proof for review.',
    frequency: 'once',
    points: 500,
    requiresApproval: true,
    category: 'craft',
    completed: false,
    trackingMode: 'binary',
  },
  {
    id: '5k-run',
    title: 'Compete in a 5K run',
    description: 'Complete the challenge and submit proof on WhatsApp for review.',
    frequency: 'once',
    points: 100,
    requiresApproval: true,
    category: 'body',
    completed: false,
    trackingMode: 'binary',
  },
  {
    id: 'half-marathon',
    title: 'Run a Half-Marathon',
    description: 'Run 21.1 km and submit proof on WhatsApp for review.',
    frequency: 'once',
    points: 250,
    requiresApproval: true,
    category: 'body',
    completed: false,
    trackingMode: 'binary',
  },
  {
    id: 'full-marathon',
    title: 'Run a Full-Marathon',
    description: 'Run 42.2 km and submit proof on WhatsApp for review.',
    frequency: 'once',
    points: 500,
    requiresApproval: true,
    category: 'body',
    completed: false,
    trackingMode: 'binary',
  },
]

const dashboard = (admin: boolean): DashboardSnapshot => ({
  profile: { id: 'test-player', playerCode: 'player001', displayName: 'Legend', initials: 'LG', isAdmin: admin },
  dayNumber: 1,
  totalDays: 100,
  daysRemaining: 99,
  points: 0,
  rank: 2,
  streak: 0,
  completionRate: 0,
})

const defaultLeaderboard: LeaderboardEntry[] = [
  { id: 'rayyan', rank: 1, displayName: 'Rayyan', initials: 'RY', points: 120, completedCount: 5, isCurrentPlayer: false },
  { id: 'test-player', rank: 2, displayName: 'Legend', initials: 'LG', points: 0, completedCount: 0, isCurrentPlayer: true },
]

interface TestRepositoryOptions {
  admin?: boolean
  pending?: boolean
  initialChallenges?: Challenge[]
}

export function createTestRepository({
  admin = false,
  pending = false,
  initialChallenges,
}: TestRepositoryOptions = {}): AppRepository {
  const catalog = defaultCatalog.map((c) => ({ ...c }))
  let challenges: Challenge[] = initialChallenges
    ? [...initialChallenges]
    : pending
      ? [{ ...catalog[2], completed: true, status: 'pending' as const }]
      : []

  const pendingCompletions: PendingCompletion[] = pending
    ? [{
        id: 'pending-proof',
        challengeId: catalog[2].id,
        periodKey: '2026-season',
        pointsAwarded: catalog[2].points,
        status: 'pending',
        completedAt: new Date('2026-09-23T12:00:00Z').toISOString(),
        playerName: 'Legend',
        challengeTitle: catalog[2].title,
      }]
    : []

  return {
    async getDashboard() {
      return dashboard(admin)
    },
    async getChallenges() {
      return challenges
    },
    async getChallengeCatalog() {
      return catalog
    },
    async enrollChallenge(challengeId) {
      const match = catalog.find((c) => c.id === challengeId)
      if (match && !challenges.some((c) => c.id === challengeId)) {
        challenges = [...challenges, { ...match }]
      }
    },
    async getLeaderboard() {
      return defaultLeaderboard
    },
    async completeChallenge(challengeId, periodKey = '2026-season'): Promise<Completion> {
      const target = challenges.find((c) => c.id === challengeId)
      const points = target?.points ?? 0
      const status = target?.requiresApproval ? ('pending' as const) : ('confirmed' as const)
      if (target) {
        target.completed = true
        target.status = status
      }
      const completion: Completion = {
        id: `completion-${challengeId}`,
        challengeId,
        periodKey,
        pointsAwarded: status === 'confirmed' ? points : 0,
        status,
        completedAt: new Date().toISOString(),
      }
      if (target?.requiresApproval) {
        pendingCompletions.push({
          id: `pending-${challengeId}`,
          challengeId,
          periodKey,
          pointsAwarded: points,
          status: 'pending',
          completedAt: completion.completedAt,
          playerName: 'Legend',
          challengeTitle: target.title,
        })
      }
      return completion
    },
    async uncompleteChallenge(challengeId) {
      const target = challenges.find((c) => c.id === challengeId)
      if (target) {
        target.completed = false
        target.status = undefined
      }
    },
    async recordChallengeProgress() {},
    async removeChallengeProgressEntry() {},
    async getPendingCompletions() {
      return pendingCompletions
    },
    async reviewCompletion(completionId, decision) {
      const completion = pendingCompletions.find((c) => c.id === completionId)
      if (completion) completion.status = decision
    },
    async reverseCompletion() {},
    async updateDisplayName() {},
    async updatePassword() {},
    async signOut() {},
  }
}

import type { AppRepository } from './appRepository'
import type {
  Challenge,
  ChallengeInput,
  Completion,
  DashboardSnapshot,
  LeaderboardEntry,
  PendingCompletion,
} from '../domain/types'

const challenges: Challenge[] = [
  {
    id: 'water',
    title: 'Hydration protocol',
    description: 'Drink 2.5 litres of water before the day closes.',
    frequency: 'daily',
    points: 10,
    requiresApproval: false,
    category: 'body',
    metric: '1.8 / 2.5 L',
    progress: 72,
    target: 100,
    completed: false,
  },
  {
    id: 'pushups',
    title: '100 push-ups',
    description: 'Complete one hundred deliberate repetitions in any number of sets.',
    frequency: 'daily',
    points: 20,
    requiresApproval: false,
    category: 'body',
    metric: '75 / 100 reps',
    progress: 75,
    target: 100,
    completed: false,
  },
  {
    id: 'deep-work',
    title: 'Deep work block',
    description: 'Ninety uninterrupted minutes on the work that changes your trajectory.',
    frequency: 'daily',
    points: 20,
    requiresApproval: false,
    category: 'craft',
    metric: '90 min',
    progress: 100,
    target: 100,
    completed: true,
    status: 'confirmed',
  },
  {
    id: 'ship-product',
    title: 'Ship something real',
    description: 'Launch a useful product and share proof in the Winter Arc community.',
    frequency: 'once',
    points: 500,
    requiresApproval: true,
    category: 'craft',
    metric: 'Season quest',
    progress: 35,
    target: 100,
    completed: false,
  },
]

const leaderboardSeed: LeaderboardEntry[] = [
  { id: '2', rank: 1, displayName: 'Rayyan', initials: 'RY', points: 1430, completedCount: 84, isCurrentPlayer: false },
  { id: '1', rank: 2, displayName: 'Ahmad', initials: 'AA', points: 1380, completedCount: 81, isCurrentPlayer: true },
  { id: '3', rank: 3, displayName: 'Hamza', initials: 'HM', points: 1320, completedCount: 79, isCurrentPlayer: false },
  { id: '4', rank: 4, displayName: 'Saad', initials: 'SD', points: 1190, completedCount: 73, isCurrentPlayer: false },
  { id: '5', rank: 5, displayName: 'Zain', initials: 'ZN', points: 1080, completedCount: 69, isCurrentPlayer: false },
]

function currentPeriodKey(frequency: Challenge['frequency']): string {
  if (frequency === 'once') return '2026-season'
  if (frequency === 'weekly') return '2026-W39'
  return '2026-09-23'
}

export function createPreviewRepository(): AppRepository {
  let activeChallenges = structuredClone(challenges)
  const completions = new Map<string, Completion>()

  return {
    async getDashboard(): Promise<DashboardSnapshot> {
      const leaderboard = await this.getLeaderboard()
      return {
        profile: { id: '1', playerCode: 'player001', displayName: 'Legend', initials: 'LG', isAdmin: true },
        dayNumber: 1,
        totalDays: 100,
        daysRemaining: 99,
        points: leaderboard[1].points,
        rank: 2,
        streak: 12,
        completionRate: 68,
        nearestRival: leaderboard[0],
      }
    },
    async getChallenges() {
      return structuredClone(activeChallenges)
    },
    async getLeaderboard() {
      const confirmedPoints = [...completions.values()]
        .filter((completion) => completion.status === 'confirmed')
        .reduce((sum, completion) => sum + completion.pointsAwarded, 0)
      return leaderboardSeed.map((entry) =>
        entry.isCurrentPlayer ? { ...entry, points: entry.points + confirmedPoints } : { ...entry },
      )
    },
    async completeChallenge(challengeId) {
      const challenge = activeChallenges.find((item) => item.id === challengeId)
      if (!challenge) throw new Error('Challenge not found.')
      const periodKey = currentPeriodKey(challenge.frequency)
      const uniqueKey = `${challengeId}:${periodKey}`
      if (completions.has(uniqueKey) || challenge.completed) {
        throw new Error('This challenge is already complete for the current period.')
      }
      const completion: Completion = {
        id: crypto.randomUUID(),
        challengeId,
        periodKey,
        pointsAwarded: challenge.points,
        status: challenge.requiresApproval ? 'pending' : 'confirmed',
        completedAt: new Date().toISOString(),
      }
      completions.set(uniqueKey, completion)
      activeChallenges = activeChallenges.map((item) =>
        item.id === challengeId ? { ...item, completed: true, status: completion.status } : item,
      )
      return completion
    },
    async createChallenge(input: ChallengeInput) {
      const challenge: Challenge = {
        ...input,
        id: crypto.randomUUID(),
        category: 'discipline',
        completed: false,
      }
      activeChallenges = [...activeChallenges, challenge]
      return challenge
    },
    async archiveChallenge(challengeId) {
      activeChallenges = activeChallenges.filter((challenge) => challenge.id !== challengeId)
    },
    async getPendingCompletions(): Promise<PendingCompletion[]> {
      return [...completions.values()]
        .filter((completion) => completion.status === 'pending')
        .map((completion) => ({
          ...completion,
          playerName: 'Ahmad',
          challengeTitle: activeChallenges.find((item) => item.id === completion.challengeId)?.title ?? 'Challenge',
        }))
    },
    async reviewCompletion(completionId, decision) {
      for (const completion of completions.values()) {
        if (completion.id === completionId) completion.status = decision
      }
    },
    async reverseCompletion(completionId) {
      for (const completion of completions.values()) {
        if (completion.id === completionId) completion.status = 'reversed'
      }
    },
    async updateDisplayName() {},
    async updatePassword() {},
    async signOut() {},
  }
}

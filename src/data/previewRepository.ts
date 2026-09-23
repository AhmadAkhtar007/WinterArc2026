import type { AppRepository } from './appRepository'
import type {
  Challenge,
  Completion,
  DashboardSnapshot,
  LeaderboardEntry,
  PendingCompletion,
  ProgressEntry,
  RewardTier,
} from '../domain/types'

const challengeSeed: Challenge[] = [
  {
    id: 'water', title: '2.5L water', description: 'Drink 2.5 litres across the day.', frequency: 'daily',
    points: 10, requiresApproval: false, category: 'body', completed: false, trackingMode: 'quantity',
    unitLabel: 'ml', target: 2500, entryOptions: [], entryStep: 250, burstLimit: 3, minimumIntervalMinutes: 30, rewardTiers: [{ threshold: 2500, points: 10 }],
  },
  {
    id: 'pushups', title: '100 Pushups', description: 'Complete one hundred deliberate repetitions in any number of sets.', frequency: 'daily',
    points: 30, requiresApproval: false, category: 'body', completed: false, trackingMode: 'quantity',
    unitLabel: 'reps', target: 150, entryOptions: [], minimumIntervalMinutes: 5,
    rewardTiers: [{ threshold: 100, points: 20 }, { threshold: 150, points: 30 }],
  },
  {
    id: 'pullups', title: '20 Pullups', description: 'Complete twenty deliberate repetitions.', frequency: 'daily',
    points: 12, requiresApproval: false, category: 'body', completed: false, trackingMode: 'binary',
  },
  {
    id: 'reading', title: 'Read Nonfiction', description: 'Read deliberately and record pages as you finish them.', frequency: 'daily',
    points: 10, requiresApproval: false, category: 'mind', completed: false, trackingMode: 'quantity',
    unitLabel: 'pages', target: 8, entryOptions: [], minimumIntervalMinutes: 0,
    rewardTiers: [{ threshold: 8, points: 10 }],
  },
  {
    id: 'salah', title: 'Salah in Congregation with first takbeer', description: 'Record each prayer after it is performed.', frequency: 'daily',
    points: 25, requiresApproval: false, category: 'discipline', completed: false, trackingMode: 'occurrence',
    unitLabel: 'prayers', target: 5, entryOptions: [1], entryStep: 1, burstLimit: 1, minimumIntervalMinutes: 60, rewardTiers: [{ threshold: 5, points: 25 }],
  },
  {
    id: 'squats-weekly', title: '1000 squats', description: 'Reach one thousand deliberate squats within a 24-hour attempt.', frequency: 'weekly',
    points: 100, requiresApproval: false, category: 'body', completed: false, trackingMode: 'quantity',
    unitLabel: 'reps', target: 1000, entryOptions: [], burstLimit: 1, minimumIntervalMinutes: 0,
    attemptDurationMinutes: 1440, rewardTiers: [{ threshold: 1000, points: 100 }],
  },
  {
    id: 'gym-weekly', title: 'Gym', description: 'Complete three gym sessions this week.', frequency: 'weekly',
    points: 60, requiresApproval: false, category: 'body', completed: false, trackingMode: 'occurrence',
    unitLabel: 'sessions', target: 3, entryOptions: [1], entryStep: 1, burstLimit: 1, minimumIntervalMinutes: 720,
    rewardTiers: [{ threshold: 3, points: 60 }],
  },
  {
    id: 'deep-work', title: 'Deep work block', description: 'Ninety uninterrupted minutes on the work that changes your trajectory.', frequency: 'daily',
    points: 20, requiresApproval: false, category: 'craft', metric: '90 min', completed: true, status: 'confirmed', trackingMode: 'binary',
  },
  {
    id: 'ship-product', title: 'Build & Ship an App that solves a real-world problem', description: 'Launch a useful product and submit proof for review.', frequency: 'once',
    points: 500, requiresApproval: true, category: 'craft', metric: 'Season quest', completed: false, trackingMode: 'binary',
  },
  {
    id: '5k-run', title: 'Compete in a 5K run', description: 'Complete the challenge and submit proof on WhatsApp for review.', frequency: 'once',
    points: 100, requiresApproval: true, category: 'body', metric: 'Proof required', completed: false, trackingMode: 'binary',
  },
  {
    id: 'half-marathon', title: 'Run a Half-Marathon', description: 'Complete the challenge and submit proof on WhatsApp for review.', frequency: 'once',
    points: 500, requiresApproval: true, category: 'body', metric: 'Proof required', completed: false, trackingMode: 'binary',
  },
  {
    id: 'full-marathon', title: 'Run a Full-Marathon', description: 'Complete the challenge and submit proof on WhatsApp for review.', frequency: 'once',
    points: 1000, requiresApproval: true, category: 'body', metric: 'Proof required', completed: false, trackingMode: 'binary',
  },
  {
    id: 'digital-products-100', title: 'Sell $100 worth of Digital Products', description: 'Reach the sales target and submit proof for review.', frequency: 'once',
    points: 100, requiresApproval: true, category: 'craft', metric: 'Proof required', completed: false, trackingMode: 'binary',
  },
  {
    id: 'service-deal-500', title: 'Close a $500 service deal', description: 'Close the deal and submit proof for review.', frequency: 'once',
    points: 500, requiresApproval: true, category: 'craft', metric: 'Proof required', completed: false, trackingMode: 'binary',
  },
  {
    id: 'service-deal-1000', title: 'Close a $1000 service deal', description: 'Close the deal and submit proof for review.', frequency: 'once',
    points: 1000, requiresApproval: true, category: 'craft', metric: 'Proof required', completed: false, trackingMode: 'binary',
  },
  {
    id: 'digital-products-1000', title: 'Sell $1000 worth of Digital Products', description: 'Reach the sales target and submit proof for review.', frequency: 'once',
    points: 1000, requiresApproval: true, category: 'craft', metric: 'Proof required', completed: false, trackingMode: 'binary',
  },
]

const leaderboardSeed: LeaderboardEntry[] = [
  { id: '2', rank: 1, displayName: 'Rayyan', initials: 'RY', points: 1430, completedCount: 84, isCurrentPlayer: false },
  { id: '1', rank: 2, displayName: 'Ahmad', initials: 'AA', points: 1360, completedCount: 80, isCurrentPlayer: true },
  { id: '3', rank: 3, displayName: 'Hamza', initials: 'HZ', points: 1320, completedCount: 79, isCurrentPlayer: false },
  { id: '4', rank: 4, displayName: 'Saad', initials: 'SD', points: 1190, completedCount: 73, isCurrentPlayer: false },
  { id: '5', rank: 5, displayName: 'Zain', initials: 'ZN', points: 1080, completedCount: 69, isCurrentPlayer: false },
]

function localPeriodKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function currentPeriodKey(frequency: Challenge['frequency']): string {
  if (frequency === 'once') return '2026-season'
  if (frequency === 'weekly') {
    const date = new Date()
    const day = date.getDay() || 7
    date.setDate(date.getDate() + 4 - day)
    const yearStart = new Date(date.getFullYear(), 0, 1)
    const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7)
    return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`
  }
  return localPeriodKey()
}

function securedPoints(progress: number, tiers: RewardTier[] = []): number {
  return tiers.reduce((secured, tier) => progress >= tier.threshold ? Math.max(secured, tier.points) : secured, 0)
}

export function createPreviewRepository(): AppRepository {
  const committedChallengeIds = new Set<string>()
  let activeChallenges = structuredClone(challengeSeed)
  const period = localPeriodKey()
  const now = Date.now()
  const progressEntries = new Map<string, ProgressEntry[]>([
    [`water:${period}`, Array.from({ length: 5 }, (_, index) => ({ id: `water-${index}`, amount: 1, recordedAt: new Date(now - (50 - index * 10) * 60_000).toISOString() }))],
    [`pushups:${period}`, [10, 25, 50].map((amount, index) => ({ id: `pushups-${index}`, amount, recordedAt: new Date(now - (30 - index * 10) * 60_000).toISOString() }))],
    [`reading:${period}`, [4, 4, 4].map((amount, index) => ({ id: `reading-${index}`, amount, recordedAt: new Date(now - (90 - index * 20) * 60_000).toISOString() }))],
    [`salah:${period}`, Array.from({ length: 3 }, (_, index) => ({ id: `salah-${index}`, amount: 1, recordedAt: new Date(now - (300 - index * 120) * 60_000).toISOString() }))],
  ])
  const completions = new Map<string, Completion>([
    [`deep-work:${period}`, {
      id: 'preview-deep-work-completion', challengeId: 'deep-work', periodKey: period,
      pointsAwarded: 20, status: 'confirmed', completedAt: new Date(now - 60 * 60_000).toISOString(),
    }],
  ])

  function trackedChallenge(challenge: Challenge): Challenge {
    if ((challenge.trackingMode ?? 'binary') === 'binary') return structuredClone(challenge)
    const challengePeriod = currentPeriodKey(challenge.frequency)
    const entries = structuredClone(progressEntries.get(`${challenge.id}:${challengePeriod}`) ?? [])
    const progress = entries.reduce((total, entry) => total + entry.amount, 0)
    const tiers = challenge.rewardTiers ?? []
    const highestThreshold = tiers.reduce((highest, tier) => Math.max(highest, tier.threshold), challenge.target ?? 0)
    const lastEntry = entries.at(-1)
    const cooldownEndsAt = lastEntry && entries.length % (challenge.burstLimit ?? 1) === 0 && (challenge.minimumIntervalMinutes ?? 0) > 0
      ? new Date(new Date(lastEntry.recordedAt).getTime() + (challenge.minimumIntervalMinutes ?? 0) * 60_000).toISOString()
      : undefined
    const attemptEndsAt = challenge.attemptDurationMinutes && entries.length > 0 && progress < highestThreshold
      ? new Date(new Date(entries[0].recordedAt).getTime() + challenge.attemptDurationMinutes * 60_000).toISOString()
      : undefined
    const attemptFailed = Boolean(challenge.attemptDurationMinutes && entries.length > 0 && progress < highestThreshold
      && new Date(entries[0].recordedAt).getTime() + challenge.attemptDurationMinutes * 60_000 <= Date.now())
    return {
      ...structuredClone(challenge), progress, securedPoints: securedPoints(progress, tiers), progressEntries: entries,
      cooldownEndsAt: cooldownEndsAt && new Date(cooldownEndsAt).getTime() > Date.now() ? cooldownEndsAt : undefined,
      attemptEndsAt: attemptEndsAt && new Date(attemptEndsAt).getTime() > Date.now() ? attemptEndsAt : undefined,
      attemptFailed,
      completed: progress >= highestThreshold,
    }
  }

  return {
    async getDashboard(): Promise<DashboardSnapshot> {
      const leaderboard = await this.getLeaderboard()
      const daily = (await this.getChallenges()).filter((challenge) => challenge.frequency === 'daily')
      const completed = daily.filter((challenge) => challenge.completed).length
      return {
        profile: { id: '1', playerCode: 'player001', displayName: 'Legend', initials: 'LG', isAdmin: true },
        dayNumber: 1, totalDays: 100, daysRemaining: 99, points: leaderboard.find((entry) => entry.isCurrentPlayer)?.points ?? 0,
        rank: 2, streak: 12, completionRate: daily.length ? Math.round((completed / daily.length) * 100) : 0, nearestRival: leaderboard[0],
      }
    },
    async getChallenges() { return activeChallenges.filter((challenge) => committedChallengeIds.has(challenge.id)).map(trackedChallenge) },
    async getChallengeCatalog() { return structuredClone(activeChallenges) },
    async enrollChallenge(challengeId) {
      if (!activeChallenges.some((challenge) => challenge.id === challengeId)) throw new Error('Challenge not found.')
      committedChallengeIds.add(challengeId)
    },
    async getLeaderboard() {
      const completionPoints = [...completions.values()].filter((item) => item.status === 'confirmed').reduce((sum, item) => sum + item.pointsAwarded, 0)
      const trackedPoints = activeChallenges.map(trackedChallenge).reduce((sum, challenge) => sum + (challenge.securedPoints ?? 0), 0)
      return leaderboardSeed.map((entry) => entry.isCurrentPlayer
        ? { ...entry, points: entry.points + completionPoints + trackedPoints, completedCount: entry.completedCount + completions.size }
        : { ...entry })
    },
    async completeChallenge(challengeId) {
      if (!committedChallengeIds.has(challengeId)) throw new Error('Challenge is not committed.')
      const challenge = activeChallenges.find((item) => item.id === challengeId)
      if (!challenge) throw new Error('Challenge not found.')
      if ((challenge.trackingMode ?? 'binary') !== 'binary') throw new Error('This challenge records progress instead of binary completion.')
      const periodKey = currentPeriodKey(challenge.frequency)
      const uniqueKey = `${challengeId}:${periodKey}`
      if (completions.has(uniqueKey) || challenge.completed) throw new Error('This challenge is already complete for the current period.')
      const completion: Completion = {
        id: crypto.randomUUID(), challengeId, periodKey, pointsAwarded: challenge.points,
        status: challenge.requiresApproval ? 'pending' : 'confirmed', completedAt: new Date().toISOString(),
      }
      completions.set(uniqueKey, completion)
      activeChallenges = activeChallenges.map((item) => item.id === challengeId ? { ...item, completed: true, status: completion.status } : item)
      return completion
    },
    async uncompleteChallenge(challengeId) {
      if (!committedChallengeIds.has(challengeId)) throw new Error('Challenge is not committed.')
      const challenge = activeChallenges.find((item) => item.id === challengeId)
      if (!challenge) throw new Error('Challenge not found.')
      const uniqueKey = `${challengeId}:${currentPeriodKey(challenge.frequency)}`
      if (!completions.delete(uniqueKey)) throw new Error('This challenge is not complete for the current period.')
      activeChallenges = activeChallenges.map((item) => item.id === challengeId ? { ...item, completed: false, status: undefined } : item)
    },
    async recordChallengeProgress(challengeId, amount, periodKey) {
      if (!committedChallengeIds.has(challengeId)) throw new Error('Challenge is not committed.')
      const challenge = activeChallenges.find((item) => item.id === challengeId)
      if (!challenge || (challenge.trackingMode ?? 'binary') === 'binary') throw new Error('Tracked challenge not found.')
      if (periodKey !== currentPeriodKey(challenge.frequency)) throw new Error('Progress can only be recorded for the current period.')
      if (!Number.isInteger(amount) || amount <= 0) throw new Error('Progress must be a positive whole number.')
      if (challenge.entryStep && amount !== challenge.entryStep) throw new Error('Progress must use the configured step.')
      if (challenge.trackingMode === 'occurrence' && amount !== 1) throw new Error('Occurrence challenges record one completion at a time.')
      const key = `${challengeId}:${periodKey}`
      let entries = progressEntries.get(key) ?? []
      if (challenge.attemptDurationMinutes && entries.length > 0) {
        const attemptEndsAt = new Date(entries[0].recordedAt).getTime() + challenge.attemptDurationMinutes * 60_000
        if (Date.now() >= attemptEndsAt) entries = []
      }
      const lastEntry = entries.at(-1)
      const nextAllowedAt = lastEntry ? new Date(lastEntry.recordedAt).getTime() + (challenge.minimumIntervalMinutes ?? 0) * 60_000 : 0
      if (entries.length > 0 && entries.length % (challenge.burstLimit ?? 1) === 0 && Date.now() < nextAllowedAt) throw new Error('This challenge is still in cooldown.')
      const progress = entries.reduce((total, entry) => total + entry.amount, 0)
      if (progress >= (challenge.target ?? Number.MAX_SAFE_INTEGER)) throw new Error('This challenge has reached its maximum progress.')
      progressEntries.set(key, [...entries, { id: crypto.randomUUID(), amount, recordedAt: new Date().toISOString() }])
    },
    async removeChallengeProgressEntry(challengeId, entryId, periodKey) {
      if (periodKey !== localPeriodKey()) throw new Error('Only today’s progress can be corrected.')
      const key = `${challengeId}:${periodKey}`
      const entries = progressEntries.get(key) ?? []
      const nextEntries = entries.filter((entry) => entry.id !== entryId)
      if (nextEntries.length === entries.length) throw new Error('Progress entry not found.')
      progressEntries.set(key, nextEntries)
    },
    async getPendingCompletions(): Promise<PendingCompletion[]> {
      return [...completions.values()].filter((completion) => completion.status === 'pending').map((completion) => ({
        ...completion, playerName: 'Ahmad', challengeTitle: activeChallenges.find((item) => item.id === completion.challengeId)?.title ?? 'Challenge',
      }))
    },
    async reviewCompletion(completionId, decision) { for (const completion of completions.values()) if (completion.id === completionId) completion.status = decision },
    async reverseCompletion(completionId) { for (const completion of completions.values()) if (completion.id === completionId) completion.status = 'reversed' },
    async updateDisplayName() {}, async updatePassword() {}, async signOut() {},
  }
}
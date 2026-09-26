import type { AppRepository } from '../data/appRepository'
import type { Challenge, ChallengeIdea, Completion, DashboardSnapshot, LeaderboardEntry, PendingCompletion } from '../domain/types'
import { defaultRules } from '../admin/ChallengeEditor'

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
  {
    id: 'gym',
    title: 'Gym',
    description: 'Commit to your weekly training split. 10 XP per session plus 50 XP completion bonus when you hit your weekly goal.',
    frequency: 'weekly',
    points: 90,
    requiresApproval: false,
    category: 'body',
    completed: false,
    trackingMode: 'occurrence',
    rules: { ...defaultRules, mode: 'occurrence', unit: 'sessions', targets: [1,2,3,4,5,6,7], initialTargets: [1,2,3,4,5,6,7], cap: 7, step: 1, ratePoints: 10, targetBonus: 50, gate: 'immediate' },
    maxProgress: 7, targetRewards: { '1': 60, '2': 70, '3': 80, '4': 90, '5': 100, '6': 110, '7': 120 },
    unitLabel: 'sessions',
    target: 4,
    entryOptions: [1],
    minimumIntervalMinutes: 720,
    burstLimit: 1,
    progress: 0,
    securedPoints: 0,
  },
  {
    id: 'pushups',
    title: 'Pushups',
    description: 'Daily pushups. Earn +1 XP per 10 reps, with a bonus cap of double your baseline.',
    frequency: 'daily',
    points: 10,
    requiresApproval: false,
    category: 'body',
    completed: false,
    trackingMode: 'quantity',
    rules: { ...defaultRules, mode: 'quantity', unit: 'reps', targets: [50,100,150,200], initialTargets: [50,100], cap: 0, capMultiplier: 2, step: 0, rateEvery: 10, ratePoints: 1, targetBonus: 0 },
    maxProgress: 200, targetRewards: { '50': 5, '100': 10, '150': 15, '200': 20 },
    unitLabel: 'reps',
    target: 100,
    progress: 0,
    securedPoints: 0,
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
  completedDays: [],
})

const defaultLeaderboard: LeaderboardEntry[] = [
  { id: 'rayyan', rank: 1, displayName: 'Rayyan', initials: 'RY', points: 120, completedCount: 5, isCurrentPlayer: false },
  { id: 'test-player', rank: 2, displayName: 'Legend', initials: 'LG', points: 0, completedCount: 0, isCurrentPlayer: true },
]

interface TestRepositoryOptions {
  admin?: boolean
  pending?: boolean
  pendingIdea?: boolean
  initialChallenges?: Challenge[]
}

export function createTestRepository({
  admin = false,
  pending = false,
  pendingIdea = false,
  initialChallenges,
}: TestRepositoryOptions = {}): AppRepository {
  const catalog = defaultCatalog.map((c) => ({ ...c, seasonId: 'test-season', published: true }))
  let challenges: Challenge[] = initialChallenges
    ? [...initialChallenges]
    : pending
      ? [{ ...catalog[2], completed: true, status: 'pending' as const }]
      : []
  let runSequence = 0

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

  const pendingIdeas: ChallengeIdea[] = pendingIdea
    ? [{
        id: 'idea-read-before-bed',
        title: 'Read before bed',
        description: 'Build a consistent reading habit.',
        status: 'pending',
        submittedBy: 'test-player',
        submittedAt: new Date('2026-09-25T12:00:00Z').toISOString(),
        playerName: 'Legend',
      }]
    : []

  return {
    async saveChallenge(d) {
      const row: Challenge = { ...d, id: d.id ?? 'new-challenge', points: d.rules.targetBonus,
        requiresApproval: d.rules.approval, trackingMode: d.rules.mode, completed: false }
      catalog.push({ ...row, seasonId: d.seasonId, published: d.published })
    },
    async getDashboard() {
      return dashboard(admin)
    },
    async getChallenges() {
      return challenges
    },
    async getChallengeCatalog() {
      return catalog
    },
    async submitChallengeIdea(title, description) {
      pendingIdeas.push({
        id: `idea-${pendingIdeas.length + 1}`,
        title: title.trim(),
        description: description.trim(),
        status: 'pending',
        submittedBy: 'test-player',
        submittedAt: new Date().toISOString(),
        playerName: 'Legend',
      })
    },
    async getPendingChallengeIdeas() {
      return pendingIdeas.filter((idea) => idea.status === 'pending')
    },
    async reviewChallengeIdea(ideaId, review) {
      const idea = pendingIdeas.find((candidate) => candidate.id === ideaId && candidate.status === 'pending')
      if (!idea) throw new Error('Pending idea not found.')
      idea.status = review.decision
      if (review.decision === 'approved') {
        const d = review.definition!
        catalog.push({ ...d, id: 'published-' + idea.id, points: d.rules.targetBonus,
          requiresApproval: d.rules.approval, trackingMode: d.rules.mode, completed: false })
      }
    },
    async enrollChallenge(challengeId, customTarget) {
      const match = catalog.find((c) => c.id === challengeId)
      const alreadyActive = challenges.some((challenge) =>
        (challenge.catalogId ?? challenge.id) === challengeId
        && (match?.frequency !== 'once' || challenge.status !== 'confirmed'))
      if (match && !alreadyActive) {
        const target = customTarget ?? match.target ?? 1
        const points = match.targetRewards?.[String(target)] ?? match.points
        const runIdentity = match.frequency === 'once'
          ? { id: `${match.id}-run-${++runSequence}`, catalogId: match.id }
          : { id: match.id }
        challenges = [...challenges, { ...match, ...runIdentity, target, points, customTarget }]
      }
    },
    async upgradeChallengeTarget(challengeId, newTarget) {
      challenges = challenges.map((c) => {
        if (c.id === challengeId) {
          return { ...c, pendingTarget: newTarget }
        }
        return c
      })
    },
    async getLeaderboard() {
      return defaultLeaderboard
    },
    async completeChallenge(challengeId, periodKey = '2026-season'): Promise<Completion> {
      const target = challenges.find((c) => c.id === challengeId)
        ?? challenges.find((c) => c.catalogId === challengeId && c.status === undefined)
      const points = target?.points ?? 0
      const status = target?.requiresApproval ? ('pending' as const) : ('confirmed' as const)
      if (target) {
        target.completed = true
        target.status = status
      }
      const completion: Completion = {
        id: `completion-${target?.id ?? challengeId}`,
        challengeId: target?.id ?? challengeId,
        periodKey,
        pointsAwarded: status === 'confirmed' ? points : 0,
        status,
        completedAt: new Date().toISOString(),
      }
      if (target?.requiresApproval) {
        pendingCompletions.push({
          id: `pending-${target.id}`,
          challengeId: target.id,
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
    async recordChallengeProgress(challengeId, amount) {
      challenges = challenges.map((c) => {
        if (c.id === challengeId) {
          const nextProgress = (c.progress ?? 0) + amount
          const target = c.target ?? 1
          const completed = nextProgress >= target
          return { ...c, progress: nextProgress, completed }
        }
        return c
      })
    },
    async getPendingCompletions() {
      return pendingCompletions.filter((completion) => completion.status === 'pending')
    },
    async reviewCompletion(completionId, decision) {
      const completion = pendingCompletions.find((c) => c.id === completionId)
      if (completion) {
        completion.status = decision
        const challenge = challenges.find((candidate) => candidate.id === completion.challengeId)
        if (challenge) {
          challenge.status = decision
          challenge.completed = decision === 'confirmed'
          challenge.active = false
        }
      }
    },
    async updateDisplayName() {},
    async updatePassword() {},
    async signOut() {},
  }
}

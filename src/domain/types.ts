export type ChallengeFrequency = 'daily' | 'weekly' | 'once'
export type CompletionStatus = 'confirmed' | 'pending' | 'reversed'
export type ChallengeTrackingMode = 'binary' | 'quantity' | 'occurrence'
export type ScoringProfile = 'gym' | 'pushups' | 'pullups' | 'water' | 'standard'
export type ChallengeIdeaStatus = 'pending' | 'approved' | 'rejected'

export interface RewardTier {
  threshold: number
  points: number
}

export interface ProgressEntry {
  id: string
  amount: number
  recordedAt: string
}

export interface PlayerProfile {
  id: string
  playerCode: string
  displayName: string
  initials: string
  isAdmin: boolean
  createdAt?: string
}

export interface Challenge {
  id: string
  catalogId?: string
  title: string
  description: string
  frequency: ChallengeFrequency
  points: number
  requiresApproval: boolean
  category: 'body' | 'mind' | 'craft' | 'discipline'
  metric?: string
  progress?: number
  target?: number
  completed: boolean
  status?: CompletionStatus
  trackingMode?: ChallengeTrackingMode
  scoringProfile?: ScoringProfile
  unitLabel?: string
  entryOptions?: number[]
  entryStep?: number
  burstLimit?: number
  minimumIntervalMinutes?: number
  attemptDurationMinutes?: number
  rewardTiers?: RewardTier[]
  securedPoints?: number
  cooldownEndsAt?: string
  attemptEndsAt?: string
  attemptFailed?: boolean
  progressEntries?: ProgressEntry[]
  customTarget?: number
  pointsLabel?: string
}

export interface Completion {
  id: string
  challengeId: string
  periodKey: string
  pointsAwarded: number
  status: CompletionStatus
  completedAt: string
}

export interface LeaderboardEntry {
  id: string
  rank: number
  displayName: string
  initials: string
  points: number
  completedCount: number
  isCurrentPlayer: boolean
}

export interface DashboardSnapshot {
  profile: PlayerProfile
  dayNumber: number
  totalDays: number
  daysRemaining: number
  points: number
  rank: number
  streak: number
  completionRate: number
  nearestRival?: LeaderboardEntry
  completedDays?: number[]
}

export interface PendingCompletion extends Completion {
  playerName: string
  challengeTitle: string
}

export interface ChallengeIdea {
  id: string
  title: string
  description: string
  status: ChallengeIdeaStatus
  submittedBy: string
  submittedAt: string
  playerName: string
}

export interface ChallengeIdeaReview {
  decision: 'approved' | 'rejected'
  frequency?: ChallengeFrequency
  points?: number
  requiresApproval?: boolean
}

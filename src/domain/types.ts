export type ChallengeFrequency = 'daily' | 'weekly' | 'once'
export type CompletionStatus = 'confirmed' | 'pending' | 'reversed'

export interface PlayerProfile {
  id: string
  playerCode: string
  displayName: string
  initials: string
  isAdmin: boolean
}

export interface Challenge {
  id: string
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
  todayChallenges: Challenge[]
  nearestRival?: LeaderboardEntry
}

export interface ChallengeInput {
  title: string
  description: string
  frequency: ChallengeFrequency
  points: number
  requiresApproval: boolean
}

export interface PendingCompletion extends Completion {
  playerName: string
  challengeTitle: string
}

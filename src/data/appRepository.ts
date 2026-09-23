import type {
  Challenge,
  Completion,
  DashboardSnapshot,
  LeaderboardEntry,
  PendingCompletion,
} from '../domain/types'

export interface AppRepository {
  getDashboard(): Promise<DashboardSnapshot>
  getChallenges(): Promise<Challenge[]>
  getChallengeCatalog(): Promise<Challenge[]>
  enrollChallenge(challengeId: string): Promise<void>
  getLeaderboard(): Promise<LeaderboardEntry[]>
  completeChallenge(challengeId: string, periodKey?: string): Promise<Completion>
  uncompleteChallenge(challengeId: string, periodKey?: string): Promise<void>
  recordChallengeProgress(challengeId: string, amount: number, periodKey: string): Promise<void>
  removeChallengeProgressEntry(challengeId: string, entryId: string, periodKey: string): Promise<void>
  getPendingCompletions(): Promise<PendingCompletion[]>
  reviewCompletion(completionId: string, decision: 'confirmed' | 'reversed'): Promise<void>
  reverseCompletion(completionId: string, reason: string): Promise<void>
  updateDisplayName(displayName: string): Promise<void>
  updatePassword(currentPassword: string, password: string): Promise<void>
  signOut(): Promise<void>
}

import type {
  Challenge,
  ChallengeInput,
  Completion,
  DashboardSnapshot,
  LeaderboardEntry,
  PendingCompletion,
} from '../domain/types'

export interface AppRepository {
  getDashboard(): Promise<DashboardSnapshot>
  getChallenges(): Promise<Challenge[]>
  getLeaderboard(): Promise<LeaderboardEntry[]>
  completeChallenge(challengeId: string): Promise<Completion>
  createChallenge(input: ChallengeInput): Promise<Challenge>
  archiveChallenge(challengeId: string): Promise<void>
  getPendingCompletions(): Promise<PendingCompletion[]>
  reviewCompletion(completionId: string, decision: 'confirmed' | 'reversed'): Promise<void>
  reverseCompletion(completionId: string, reason: string): Promise<void>
  updateDisplayName(displayName: string): Promise<void>
  updatePassword(currentPassword: string, password: string): Promise<void>
  signOut(): Promise<void>
}

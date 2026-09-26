import type {
  Challenge,
  ChallengeDefinition,
  ChallengeIdea,
  ChallengeIdeaReview,
  Completion,
  DashboardSnapshot,
  LeaderboardEntry,
  PendingCompletion,
} from '../domain/types'

export interface AppRepository {
  saveChallenge(definition: ChallengeDefinition): Promise<void>
  getDashboard(): Promise<DashboardSnapshot>
  getChallenges(): Promise<Challenge[]>
  getChallengeCatalog(): Promise<Challenge[]>
  submitChallengeIdea(title: string, description: string): Promise<void>
  getPendingChallengeIdeas(): Promise<ChallengeIdea[]>
  reviewChallengeIdea(ideaId: string, review: ChallengeIdeaReview): Promise<void>
  enrollChallenge(challengeId: string, customTarget?: number): Promise<void>
  upgradeChallengeTarget(challengeId: string, newTarget: number): Promise<void>
  getLeaderboard(): Promise<LeaderboardEntry[]>
  completeChallenge(challengeId: string, periodKey?: string): Promise<Completion>
  recordChallengeProgress(challengeId: string, amount: number, periodKey: string, requestId?: string): Promise<void>
  getPendingCompletions(): Promise<PendingCompletion[]>
  reviewCompletion(completionId: string, decision: 'confirmed' | 'reversed'): Promise<void>
  updateDisplayName(displayName: string): Promise<void>
  updatePassword(currentPassword: string, password: string): Promise<void>
  signOut(): Promise<void>
}

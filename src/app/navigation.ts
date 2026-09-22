export type AppRoute = 'challenges' | 'leaderboard' | 'profile' | 'admin'

export const playerNavigation: Array<{ id: AppRoute; label: string }> = [
  { id: 'challenges', label: 'Quests' },
  { id: 'leaderboard', label: 'Ranks' },
  { id: 'profile', label: 'Profile' },
]

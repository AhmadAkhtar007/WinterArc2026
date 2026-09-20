export type AppRoute = 'today' | 'challenges' | 'leaderboard' | 'profile' | 'admin'

export const playerNavigation: Array<{ id: AppRoute; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'challenges', label: 'Quests' },
  { id: 'leaderboard', label: 'Ranks' },
  { id: 'profile', label: 'Profile' },
]

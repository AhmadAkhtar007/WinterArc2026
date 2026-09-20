import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppRepository } from './appRepository'
import type { Challenge, ChallengeInput, Completion, DashboardSnapshot, LeaderboardEntry, PendingCompletion } from '../domain/types'

type ChallengeRow = {
  id: string; title: string; description: string; frequency: Challenge['frequency']; points: number;
  requires_approval: boolean; starts_on: string; ends_on: string; archived_at: string | null
}

type CompletionRow = {
  id: string; user_id: string; challenge_id: string; period_key: string; points_awarded: number;
  status: Completion['status']; completed_at: string
}

function todayInKarachi(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function seasonDay() {
  const today = new Date(`${todayInKarachi()}T00:00:00Z`)
  const start = new Date('2026-09-23T00:00:00Z')
  const day = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1
  return Math.max(0, Math.min(100, day))
}

function mapChallenge(row: ChallengeRow, completion?: CompletionRow): Challenge {
  return {
    id: row.id, title: row.title, description: row.description, frequency: row.frequency, points: row.points,
    requiresApproval: row.requires_approval, category: row.frequency === 'once' ? 'craft' : 'discipline',
    metric: row.frequency === 'once' ? 'Season quest' : row.frequency, completed: Boolean(completion), status: completion?.status,
  }
}

function mapCompletion(row: CompletionRow): Completion {
  return { id: row.id, challengeId: row.challenge_id, periodKey: row.period_key, pointsAwarded: row.points_awarded, status: row.status, completedAt: row.completed_at }
}

export function createSupabaseRepository(client: SupabaseClient): AppRepository {
  async function currentUser() {
    const { data, error } = await client.auth.getUser()
    if (error || !data.user) throw new Error('Your session has expired. Please sign in again.')
    return data.user
  }

  async function leaderboard(): Promise<LeaderboardEntry[]> {
    const user = await currentUser()
    const [{ data: profiles, error: profileError }, { data: completions, error: completionError }] = await Promise.all([
      client.from('profiles').select('id, display_name'),
      client.from('completions').select('user_id, points_awarded, status').eq('status', 'confirmed'),
    ])
    if (profileError || completionError) throw new Error('Leaderboard could not be loaded.')
    const totals = new Map<string, { points: number; count: number }>()
    for (const item of completions ?? []) {
      const current = totals.get(item.user_id) ?? { points: 0, count: 0 }
      totals.set(item.user_id, { points: current.points + item.points_awarded, count: current.count + 1 })
    }
    return (profiles ?? []).map((profile) => {
      const score = totals.get(profile.id) ?? { points: 0, count: 0 }
      return { id: profile.id, rank: 0, displayName: profile.display_name, initials: profile.display_name.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(), points: score.points, completedCount: score.count, isCurrentPlayer: profile.id === user.id }
    }).sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName)).map((entry, index) => ({ ...entry, rank: index + 1 }))
  }

  const repository: AppRepository = {
    async getChallenges() {
      const user = await currentUser()
      const today = todayInKarachi()
      const [{ data: rows, error }, { data: completionRows, error: completionError }] = await Promise.all([
        client.from('challenges').select('*').is('archived_at', null).lte('starts_on', today).gte('ends_on', today).order('points'),
        client.from('completions').select('*').eq('user_id', user.id).neq('status', 'reversed'),
      ])
      if (error || completionError) throw new Error('Challenges could not be loaded.')
      return ((rows ?? []) as ChallengeRow[]).map((row) => mapChallenge(row, (completionRows as CompletionRow[] | null)?.find((completion) => completion.challenge_id === row.id)))
    },
    async getLeaderboard() { return leaderboard() },
    async getDashboard(): Promise<DashboardSnapshot> {
      const user = await currentUser()
      const [{ data: profile, error }, challenges, ranks] = await Promise.all([
        client.from('profiles').select('display_name').eq('id', user.id).single(), repository.getChallenges(), leaderboard(),
      ])
      if (error || !profile) throw new Error('Profile could not be loaded.')
      const me = ranks.find((entry) => entry.id === user.id)
      const dayNumber = seasonDay()
      const completedDaily = challenges.filter((challenge) => challenge.frequency === 'daily' && challenge.completed).length
      const dailyCount = challenges.filter((challenge) => challenge.frequency === 'daily').length
      const displayName = profile.display_name
      return {
        profile: { id: user.id, displayName, initials: displayName.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(), isAdmin: user.app_metadata.role === 'admin' },
        dayNumber, totalDays: 100, daysRemaining: 100 - dayNumber, points: me?.points ?? 0, rank: me?.rank ?? ranks.length,
        streak: 0, completionRate: dailyCount ? Math.round((completedDaily / dailyCount) * 100) : 0,
        todayChallenges: challenges.filter((challenge) => challenge.frequency === 'daily'),
        nearestRival: me && me.rank > 1 ? ranks[me.rank - 2] : undefined,
      }
    },
    async completeChallenge(challengeId) {
      const { data, error } = await client.rpc('complete_challenge', { target_challenge_id: challengeId })
      if (error) throw new Error(error.code === '23505' ? 'This challenge is already complete for the current period.' : error.message)
      const row = (Array.isArray(data) ? data[0] : data) as CompletionRow
      return mapCompletion(row)
    },
    async createChallenge(input: ChallengeInput) {
      const user = await currentUser()
      const { data, error } = await client.from('challenges').insert({ title: input.title, description: input.description, frequency: input.frequency, points: input.points, requires_approval: input.requiresApproval, starts_on: '2026-09-23', ends_on: '2026-12-31', created_by: user.id }).select().single()
      if (error) throw new Error(error.message)
      return mapChallenge(data as ChallengeRow)
    },
    async archiveChallenge(challengeId) {
      const { error } = await client.from('challenges').update({ archived_at: new Date().toISOString() }).eq('id', challengeId)
      if (error) throw new Error(error.message)
    },
    async getPendingCompletions(): Promise<PendingCompletion[]> {
      const { data, error } = await client.from('completions').select('*, profiles!completions_user_id_fkey(display_name), challenges(title)').eq('status', 'pending').order('completed_at')
      if (error) throw new Error(error.message)
      return (data ?? []).map((row: Record<string, any>) => ({ ...mapCompletion(row as CompletionRow), playerName: row.profiles?.display_name ?? 'Player', challengeTitle: row.challenges?.title ?? 'Challenge' }))
    },
    async reviewCompletion(completionId, decision) {
      const { error } = await client.rpc('review_completion', { target_completion_id: completionId, decision })
      if (error) throw new Error(error.message)
    },
    async reverseCompletion(completionId, reason) {
      const { error } = await client.rpc('reverse_completion', { target_completion_id: completionId, reversal_reason: reason })
      if (error) throw new Error(error.message)
    },
    async signOut() { const { error } = await client.auth.signOut(); if (error) throw new Error(error.message) },
  }
  return repository
}

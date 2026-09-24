import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppRepository } from './appRepository'
import type { Challenge, Completion, DashboardSnapshot, LeaderboardEntry, PendingCompletion, ProgressEntry, RewardTier } from '../domain/types'

type ChallengeRow = {
  id: string; title: string; description: string; frequency: Challenge['frequency']; points: number;
  requires_approval: boolean; starts_on: string; ends_on: string; archived_at: string | null;
  completion_id?: string | null; completion_period_key?: string | null; completion_points_awarded?: number | null;
  completion_status?: Completion['status'] | null; completion_completed_at?: string | null;
  tracking_mode?: Challenge['trackingMode']; tracking_unit?: string | null; tracking_target?: number | null;
  entry_options?: number[]; entry_step?: number | null; burst_limit?: number; minimum_interval_minutes?: number; reward_tiers?: RewardTier[];
  progress?: number; secured_points?: number; cooldown_ends_at?: string | null; progress_entries?: ProgressEntry[]
  attempt_ends_at?: string | null; attempt_failed?: boolean
}

type CompletionRow = {
  id: string; user_id: string; challenge_id: string; period_key: string; points_awarded: number;
  status: Completion['status']; completed_at: string
}

function localPeriodKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  const trackingMode = row.tracking_mode ?? 'binary'
  const progress = row.progress ?? 0
  const target = row.tracking_target ?? undefined
  return {
    id: row.id, title: row.title, description: row.description, frequency: row.frequency, points: row.points,
    requiresApproval: row.requires_approval, category: row.frequency === 'once' ? 'craft' : 'discipline',
    metric: row.frequency === 'once' ? 'Season quest' : row.frequency,
    completed: trackingMode === 'binary' ? Boolean(completion) : Boolean(target && progress >= target), status: completion?.status,
    trackingMode, unitLabel: row.tracking_unit ?? undefined, target, entryOptions: row.entry_options ?? [],
    entryStep: row.entry_step ?? undefined, burstLimit: row.burst_limit ?? 1, minimumIntervalMinutes: row.minimum_interval_minutes ?? 0, rewardTiers: row.reward_tiers ?? [],
    progress, securedPoints: row.secured_points ?? 0, cooldownEndsAt: row.cooldown_ends_at ?? undefined,
    attemptEndsAt: row.attempt_ends_at ?? undefined,
    attemptFailed: row.attempt_failed ?? false,
    progressEntries: row.progress_entries ?? [],
  }
}

function completionFromChallenge(row: ChallengeRow): CompletionRow | undefined {
  if (!row.completion_id || !row.completion_period_key || !row.completion_status || !row.completion_completed_at) return undefined
  return {
    id: row.completion_id,
    user_id: '',
    challenge_id: row.id,
    period_key: row.completion_period_key,
    points_awarded: row.completion_points_awarded ?? row.points,
    status: row.completion_status,
    completed_at: row.completion_completed_at,
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
    const { data, error } = await client.rpc('player_leaderboard')
    if (error) throw new Error('Leaderboard could not be loaded.')
    return ((data ?? []) as Array<{ id: string; display_name: string; points: number; completed_count: number }>).map((row, index) => ({
      id: row.id,
      rank: index + 1,
      displayName: row.display_name,
      initials: row.display_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      points: row.points,
      completedCount: row.completed_count,
      isCurrentPlayer: row.id === user.id,
    }))
  }
  const repository: AppRepository = {
    async getChallengeCatalog() {
      await currentUser()
      const { data, error } = await client.from('challenges').select('*').is('archived_at', null)
      if (error) throw new Error('Challenge catalog could not be loaded.')
      return ((data ?? []) as ChallengeRow[]).map((row) => mapChallenge(row))
    },
    async enrollChallenge(challengeId) {
      const { error } = await client.rpc('enroll_challenge', { target_challenge_id: challengeId })
      if (error) throw new Error(error.message)
    },
    async getChallenges() {
      await currentUser()
      const { data: rows, error } = await client.rpc('player_challenges', { target_period_key: localPeriodKey() })
      if (error) throw new Error('Challenges could not be loaded.')
      return ((rows ?? []) as ChallengeRow[]).map((row) => mapChallenge(row, completionFromChallenge(row)))
    },
    async getLeaderboard() { return leaderboard() },
    async getDashboard(): Promise<DashboardSnapshot> {
      const user = await currentUser()
      const [{ data: profile, error }, challenges, ranks] = await Promise.all([
        client.from('profiles').select('display_name, player_code').eq('id', user.id).single(), repository.getChallenges(), leaderboard(),
      ])
      if (error || !profile) throw new Error('Profile could not be loaded.')
      const me = ranks.find((entry) => entry.id === user.id)
      const dayNumber = seasonDay()
      const completedDaily = challenges.filter((challenge) => challenge.frequency === 'daily' && challenge.completed).length
      const dailyCount = challenges.filter((challenge) => challenge.frequency === 'daily').length
      const displayName = profile.display_name
      return {
        profile: { id: user.id, playerCode: profile.player_code, displayName, initials: displayName.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(), isAdmin: user.app_metadata?.role === 'admin' },
        dayNumber, totalDays: 100, daysRemaining: 100 - dayNumber, points: me?.points ?? 0, rank: me?.rank ?? ranks.length,
        streak: 0, completionRate: dailyCount ? Math.round((completedDaily / dailyCount) * 100) : 0,
        nearestRival: me && me.rank > 1 ? ranks[me.rank - 2] : undefined,
      }
    },
    async completeChallenge(challengeId, periodKey = localPeriodKey()) {
      const { data, error } = await client.rpc('complete_challenge', { target_challenge_id: challengeId, target_period_key: periodKey })
      if (error) throw new Error(error.code === '23505' ? 'This challenge is already complete for the current period.' : error.message)
      const row = (Array.isArray(data) ? data[0] : data) as CompletionRow
      return mapCompletion(row)
    },
    async uncompleteChallenge(challengeId, periodKey = localPeriodKey()) {
      const { error } = await client.rpc('uncomplete_challenge', { target_challenge_id: challengeId, target_period_key: periodKey })
      if (error) throw new Error(error.message)
    },    async recordChallengeProgress(challengeId, amount, periodKey) {
      const { error } = await client.rpc('record_challenge_progress', {
        target_challenge_id: challengeId, entry_amount: amount, target_period_key: periodKey,
      })
      if (error) throw new Error(error.message)
    },
    async removeChallengeProgressEntry(challengeId, entryId, periodKey) {
      const { error } = await client.rpc('remove_challenge_progress_entry', {
        target_challenge_id: challengeId, target_entry_id: entryId, target_period_key: periodKey,
      })
      if (error) throw new Error(error.message)
    },
    async getPendingCompletions(): Promise<PendingCompletion[]> {
      const { data, error } = await client.from('completions').select('*, challenges(title)').eq('status', 'pending').order('completed_at')
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as Array<CompletionRow & { challenges: { title: string } | null }>
      const userIds = [...new Set(rows.map((row) => row.user_id))]
      const playerNames = new Map<string, string>()
      if (userIds.length) {
        const { data: profiles, error: profileError } = await client.from('profiles').select('id, display_name').in('id', userIds)
        if (profileError) throw new Error(profileError.message)
        for (const profile of (profiles ?? []) as Array<{ id: string; display_name: string }>) playerNames.set(profile.id, profile.display_name)
      }
      return rows.map((row) => ({ ...mapCompletion(row), playerName: playerNames.get(row.user_id) ?? 'Player', challengeTitle: row.challenges?.title ?? 'Challenge' }))
    },
    async reviewCompletion(completionId, decision) {
      const { error } = await client.rpc('review_completion', { target_completion_id: completionId, decision })
      if (error) throw new Error(error.message)
    },
    async updateDisplayName(displayName) {
      const user = await currentUser()
      const cleanName = displayName.trim()
      if (cleanName.length < 2 || cleanName.length > 40) throw new Error('Display name must be 2 to 40 characters.')
      const { error } = await client.from('profiles').update({ display_name: cleanName }).eq('id', user.id)
      if (error) throw new Error(error.message)
    },
    async updatePassword(currentPassword, password) {
      const user = await currentUser()
      if (!user.email) throw new Error('This account cannot change its password.')
      const { error: verifyError } = await client.auth.signInWithPassword({ email: user.email, password: currentPassword })
      if (verifyError) throw new Error('Current password is incorrect.')
      const { error } = await client.auth.updateUser({ password })
      if (error) throw new Error(error.message)
    },
    async signOut() { const { error } = await client.auth.signOut(); if (error) throw new Error(error.message) },
  }
  return repository
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppRepository } from './appRepository'
import type { Challenge, ChallengeRules, Completion, DashboardSnapshot, LeaderboardEntry, PendingCompletion, ChallengeIdea } from '../domain/types'
import { localDayKey, personalArcDay, personalArcDayKey } from '../domain/challengeRules'

interface CatalogRow {
  id: string; season_id: string; title: string; description: string; category: Challenge['category']
  frequency: Challenge['frequency']; rules: ChallengeRules; published: boolean; target_rewards: Record<string, number>
}
interface PlayerRow {
  id: string; catalog_id: string; title: string; description: string; category: Challenge['category']
  frequency: Challenge['frequency']; rules: ChallengeRules; target: number; progress: number
  reward: number; baseline_reward: number; max_progress: number; active: boolean
  starts_at: string; ends_at: string; pending_target?: number; pending_at?: string; period_id?: string
  status: string; cooldown_ends_at?: string
}
interface Snapshot {
  profile: { id: string; player_code: string; display_name: string; created_at: string }
  seasons: Array<{ id: string; starts_on: string; ends_on: string }>
  catalog: CatalogRow[]; challenges: PlayerRow[]
  leaderboard: Array<{ id: string; display_name: string; points: number; completed_count: number }>
  legacy_points: number
  stats: NonNullable<DashboardSnapshot['stats']>
  daily_history: Array<{ day: string; completed: boolean }>
  pending: PendingCompletion[]; ideas: ChallengeIdea[]
}
function initials(name: string) { return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() }
function catalogChallenge(row: CatalogRow): Challenge {
  return {
    id: row.id, seasonId: row.season_id, title: row.title, description: row.description,
    category: row.category, frequency: row.frequency, rules: row.rules, published: row.published,
    points: row.target_rewards[String(row.rules.initialTargets[0])] ?? 0, targetRewards: row.target_rewards, requiresApproval: row.rules.approval, completed: false, target: row.rules.initialTargets[0],
    trackingMode: row.rules.mode, unitLabel: row.rules.unit,
  }
}
function playerChallenge(row: PlayerRow): Challenge {
  return {
    id: row.id, catalogId: row.catalog_id, title: row.title, description: row.description,
    category: row.category, frequency: row.frequency, rules: row.rules, target: row.target,
    progress: row.progress, securedPoints: row.reward, points: row.baseline_reward, maxProgress: row.max_progress,
    active: row.active, startsAt: row.starts_at, pendingTarget: row.pending_target, pendingAt: row.pending_at,
    periodId: row.period_id, requiresApproval: row.rules.approval,
    completed: row.progress >= row.target && row.status !== 'rejected' && row.status !== 'failed',
    status: row.status === 'pending' ? 'pending' : row.status === 'rejected' ? 'reversed'
      : row.status === 'confirmed' || (row.progress >= row.target && !row.rules.approval) ? 'confirmed' : undefined,
    trackingMode: row.rules.mode, unitLabel: row.rules.unit, entryStep: row.rules.step || undefined,
    cooldownEndsAt: row.cooldown_ends_at,
    attemptEndsAt: row.frequency === 'once' && row.rules.durationMinutes > 0 ? row.ends_at : undefined,
    attemptFailed: row.status === 'failed', attemptDurationMinutes: row.rules.durationMinutes,
  }
}
export function createSupabaseRepository(client: SupabaseClient): AppRepository {
  let pending: Promise<Snapshot> | undefined
  async function snapshot() {
    if (!pending) {
      pending = (async () => {
        const { data, error } = await client.rpc('arc_snapshot')
        if (error) throw new Error(error.message)
        return data as Snapshot
      })()
      const current = pending
      void current.finally(() => { if (pending === current) pending = undefined }).catch(() => {})
    }
    return pending
  }
  async function mutate(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args)
    if (error) throw new Error(error.message)
    pending = undefined
    return data
  }
  function ranks(s: Snapshot): LeaderboardEntry[] {
    return s.leaderboard.map((r, i) => ({
      id: r.id, rank: i + 1, displayName: r.display_name, initials: initials(r.display_name),
      points: r.points, completedCount: r.completed_count, isCurrentPlayer: r.id === s.profile.id,
    }))
  }
  const repository: AppRepository = {
    async getChallengeCatalog() { return (await snapshot()).catalog.map(catalogChallenge) },
    async getChallenges() { return (await snapshot()).challenges.map(playerChallenge) },
    async getLeaderboard() { return ranks(await snapshot()) },
    async getDashboard() {
      const s = await snapshot()
      const { data, error } = await client.auth.getUser()
      if (error || !data.user) throw new Error('Sign in again.')
      const arc = personalArcDay(s.profile.created_at)
      const completed = new Set(s.daily_history.filter((d) => d.completed).map((d) => d.day))
      const completedDays = Array.from({ length: arc.totalDays }, (_, i) => i)
        .filter((i) => completed.has(personalArcDayKey(s.profile.created_at, i)))
      let streak = 0
      let i = completed.has(localDayKey()) ? arc.dayNumber - 1 : arc.dayNumber - 2
      while (i >= 0 && completedDays.includes(i)) { streak++; i-- }
      const leaderboard = ranks(s)
      const me = leaderboard.find((r) => r.isCurrentPlayer)
      return {
        profile: { id: s.profile.id, playerCode: s.profile.player_code, displayName: s.profile.display_name,
          initials: initials(s.profile.display_name), createdAt: s.profile.created_at, isAdmin: data.user.app_metadata?.role === 'admin' },
        ...arc, points: me?.points ?? 0, rank: me?.rank ?? 0, streak, completedDays, stats: s.stats, legacyPoints: s.legacy_points,
        completionRate: s.daily_history.length ? Math.round(completed.size / s.daily_history.length * 100) : 0,
        nearestRival: me && me.rank > 1 ? leaderboard[me.rank - 2] : undefined,
      }
    },
    async enrollChallenge(challengeId, target) {
      const d = (await snapshot()).catalog.find((c) => c.id === challengeId)
      if (!d) throw new Error('Challenge unavailable.')
      await mutate('arc_join', { challenge: challengeId, chosen_target: target ?? d.rules.initialTargets[0] })
    },
    async upgradeChallengeTarget(id, target) { await mutate('arc_upgrade', { commitment: id, new_target: target }) },
    async recordChallengeProgress(id, amount, _period, requestId = crypto.randomUUID()) {
      await mutate('arc_record', { commitment: id, amount, request_id: requestId })
    },
    async completeChallenge(id) {
      await repository.recordChallengeProgress(id, 1, '')
      const c = (await repository.getChallenges()).find((row) => row.id === id)!
      return { id: c.periodId!, challengeId: id, periodKey: localDayKey(), pointsAwarded: c.securedPoints ?? 0,
        status: c.status ?? 'confirmed', completedAt: new Date().toISOString() } as Completion
    },
    async getPendingCompletions() { return (await snapshot()).pending },
    async reviewCompletion(id, decision) { await mutate('arc_review', { period: id, approve: decision === 'confirmed' }) },
    async submitChallengeIdea(title, description) { await mutate('arc_submit_idea', { idea_title: title, idea_description: description }) },
    async getPendingChallengeIdeas() { return (await snapshot()).ideas },
    async reviewChallengeIdea(id, review) {
      if (review.decision === 'approved' && !review.definition) throw new Error('Configure the challenge before publishing.')
      await mutate('arc_review_idea', { idea: id, payload: review.decision === 'approved' ? review.definition : null })
    },
    async saveChallenge(definition) { await mutate('arc_save_challenge', { payload: definition }) },
    async updateDisplayName(displayName) {
      const s = await snapshot()
      const { error } = await client.from('profiles').update({ display_name: displayName.trim() }).eq('id', s.profile.id)
      if (error) throw new Error(error.message)
    },
    async updatePassword(currentPassword, password) {
      const { data, error } = await client.auth.getUser()
      if (error || !data.user?.email) throw new Error('Sign in again.')
      const { error: signInError } = await client.auth.signInWithPassword({ email: data.user.email, password: currentPassword })
      if (signInError) throw new Error('Current password is incorrect.')
      const { error: updateError } = await client.auth.updateUser({ password })
      if (updateError) throw new Error(updateError.message)
    },
    async signOut() { const { error } = await client.auth.signOut(); if (error) throw new Error(error.message) },
  }
  return repository
}

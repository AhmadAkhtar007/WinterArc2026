import { useCallback, useEffect, useState } from 'react'
import type { AppRepository } from '../data/appRepository'
import type { Challenge, DashboardSnapshot, LeaderboardEntry } from '../domain/types'
import { BrandMark } from '../components/BrandMark'
import { BottomNavigation } from '../components/BottomNavigation'
import { ChallengesPage } from '../pages/ChallengesPage'
import { LeaderboardPage } from '../pages/LeaderboardPage'
import { ProfilePage } from '../pages/ProfilePage'
import { TodayPage } from '../pages/TodayPage'
import { AdminPage } from '../admin/AdminPage'
import type { AppRoute } from './navigation'

export function AppShell({ repository }: { repository: AppRepository }) {
  const [route, setRoute] = useState<AppRoute>('today')
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [busyChallenge, setBusyChallenge] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [nextDashboard, nextChallenges, nextLeaderboard] = await Promise.all([
        repository.getDashboard(), repository.getChallenges(), repository.getLeaderboard(),
      ])
      setDashboard(nextDashboard)
      setChallenges(nextChallenges)
      setLeaderboard(nextLeaderboard)
      setError(null)
    } catch {
      setError('The arc could not be loaded. Check your connection and try again.')
    }
  }, [repository])

  useEffect(() => { void refresh() }, [refresh])

  async function completeChallenge(challengeId: string) {
    setBusyChallenge(challengeId)
    setError(null)
    try {
      await repository.completeChallenge(challengeId)
      await refresh()
    } catch (completionError) {
      setError(completionError instanceof Error ? completionError.message : 'Completion could not be recorded.')
    } finally {
      setBusyChallenge(null)
    }
  }

  if (!dashboard) {
    return <main className="loading-screen" aria-live="polite"><BrandMark /><p>Entering the arc</p><span className="loading-line" /></main>
  }

  return (
    <div className="app-frame">
      <div className="grain" aria-hidden="true" />
      <header className="topbar">
        <BrandMark compact />
        <div className="topbar__actions">{dashboard.profile.isAdmin && <button className="admin-switch" type="button" onClick={() => setRoute('admin')}>Command</button>}<button className="profile-chip" type="button" onClick={() => setRoute('profile')} aria-label="Open profile"><span>{dashboard.profile.initials}</span></button></div>
      </header>
      {error && <button className="error-banner" type="button" onClick={() => setError(null)}>{error}<span aria-hidden="true">×</span></button>}
      <main className="page-stage" key={route}>
        {route === 'today' && <TodayPage dashboard={dashboard} busyChallenge={busyChallenge} onComplete={completeChallenge} />}
        {route === 'challenges' && <ChallengesPage challenges={challenges} busyChallenge={busyChallenge} onComplete={completeChallenge} />}
        {route === 'leaderboard' && <LeaderboardPage entries={leaderboard} />}
        {route === 'profile' && <ProfilePage dashboard={dashboard} onSignOut={() => repository.signOut()} onUpdateDisplayName={async (displayName) => { await repository.updateDisplayName(displayName); await refresh() }} onUpdatePassword={(currentPassword, password) => repository.updatePassword(currentPassword, password)} />}
        {route === 'admin' && dashboard.profile.isAdmin && <AdminPage repository={repository} />}
      </main>
      <BottomNavigation activeRoute={route} onNavigate={(nextRoute) => { setRoute(nextRoute); void refresh() }} />
    </div>
  )
}

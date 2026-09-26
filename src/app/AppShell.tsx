import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { AppRepository } from '../data/appRepository'
import type { Challenge, DashboardSnapshot, LeaderboardEntry } from '../domain/types'
import { localDayKey, periodKeyFor } from '../domain/challengeRules'
import { BrandMark } from '../components/BrandMark'
import { BottomNavigation } from '../components/BottomNavigation'
import { ChallengesPage } from '../pages/ChallengesPage'
import { LeaderboardPage } from '../pages/LeaderboardPage'
import { ProfilePage } from '../pages/ProfilePage'
import { AdminPage } from '../admin/AdminPage'
import { usePwaInstall } from '../pwa/usePwaInstall'
import { PwaInstallBanner } from '../pwa/PwaInstallBanner'
import { PwaInstallModal } from '../pwa/PwaInstallModal'
import type { AppRoute } from './navigation'

export function AppShell({ repository }: { repository: AppRepository }) {
  const [route, setRoute] = useState<AppRoute>('challenges')
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [catalog, setCatalog] = useState<Challenge[]>([])
  const [commitMode, setCommitMode] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [busyCommit, setBusyCommit] = useState(false)
  const refreshVersion = useRef(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [busyChallenge, setBusyChallenge] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pwa = usePwaInstall()

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current
    try {
      const [nextDashboard, nextChallenges, nextCatalog, nextLeaderboard] = await Promise.all([
        repository.getDashboard(), repository.getChallenges(), repository.getChallengeCatalog(), repository.getLeaderboard(),
      ])
      if (version !== refreshVersion.current) return
      setDashboard(nextDashboard)
      setChallenges(nextChallenges)
      setCatalog(nextCatalog)
      setLeaderboard(nextLeaderboard)
      setError(null)
    } catch {
      setError('The arc could not be loaded. Check your connection and try again.')
    }
  }, [repository])

  function toggleCommitMode() {
    setSelection(new Set())
    setCommitMode((open) => !open)
  }

  function toggleSelection(challengeId: string) {
    setSelection((current) => {
      const next = new Set(current)
      if (next.has(challengeId)) next.delete(challengeId)
      else next.add(challengeId)
      return next
    })
  }

  async function commitSelection(customTargets?: Record<string, number>, directId?: string) {
    setBusyCommit(true)
    setError(null)
    const targets = directId ? [directId] : Array.from(selection)
    const failed: string[] = []
    for (const challengeId of targets) {
      try {
        await repository.enrollChallenge(challengeId, customTargets?.[challengeId])
      } catch (commitError) {
        failed.push(challengeId)
        setError(commitError instanceof Error ? commitError.message : 'Challenge could not be committed.')
      }
    }
    await refresh()
    setSelection(new Set(failed))
    setBusyCommit(false)
    if (!failed.length) setCommitMode(false)
  }

  async function handleUpgradeTarget(challengeId: string, newTarget: number) {
    setError(null)
    try {
      await repository.upgradeChallengeTarget(challengeId, newTarget)
      await refresh()
    } catch (upgradeError) {
      setError(upgradeError instanceof Error ? upgradeError.message : 'Baseline could not be raised.')
      throw upgradeError
    }
  }

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    let timeout = 0
    const scheduleMidnightRefresh = () => {
      const nextMidnight = new Date()
      nextMidnight.setTime(Date.parse(localDayKey() + 'T00:00:00+05:00') + 86400100)
      timeout = window.setTimeout(() => {
        void refresh().finally(scheduleMidnightRefresh)
      }, nextMidnight.getTime() - Date.now())
    }
    scheduleMidnightRefresh()
    return () => window.clearTimeout(timeout)
  }, [refresh])

  async function toggleChallenge(challengeId: string, completed: boolean) {
    const previousChallenges = challenges
    const challenge = previousChallenges.find((item) => item.id === challengeId)
    if (!completed || !challenge || (challenge.trackingMode ?? 'binary') !== 'binary') return

    setChallenges((currentChallenges) => currentChallenges.map((item) => item.id === challengeId
      ? { ...item, completed, status: completed && item.requiresApproval ? 'pending' : completed ? 'confirmed' : undefined }
      : item))
    setBusyChallenge(challengeId)
    setError(null)
    try {
      await repository.completeChallenge(challengeId, localDayKey())
      void refresh()
    } catch (completionError) {
      setChallenges(previousChallenges)
      setError(completionError instanceof Error ? completionError.message : 'Completion could not be updated.')
    } finally {
      setBusyChallenge(null)
    }
  }

  async function recordChallengeProgress(challengeId: string, amount: number, requestId?: string) {
    const previousChallenges = challenges
    const challenge = previousChallenges.find((item) => item.id === challengeId)
    if (!challenge) return
    const progress = (challenge.progress ?? 0) + amount
    setChallenges((current) => current.map((item) => item.id === challengeId ? { ...item, progress } : item))
    setBusyChallenge(challengeId)
    setError(null)
    try {
      await repository.recordChallengeProgress(challengeId, amount, periodKeyFor(challenge), requestId)
      void refresh()
    } catch (progressError) {
      setChallenges(previousChallenges)
      setError(progressError instanceof Error ? progressError.message : 'Progress could not be recorded.')
      throw progressError
    } finally {
      setBusyChallenge(null)
    }
  }

  if (!dashboard) {
    return <main className="loading-screen" aria-live="polite"><BrandMark /><p>Entering the arc</p><span className="loading-line" /></main>
  }

  const committedIds = new Set(challenges
    .filter((challenge) => challenge.active !== false && (challenge.frequency !== 'once' || challenge.status !== 'confirmed'))
    .map((challenge) => challenge.catalogId ?? challenge.id))

  return (
    <div className="app-frame">
      <div className="grain" aria-hidden="true" />
      <header className="topbar topbar--centered">
        <BrandMark compact />
        {dashboard.profile.isAdmin && <div className="topbar__actions"><button className="admin-switch" type="button" onClick={() => setRoute('admin')}>Command</button></div>}
      </header>
      {error && <button className="error-banner" type="button" onClick={() => setError(null)}>{error}<X aria-hidden="true" size={18} /></button>}
      <main className="page-stage" key={route}>
        {route === 'challenges' && <ChallengesPage challenges={challenges} catalog={catalog} committedIds={committedIds} commitMode={commitMode} selection={selection} busyChallenge={busyChallenge} busyCommit={busyCommit} onToggle={toggleChallenge} onRecord={recordChallengeProgress} onRefresh={() => { void refresh() }} onToggleCommitMode={toggleCommitMode} onToggleSelection={toggleSelection} onConfirmCommit={(customTargets, directId) => { void commitSelection(customTargets, directId) }} onUpgradeTarget={handleUpgradeTarget} onSubmitIdea={(title, description) => repository.submitChallengeIdea(title, description)} />}
        {route === 'leaderboard' && <LeaderboardPage entries={leaderboard} />}
        {route === 'profile' && (
          <ProfilePage
            dashboard={dashboard}
            onSignOut={() => repository.signOut()}
            onUpdateDisplayName={async (displayName) => {
              await repository.updateDisplayName(displayName)
              await refresh()
            }}
            onUpdatePassword={(currentPassword, password) => repository.updatePassword(currentPassword, password)}
            onInstallApp={pwa.triggerInstall}
            isStandalone={pwa.standalone}
          />
        )}
        {route === 'admin' && dashboard.profile.isAdmin && <AdminPage repository={repository} />}
      </main>
      {pwa.canShowBanner && (
        <PwaInstallBanner onInstall={pwa.triggerInstall} onDismiss={pwa.dismissBanner} />
      )}
      <BottomNavigation activeRoute={route} onNavigate={(nextRoute) => { setRoute(nextRoute); void refresh() }} />
      <PwaInstallModal isOpen={pwa.showIosModal} isIos={pwa.isIos} onClose={() => pwa.setShowIosModal(false)} />
    </div>
  )
}

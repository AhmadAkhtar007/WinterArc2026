import { useState, type FormEvent } from 'react'
import type { DashboardSnapshot } from '../domain/types'
import { formatPlayerCode } from '../auth/playerIdentity'

interface ProfilePageProps {
  dashboard: DashboardSnapshot
  onSignOut: () => Promise<void>
  onUpdateDisplayName: (displayName: string) => Promise<void>
  onUpdatePassword: (currentPassword: string, password: string) => Promise<void>
  onInstallApp?: () => void
  isStandalone?: boolean
}

const lifeDimensions = [
  { name: 'Body', score: 62, tone: 'body' },
  { name: 'Mind', score: 74, tone: 'mind' },
  { name: 'Soul', score: 48, tone: 'soul' },
  { name: 'Craft', score: 81, tone: 'craft' },
] as const

export function ProfilePage({ dashboard, onSignOut, onUpdateDisplayName, onUpdatePassword, onInstallApp, isStandalone }: ProfilePageProps) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function updateDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const displayName = String(new FormData(event.currentTarget).get('displayName')).trim()
    setError('')
    try {
      await onUpdateDisplayName(displayName)
      setMessage('Display name updated.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Display name could not be updated.')
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const currentPassword = String(form.get('currentPassword'))
    const password = String(form.get('password'))
    if (password !== String(form.get('confirmPassword'))) {
      setMessage('')
      setError('New passwords do not match.')
      return
    }
    setError('')
    try {
      await onUpdatePassword(currentPassword, password)
      event.currentTarget.reset()
      setMessage('Password changed.')
    } catch (cause) {
      setMessage('')
      setError(cause instanceof Error ? cause.message : 'Password could not be changed.')
    }
  }

  return <div className="page profile-page">
    <section className="profile-identity"><div className="profile-portrait"><span>{dashboard.profile.initials}</span></div><span className="section-kicker">{formatPlayerCode(dashboard.profile.playerCode)}</span><h1>{dashboard.profile.displayName}</h1></section>
    <section className="dimension-section" aria-labelledby="life-balance-heading">
      <h2 className="sr-only" id="life-balance-heading">Life balance</h2>
      <div className="dimension-grid">
        {lifeDimensions.map((dimension) => <article className={`dimension-card dimension-card--${dimension.tone}`} key={dimension.name}>
          <h3>{dimension.name}</h3>
          <strong>{dimension.score}</strong>
          <div className="dimension-meter" role="progressbar" aria-label={`${dimension.name} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={dimension.score}>
            <span style={{ transform: `scaleX(${dimension.score / 100})` }} />
          </div>
        </article>)}
      </div>
    </section>
    <section className="consistency-card"><div className="section-heading"><h2>100-day record</h2><span>{dashboard.completionRate}%</span></div><div className="heatmap" aria-label={`${dashboard.completionRate}% season completion`}>{Array.from({ length: 100 }, (_, day) => {
      const isComplete = dashboard.completedDays
        ? dashboard.completedDays.includes(day)
        : day < dashboard.dayNumber && day % 7 !== 5
      const isToday = day === dashboard.dayNumber - 1
      const className = [isComplete ? 'is-complete' : '', isToday ? 'is-today' : ''].filter(Boolean).join(' ')
      return <span key={day} className={className || undefined} />
    })}</div></section>
    <section className="account-settings">
      <div className="section-heading"><h2>Your identity</h2></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="success-banner" role="status">{message}</div>}
      <div className="account-settings__grid">
        <form onSubmit={updateDisplayName}><h3>Public name</h3><label>Display name<input name="displayName" defaultValue={dashboard.profile.displayName} minLength={2} maxLength={40} required /></label><button className="secondary-button" type="submit">Save display name</button></form>
        <form onSubmit={updatePassword}><h3>Password</h3><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" minLength={8} required /></label><label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label><button className="secondary-button" type="submit">Change password</button></form>
      </div>
    </section>
    <section className="pwa-profile-card">
      <div className="section-heading"><h2>Application</h2></div>
      <div className="pwa-profile-card__content">
        <p>
          {isStandalone
            ? 'Winter Arc is running as an installed standalone app.'
            : 'Add Winter Arc to your home screen for full-screen focus, instant launch, and offline tracking.'}
        </p>
        {!isStandalone && onInstallApp && (
          <button className="secondary-button" type="button" onClick={onInstallApp}>
            Install to home screen
          </button>
        )}
      </div>
    </section>
    <button className="secondary-button" type="button" onClick={() => void onSignOut()}>Sign out</button>
  </div>
}

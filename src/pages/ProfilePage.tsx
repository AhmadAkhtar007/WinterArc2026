import { useState, type FormEvent } from 'react'
import type { DashboardSnapshot } from '../domain/types'
import { formatPlayerCode } from '../auth/playerIdentity'

interface ProfilePageProps {
  dashboard: DashboardSnapshot
  onSignOut: () => Promise<void>
  onUpdateDisplayName: (displayName: string) => Promise<void>
  onUpdatePassword: (currentPassword: string, password: string) => Promise<void>
}

export function ProfilePage({ dashboard, onSignOut, onUpdateDisplayName, onUpdatePassword }: ProfilePageProps) {
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
    <section className="profile-identity"><div className="profile-portrait"><span>{dashboard.profile.initials}</span></div><span className="section-kicker">{formatPlayerCode(dashboard.profile.playerCode)}</span><h1>{dashboard.profile.displayName}</h1><p>Day {dashboard.dayNumber} · {dashboard.streak} day streak</p></section>
    <section className="profile-metrics"><div><strong>{dashboard.points.toLocaleString()}</strong><span>XP earned</span></div><div><strong>#{dashboard.rank}</strong><span>season rank</span></div><div><strong>{dashboard.completionRate}%</strong><span>completion</span></div></section>
    <section className="consistency-card"><div className="section-heading"><div><span className="section-kicker">Consistency</span><h2>100-day record</h2></div><span>{dashboard.completionRate}%</span></div><div className="heatmap" aria-label={`${dashboard.completionRate}% season completion`}>{Array.from({ length: 100 }, (_, day) => <span key={day} className={day < dashboard.dayNumber && day % 7 !== 5 ? 'is-complete' : day === dashboard.dayNumber ? 'is-today' : ''} />)}</div></section>
    <section className="account-settings">
      <div className="section-heading"><div><span className="section-kicker">Private account</span><h2>Your identity</h2></div></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="success-banner" role="status">{message}</div>}
      <div className="account-settings__grid">
        <form onSubmit={updateDisplayName}><h3>Public name</h3><p>This is the name shown on the leaderboard.</p><label>Display name<input name="displayName" defaultValue={dashboard.profile.displayName} minLength={2} maxLength={40} required /></label><button className="secondary-button" type="submit">Save display name</button></form>
        <form onSubmit={updatePassword}><h3>Password</h3><p>Your Player ID never changes. Keep its password private.</p><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" minLength={8} required /></label><label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label><button className="secondary-button" type="submit">Change password</button></form>
      </div>
    </section>
    <button className="secondary-button" type="button" onClick={() => void onSignOut()}>Sign out</button>
  </div>
}

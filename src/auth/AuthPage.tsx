import { useState, type FormEvent } from 'react'
import { BrandMark } from '../components/BrandMark'
import { formatPlayerCode } from './playerIdentity'

type AuthMode = 'welcome' | 'create' | 'signin' | 'reveal'

interface AuthPageProps {
  assignedPlayerCode?: string
  onEnter?: () => void
  onCreateIdentity: (displayName: string, password: string) => Promise<string>
  onSignIn: (playerCode: string, password: string) => Promise<void>
}

export function AuthPage({ assignedPlayerCode = '', onEnter, onCreateIdentity, onSignIn }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('welcome')
  const [playerCode, setPlayerCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function createIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const displayName = String(form.get('displayName')).trim()
    const password = String(form.get('password'))
    if (password !== String(form.get('confirmPassword'))) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const assignedCode = await onCreateIdentity(displayName, password)
      setPlayerCode(assignedCode)
      setMode('reveal')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your identity could not be created.')
    } finally {
      setBusy(false)
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await onSignIn(String(form.get('playerCode')), String(form.get('password')))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  const visibleMode: AuthMode = assignedPlayerCode ? 'reveal' : mode
  const visiblePlayerCode = assignedPlayerCode || playerCode

  return <main className={`auth-page auth-page--${visibleMode}`}>
    <div className="grain" aria-hidden="true" />
    <section className="auth-story">
      <BrandMark />
      <div>
        <span className="section-kicker">September 23 — December 31</span>
        <h1>{visibleMode === 'reveal' ? <>Your place<br /><em>is sealed.</em></> : <>One hundred days.<br /><em>No spectators.</em></>}</h1>
        <p>{visibleMode === 'reveal' ? 'Your number is permanent. What it comes to mean is entirely yours.' : 'The final hundred days of 2026 become a public record of the promises you kept.'}</p>
      </div>
      <small>Winter Arc / 2026</small>
    </section>
    <section className="auth-panel">
      <div className="auth-panel__inner">
        {visibleMode === 'welcome' && <>
          <span className="section-kicker">The final 100</span>
          <h2>Build the person who finishes.</h2>
          <p>No email. No noise. Just a private identity, your daily record, and the leaderboard.</p>
          <div className="auth-actions">
            <button className="primary-button" type="button" onClick={() => setMode('create')}><span>Create my identity</span><i aria-hidden="true">↗</i></button>
            <button className="text-button" type="button" onClick={() => setMode('signin')}>I already have an identity</button>
          </div>
        </>}
        {visibleMode === 'create' && <>
          <span className="section-kicker">Identity protocol</span>
          <h2>Choose your name.</h2>
          <p>We assign your permanent Player ID. Your display name can change later.</p>
          <form onSubmit={createIdentity}>
            <label>Display name<input name="displayName" autoComplete="nickname" minLength={2} maxLength={40} required /></label>
            <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
            <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy} type="submit"><span>{busy ? 'Assigning…' : 'Claim my place'}</span><i aria-hidden="true">↗</i></button>
          </form>
          <button className="text-button" type="button" onClick={() => { setError(''); setMode('signin') }}>I already have an identity</button>
        </>}
        {visibleMode === 'signin' && <>
          <span className="section-kicker">Private entry</span>
          <h2>Return to the arc.</h2>
          <p>Enter the Player ID you received when you joined.</p>
          <form onSubmit={signIn}>
            <label>Player ID<input name="playerCode" inputMode="text" autoCapitalize="characters" autoComplete="username" placeholder="PLAYER 001" required /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy} type="submit"><span>{busy ? 'Entering…' : 'Enter Winter Arc'}</span><i aria-hidden="true">↗</i></button>
          </form>
          <button className="text-button" type="button" onClick={() => { setError(''); setMode('create') }}>Create a new identity</button>
        </>}
        {visibleMode === 'reveal' && <div className="identity-reveal" aria-live="polite">
          <span className="identity-reveal__prelude">You are</span>
          <strong>{formatPlayerCode(visiblePlayerCode)}</strong>
          <p>This is your permanent login ID. Save it somewhere private.</p>
          <button className="primary-button" type="button" onClick={() => onEnter ? onEnter() : window.location.reload()}><span>Enter the arc</span><i aria-hidden="true">↗</i></button>
        </div>}
      </div>
    </section>
  </main>
}

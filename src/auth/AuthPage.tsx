import { useState, type FormEvent } from 'react'
import { BrandMark } from '../components/BrandMark'
import { IntroSequence } from './IntroSequence'
import { formatPlayerCode } from './playerIdentity'

export const INTRO_STORAGE_KEY = 'winter-arc:intro-2026-authenticated'

function markIntroComplete() {
  try {
    localStorage.setItem(INTRO_STORAGE_KEY, 'complete')
  } catch {
    // Authentication still succeeds when local storage is unavailable.
  }
}

type AuthMode = 'welcome' | 'create-name' | 'create-password' | 'signin' | 'reveal'

interface AuthPageProps {
  assignedPlayerCode?: string
  onEnter?: () => void
  onCreateIdentity: (displayName: string, password: string) => Promise<string>
  onSignIn: (playerCode: string, password: string) => Promise<void>
}

export function AuthPage({ assignedPlayerCode = '', onEnter, onCreateIdentity, onSignIn }: AuthPageProps) {
  const [showIntro, setShowIntro] = useState(() => {
    if (assignedPlayerCode) return false
    try {
      return localStorage.getItem(INTRO_STORAGE_KEY) !== 'complete'
    } catch {
      return true
    }
  })
  const [mode, setMode] = useState<AuthMode>('welcome')
  const [displayName, setDisplayName] = useState('')
  const [playerCode, setPlayerCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function createIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    if (password !== String(form.get('confirmPassword'))) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const assignedCode = await onCreateIdentity(displayName, password)
      markIntroComplete()
      setPlayerCode(assignedCode)
      setMode('reveal')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your identity could not be created.')
    } finally {
      setBusy(false)
    }
  }

  function continueWithName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setDisplayName(String(form.get('displayName')).trim())
    setError('')
    setMode('create-password')
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await onSignIn(String(form.get('playerCode')), String(form.get('password')))
      markIntroComplete()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  const visibleMode: AuthMode = assignedPlayerCode ? 'reveal' : mode
  const visiblePlayerCode = assignedPlayerCode || playerCode

  if (showIntro && !assignedPlayerCode) return <IntroSequence onComplete={() => setShowIntro(false)} />

  return <main className={`auth-page auth-page--${visibleMode}`}>
    <div className="grain" aria-hidden="true" />
    <div className="auth-atmosphere" aria-hidden="true" />
    <header className="auth-header">
      <BrandMark />
    </header>
    <section className="auth-stage">
      <div className="auth-panel__inner">
        {visibleMode === 'welcome' && <>
          <h1>Enter Your Prime.</h1>
          <div className="auth-actions">
            <button className="primary-button" type="button" onClick={() => setMode('create-name')}>Begin</button>
            <button className="text-button" type="button" onClick={() => setMode('signin')}>Already have an identity? Enter</button>
          </div>
        </>}
        {visibleMode === 'create-name' && <>
          <span className="auth-step">01 / 02</span>
          <h1>Choose Your Name.</h1>
          <form onSubmit={continueWithName}>
            <label>Display name<input name="displayName" autoComplete="nickname" minLength={2} maxLength={40} defaultValue={displayName} autoFocus required /></label>
            <button className="primary-button" type="submit">Continue</button>
          </form>
          <button className="text-button" type="button" onClick={() => setMode('welcome')}>Back</button>
        </>}
        {visibleMode === 'create-password' && <>
          <span className="auth-step">02 / 02</span>
          <h1>Seal Your Place.</h1>
          <form onSubmit={createIdentity}>
            <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} autoFocus required /></label>
            <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy} type="submit">{busy ? 'Assigning…' : 'Claim my place'}</button>
          </form>
          <button className="text-button" type="button" onClick={() => { setError(''); setMode('create-name') }}>Back</button>
        </>}
        {visibleMode === 'signin' && <>
          <span className="auth-step">Private entry</span>
          <h1>Welcome Back.</h1>
          <form onSubmit={signIn}>
            <label>Player ID<input name="playerCode" inputMode="text" autoCapitalize="characters" autoComplete="username" placeholder="PLAYER 001" autoFocus required /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy} type="submit">{busy ? 'Entering…' : 'Enter'}</button>
          </form>
          <button className="text-button" type="button" onClick={() => { setError(''); setMode('welcome') }}>Back</button>
        </>}
        {visibleMode === 'reveal' && <div className="identity-reveal" aria-live="polite">
          <span className="auth-step">Your permanent ID</span>
          <strong>{formatPlayerCode(visiblePlayerCode)}</strong>
          <p>Save it somewhere private.</p>
          <button className="primary-button" type="button" onClick={() => onEnter ? onEnter() : window.location.reload()}>Enter the arc</button>
        </div>}
      </div>
    </section>
    <footer className="auth-footer">100 days / 2026</footer>
  </main>
}

import { useState, type FormEvent } from 'react'
import { BrandMark } from '../components/BrandMark'

export function AuthPage({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<void> }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try { await onSignIn(String(data.get('email')), String(data.get('password'))) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in failed.') }
    finally { setBusy(false) }
  }

  return <main className="auth-page">
    <div className="grain" aria-hidden="true" />
    <section className="auth-story"><BrandMark /><div><span className="section-kicker">September 23 — December 31</span><h1>Become someone<br /><em>unrecognisable.</em></h1><p>One hundred days. One public record of the promises you kept.</p></div><small>Winter Arc / 2026</small></section>
    <section className="auth-panel"><div className="auth-panel__inner"><span className="section-kicker">Private entry</span><h2>Return to the arc.</h2><p>Sign in with your approved participant account.</p><form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button" disabled={busy} type="submit"><span>{busy ? 'Entering…' : 'Enter Winter Arc'}</span><i aria-hidden="true">↗</i></button></form><small>Access is limited to approved participants.</small></div></section>
  </main>
}

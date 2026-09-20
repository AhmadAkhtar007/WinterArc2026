import { useState, type FormEvent } from 'react'
import type { ChallengeInput } from '../domain/types'

export function ChallengeEditor({ onCreate }: { onCreate: (input: ChallengeInput) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true)
    try {
      await onCreate({ title: String(data.get('title')), description: String(data.get('description')), frequency: String(data.get('frequency')) as ChallengeInput['frequency'], points: Number(data.get('points')), requiresApproval: data.get('requiresApproval') === 'on' })
      form.reset()
    } finally { setBusy(false) }
  }
  return <form className="admin-form" onSubmit={submit}>
    <div className="admin-form__heading"><span className="section-kicker">Publish</span><h2>New challenge</h2></div>
    <label>Title<input name="title" required minLength={2} maxLength={80} placeholder="100 push-ups" /></label>
    <label>Instructions<textarea name="description" required minLength={2} maxLength={500} placeholder="Define exactly what counts." /></label>
    <div className="form-row"><label>Frequency<select name="frequency" defaultValue="daily"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="once">Season</option></select></label><label>XP<input name="points" type="number" min="1" max="5000" defaultValue="10" required /></label></div>
    <label className="check-row"><input name="requiresApproval" type="checkbox" /><span>Hold XP until I verify proof on WhatsApp</span></label>
    <button className="primary-button" disabled={busy} type="submit"><span>{busy ? 'Publishing…' : 'Publish challenge'}</span><i aria-hidden="true">↗</i></button>
  </form>
}

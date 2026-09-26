import { useState } from 'react'

export function ChallengeIdeaForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (title: string, description: string) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit(title, description)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The idea could not be submitted.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="modal-backdrop" onClick={onClose}>
    <form className="modal idea-form" role="dialog" aria-modal="true" aria-labelledby="idea-form-title" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
      <h2 id="idea-form-title">Suggest a challenge</h2>
      <p>Share the idea. The admin will decide its rules and XP before it can appear publicly.</p>
      <label>
        <span>Idea title</span>
        <input autoFocus required minLength={2} maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        <span>Why should this be a challenge?</span>
        <textarea required minLength={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal__actions">
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Submitting...' : 'Submit idea'}</button>
        <button className="text-button" type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  </div>
}

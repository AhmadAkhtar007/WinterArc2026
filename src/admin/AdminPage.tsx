import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { AppRepository } from '../data/appRepository'
import type { PendingCompletion } from '../domain/types'
import { ReviewQueue } from './ReviewQueue'

export function AdminPage({ repository }: { repository: AppRepository }) {
  const [pending, setPending] = useState<PendingCompletion[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function refresh() {
    try {
      setPending(await repository.getPendingCompletions())
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The review queue could not be loaded.')
    }
  }
  useEffect(() => { void refresh() }, [])
  async function review(id: string, decision: 'confirmed' | 'reversed') {
    try {
      await repository.reviewCompletion(id, decision)
      setMessage(decision === 'confirmed' ? 'XP confirmed.' : 'Submission rejected.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The submission could not be reviewed.')
    }
    await refresh()
  }
  return <div className="page admin-page">
    <header className="page-header"><h1>Command the<br /><em>season.</em></h1></header>
    {message && <button className="success-banner" type="button" onClick={() => setMessage('')}>{message}<X aria-hidden="true" size={16} /></button>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <ReviewQueue items={pending} onReview={review} />
  </div>
}

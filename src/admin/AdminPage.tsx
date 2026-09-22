import { useEffect, useState } from 'react'
import type { AppRepository } from '../data/appRepository'
import type { Challenge, ChallengeInput, PendingCompletion } from '../domain/types'
import { ChallengeEditor } from './ChallengeEditor'
import { ReviewQueue } from './ReviewQueue'

export function AdminPage({ repository }: { repository: AppRepository }) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [pending, setPending] = useState<PendingCompletion[]>([])
  const [message, setMessage] = useState('')
  async function refresh() { const [nextChallenges, nextPending] = await Promise.all([repository.getChallenges(), repository.getPendingCompletions()]); setChallenges(nextChallenges); setPending(nextPending) }
  useEffect(() => { void refresh() }, [])
  async function create(input: ChallengeInput) { await repository.createChallenge(input); setMessage('Challenge published.'); await refresh() }
  async function archive(id: string) { await repository.archiveChallenge(id); setMessage('Challenge archived.'); await refresh() }
  async function review(id: string, decision: 'confirmed' | 'reversed') { await repository.reviewCompletion(id, decision); setMessage(decision === 'confirmed' ? 'XP confirmed.' : 'Submission rejected.'); await refresh() }
  return <div className="page admin-page">
    <header className="page-header"><h1>Command the<br /><em>season.</em></h1></header>
    {message && <button className="success-banner" type="button" onClick={() => setMessage('')}>{message}<span>×</span></button>}
    <div className="admin-grid"><ChallengeEditor onCreate={create} /><ReviewQueue items={pending} onReview={review} /></div>
    <section className="admin-challenges"><div className="admin-form__heading"><h2>Active challenges</h2></div>{challenges.map((challenge) => <article key={challenge.id}><div><strong>{challenge.title}</strong><span>{challenge.frequency} · {challenge.points} XP{challenge.requiresApproval ? ' · proof required' : ''}</span></div><button type="button" onClick={() => void archive(challenge.id)}>Archive</button></article>)}</section>
  </div>
}

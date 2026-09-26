import { useEffect, useState } from 'react'
import type { AppRepository } from '../data/appRepository'
import type { Challenge, ChallengeIdea, PendingCompletion } from '../domain/types'
import { ReviewQueue } from './ReviewQueue'
import { ChallengeEditor } from './ChallengeEditor'

export function AdminPage({ repository }: { repository: AppRepository }) {
  const [pending, setPending] = useState<PendingCompletion[]>([])
  const [ideas, setIdeas] = useState<ChallengeIdea[]>([])
  const [catalog, setCatalog] = useState<Challenge[]>([])
  const [editing, setEditing] = useState<Challenge | 'new' | null>(null)
  const [idea, setIdea] = useState<ChallengeIdea | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function refresh() {
    const [p, i, c] = await Promise.all([repository.getPendingCompletions(), repository.getPendingChallengeIdeas(), repository.getChallengeCatalog()])
    setPending(p); setIdeas(i); setCatalog(c)
  }
  useEffect(() => { void refresh().catch((e) => setError(String(e))) }, [])
  const seasonId = catalog[0]?.seasonId ?? ''
  return <div className="page admin-page">
    <header className="page-header"><h1>Command the<br /><em>season.</em></h1></header>
    {message && <p role="status">{message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {editing || idea ? <ChallengeEditor key={idea?.id ?? (editing === 'new' ? 'new' : editing?.id)}
      seasonId={seasonId} initial={idea ? { title: idea.title, description: idea.description }
        : editing && editing !== 'new' ? { id: editing.id, title: editing.title, description: editing.description, category: editing.category,
          frequency: editing.frequency, rules: editing.rules, published: editing.published } : undefined}
      onCancel={() => { setEditing(null); setIdea(null) }}
      onSave={async (definition) => {
        if (idea) await repository.reviewChallengeIdea(idea.id, { decision: 'approved', definition })
        else await repository.saveChallenge(definition)
        setEditing(null); setIdea(null); setMessage('Challenge saved.'); await refresh()
      }} /> : <>
      <section className="review-queue"><h2>Challenge catalog</h2>
        <button className="primary-button" disabled={!seasonId} onClick={() => setEditing('new')}>Create challenge</button>
        {catalog.map((c) => <div className="idea-review" key={c.id}><span>{c.title}{c.published === false ? ' · draft' : ''}</span><button onClick={() => setEditing(c)}>Edit</button></div>)}
      </section>
      <section className="review-queue"><h2>Challenge ideas</h2>
        {!ideas.length && <p>No challenge idea is waiting for review.</p>}
        {ideas.map((i) => <article className="idea-review" key={i.id}><div><strong>{i.title}</strong><p>{i.description}</p><small>{i.playerName}</small></div>
          <button onClick={() => setIdea(i)}>Configure and publish</button>
          <button onClick={async () => { try { await repository.reviewChallengeIdea(i.id, { decision: 'rejected' }); await refresh() } catch (e) { setError(String(e)) } }}>Reject</button>
        </article>)}
      </section>
      <ReviewQueue items={pending} onReview={async (id, decision) => {
        try { await repository.reviewCompletion(id, decision); setMessage(decision === 'confirmed' ? 'XP confirmed.' : 'Submission rejected.'); await refresh() }
        catch (e) { setError(String(e)) }
      }} />
    </>}
  </div>
}

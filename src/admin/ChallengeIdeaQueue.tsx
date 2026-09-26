import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { ChallengeFrequency, ChallengeIdea, ChallengeIdeaReview } from '../domain/types'

function ChallengeIdeaReviewRow({
  idea,
  onReview,
}: {
  idea: ChallengeIdea
  onReview: (id: string, review: ChallengeIdeaReview) => Promise<void>
}) {
  const [frequency, setFrequency] = useState<ChallengeFrequency>('daily')
  const [points, setPoints] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const parsedPoints = Number(points)
  const canPublish = Number.isInteger(parsedPoints) && parsedPoints >= 1 && parsedPoints <= 5000

  return <article className="idea-review">
    <div>
      <strong>{idea.title}</strong>
      <p>{idea.description}</p>
      <span>{idea.playerName} � {new Date(idea.submittedAt).toLocaleDateString()}</span>
    </div>
    <div className="idea-review__controls">
      <label>
        <span>Frequency for {idea.title}</span>
        <select aria-label={`Frequency for ${idea.title}`} value={frequency} onChange={(event) => setFrequency(event.target.value as ChallengeFrequency)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="once">Season</option>
        </select>
      </label>
      <label>
        <span>XP for {idea.title}</span>
        <input aria-label={`XP for ${idea.title}`} inputMode="numeric" type="number" min="1" max="5000" value={points} onChange={(event) => setPoints(event.target.value)} />
      </label>
      <label className="idea-review__proof">
        <input aria-label={`Require proof for ${idea.title}`} type="checkbox" checked={requiresApproval} onChange={(event) => setRequiresApproval(event.target.checked)} />
        <span>Require proof</span>
      </label>
      <div className="idea-review__actions">
        <button type="button" aria-label={`Reject ${idea.title}`} onClick={() => void onReview(idea.id, { decision: 'rejected' })}>Reject</button>
        <button type="button" className="approve" aria-label={`Publish ${idea.title}`} disabled={!canPublish} onClick={() => void onReview(idea.id, { decision: 'approved', frequency, points: parsedPoints, requiresApproval })}>Publish</button>
      </div>
    </div>
  </article>
}

export function ChallengeIdeaQueue({
  items,
  onReview,
}: {
  items: ChallengeIdea[]
  onReview: (id: string, review: ChallengeIdeaReview) => Promise<void>
}) {
  return <section className="review-queue">
    <div className="admin-form__heading"><h2>Challenge ideas</h2></div>
    {items.length === 0
      ? <div className="empty-state"><CheckCircle2 aria-hidden="true" size={24} /><p>No challenge idea is waiting for review.</p></div>
      : items.map((idea) => <ChallengeIdeaReviewRow key={idea.id} idea={idea} onReview={onReview} />)}
  </section>
}

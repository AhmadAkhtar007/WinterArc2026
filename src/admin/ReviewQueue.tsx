import type { PendingCompletion } from '../domain/types'
import { CheckCircle2 } from 'lucide-react'

export function ReviewQueue({ items, onReview }: { items: PendingCompletion[]; onReview: (id: string, decision: 'confirmed' | 'reversed') => Promise<void> }) {
  return <section className="review-queue"><div className="admin-form__heading"><h2>Review queue</h2></div>{items.length === 0 ? <div className="empty-state"><CheckCircle2 aria-hidden="true" size={24} /><p>No proof is waiting for review.</p></div> : items.map((item) => <article key={item.id}><div><strong>{item.challengeTitle}</strong><span>{item.playerName} · +{item.pointsAwarded} XP · {new Date(item.completedAt).toLocaleDateString()}</span></div><div><button type="button" onClick={() => void onReview(item.id, 'reversed')}>Reject</button><button type="button" className="approve" onClick={() => void onReview(item.id, 'confirmed')}>Approve</button></div></article>)}</section>
}

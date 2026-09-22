import type { Challenge } from '../domain/types'

export function ChallengeCard({ challenge, busy = false, onComplete, feature = false }: { challenge: Challenge; busy?: boolean; onComplete: (id: string) => void; feature?: boolean }) {
  const isPending = challenge.status === 'pending'
  const isComplete = challenge.completed
  const actionLabel = busy
    ? `Recording ${challenge.title}`
    : isComplete
      ? isPending ? `${challenge.title} awaiting review` : `${challenge.title} completed`
      : `Complete ${challenge.title}`

  return (
    <article className={`challenge-card challenge-card--${challenge.category} ${feature ? 'challenge-card--feature' : ''} ${isComplete ? 'is-complete' : ''}`}>
      <button type="button" className="complete-button" aria-label={actionLabel} aria-pressed={isComplete} disabled={isComplete || busy} onClick={() => onComplete(challenge.id)}>
        <span aria-hidden="true">{busy ? '…' : isComplete ? '✓' : ''}</span>
      </button>
      <h3 className={isComplete ? 'challenge-card__title--complete' : ''}>{challenge.title}</h3>
      <span className="points">+{challenge.points} XP</span>
      <span className="sr-only" aria-live="polite">{busy ? 'Recording completion' : isPending ? 'Awaiting review' : isComplete ? 'Completed' : ''}</span>
    </article>
  )
}

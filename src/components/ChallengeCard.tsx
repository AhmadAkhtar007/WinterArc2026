import type { Challenge } from '../domain/types'
import { Check } from 'lucide-react'

export function ChallengeCard({ challenge, busy = false, onToggle, feature = false, selection }: { challenge: Challenge; busy?: boolean; onToggle?: (id: string, completed: boolean) => void; feature?: boolean; selection?: { selected: boolean; onToggle: () => void } }) {
  const isPending = challenge.status === 'pending'
  const marked = selection ? selection.selected : challenge.completed
  const actionLabel = selection
    ? `${selection.selected ? 'Deselect' : 'Select'} ${challenge.title}`
    : busy
      ? `Updating ${challenge.title}`
      : marked
        ? `Mark ${challenge.title} incomplete`
        : `Complete ${challenge.title}`

  return (
    <article className={`challenge-card challenge-card--${challenge.category} ${feature ? 'challenge-card--feature' : ''} ${marked ? 'is-complete' : ''}`}>
      <button type="button" className="complete-button" aria-label={actionLabel} aria-pressed={marked} disabled={busy} onClick={() => selection ? selection.onToggle() : onToggle?.(challenge.id, !marked)}>
        <span aria-hidden="true">{marked && <Check size={12} strokeWidth={2.5} />}</span>
      </button>
      <h3 className={!selection && marked ? 'challenge-card__title--complete' : ''}>{challenge.title}</h3>
      <span className="points">+{challenge.points} XP</span>
      {!selection && <span className="sr-only" aria-live="polite">{busy ? 'Updating completion' : isPending ? 'Awaiting review' : marked ? 'Completed' : ''}</span>}
    </article>
  )
}

import { Check, Clock, Plus, X } from 'lucide-react'
import type { Challenge } from '../domain/types'

type ProofState = 'open' | 'pending' | 'approved' | 'rejected'

function proofState(challenge: Challenge): ProofState {
  if (challenge.status === 'pending') return 'pending'
  if (challenge.status === 'reversed') return 'rejected'
  return challenge.completed ? 'approved' : 'open'
}

const instructions: Record<ProofState, string> = {
  open: 'Proof required via WhatsApp.',
  pending: 'Submitted · awaiting review',
  approved: 'Approved · points banked',
  rejected: 'Rejected · clear it to submit again',
}

export function SeasonProofCard({ challenge, busy = false, feature = false, onToggle }: { challenge: Challenge; busy?: boolean; feature?: boolean; onToggle: (id: string, completed: boolean) => void }) {
  const state = proofState(challenge)
  const actionLabel = busy
    ? `Updating ${challenge.title}`
    : state === 'pending'
      ? `Withdraw ${challenge.title} submission`
      : state === 'approved'
        ? `${challenge.title} approved and banked`
        : state === 'rejected'
          ? `Clear ${challenge.title} rejection`
          : `Submit ${challenge.title} for review`

  return (
    <article className={`challenge-card season-proof-card ${feature ? 'challenge-card--feature' : ''} ${state === 'approved' ? 'is-complete' : ''} ${state === 'pending' ? 'is-pending' : ''} ${state === 'rejected' ? 'is-rejected' : ''}`}>
      <button type="button" className="complete-button season-proof-card__action" aria-label={actionLabel} aria-pressed={state === 'pending' || state === 'approved'} disabled={busy || state === 'approved'} onClick={() => onToggle(challenge.id, state === 'open')}>
        <span aria-hidden="true">{state === 'pending' ? <Clock size={12} strokeWidth={2.25} /> : state === 'approved' ? <Check size={12} strokeWidth={2.5} /> : state === 'rejected' ? <X size={12} strokeWidth={2.5} /> : <Plus size={13} strokeWidth={2} />}</span>
      </button>
      <h3 className={state === 'approved' ? 'season-proof-card__title--approved' : ''}>{challenge.title}</h3>
      <span className="points">+{challenge.points} XP</span>
      <span className="season-proof-card__instruction">{instructions[state]}</span>
      <span className="sr-only" aria-live="polite">{busy ? 'Updating submission' : state === 'pending' ? 'Awaiting review' : state === 'approved' ? 'Approved' : state === 'rejected' ? 'Rejected' : ''}</span>
    </article>
  )
}

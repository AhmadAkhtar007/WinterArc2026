import type { Challenge } from '../domain/types'

const categoryLabels: Record<Challenge['category'], string> = { body: 'Body', mind: 'Mind', craft: 'Craft', discipline: 'Discipline' }

export function ChallengeCard({ challenge, busy = false, onComplete, feature = false }: { challenge: Challenge; busy?: boolean; onComplete: (id: string) => void; feature?: boolean }) {
  const isPending = challenge.status === 'pending'
  return (
    <article className={`challenge-card challenge-card--${challenge.category} ${feature ? 'challenge-card--feature' : ''}`}>
      <div className="challenge-card__glow" aria-hidden="true" />
      <div className="challenge-card__meta"><span>{categoryLabels[challenge.category]}</span><span>{challenge.frequency === 'once' ? 'Season quest' : challenge.frequency}</span></div>
      <div className="challenge-card__copy"><h3>{challenge.title}</h3><p>{challenge.description}</p></div>
      {challenge.metric && <div className="challenge-card__progress"><div><span>{challenge.metric}</span><span>{challenge.progress ?? 0}%</span></div><div className="meter"><span style={{ transform: `scaleX(${(challenge.progress ?? 0) / 100})` }} /></div></div>}
      <div className="challenge-card__footer">
        <span className="points">+{challenge.points} XP</span>
        <button type="button" className={`complete-button ${challenge.completed ? 'is-complete' : ''}`} disabled={challenge.completed || busy} onClick={() => onComplete(challenge.id)}>
          <span aria-hidden="true">{challenge.completed ? (isPending ? '···' : '✓') : '↗'}</span>
          {busy ? 'Recording' : challenge.completed ? (isPending ? 'Awaiting review' : 'Completed') : 'Mark complete'}
        </button>
      </div>
    </article>
  )
}

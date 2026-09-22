import { useState } from 'react'
import type { Challenge, ChallengeFrequency } from '../domain/types'
import { ChallengeCard } from '../components/ChallengeCard'

export function ChallengesPage({ challenges, busyChallenge, onComplete }: { challenges: Challenge[]; busyChallenge: string | null; onComplete: (id: string) => void }) {
  const [filter, setFilter] = useState<ChallengeFrequency>('daily')
  const visible = challenges.filter((challenge) => challenge.frequency === filter)
  return <div className="page">
    <header className="page-header"><span className="section-kicker">The work needs doing</span></header>
    <div className="filter-row" aria-label="Challenge filters">{(['daily', 'weekly', 'once'] as const).map((item) => <button key={item} className={filter === item ? 'is-active' : ''} type="button" onClick={() => setFilter(item)}>{item === 'once' ? 'Season' : item}</button>)}</div>
    <div className="challenge-grid">{visible.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} feature={challenge.frequency === 'once'} busy={busyChallenge === challenge.id} onComplete={onComplete} />)}</div>
  </div>
}

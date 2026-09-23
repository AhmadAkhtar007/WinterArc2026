import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Challenge, ChallengeFrequency } from '../domain/types'
import { ChallengeCard } from '../components/ChallengeCard'
import { TrackedChallengeCard } from '../components/TrackedChallengeCard'
import { SeasonProofCard } from '../components/SeasonProofCard'

const cadenceLabels: Record<ChallengeFrequency, string> = { daily: 'Daily', weekly: 'Weekly', once: 'Season' }
const commitmentStakes = 'This action is irreversible. You cannot unselect a challenge after committing to it. This may lead to negative XP if you are unable to do it.'

export function ChallengesPage({
  challenges,
  catalog,
  committedIds,
  commitMode,
  selection,
  busyChallenge,
  busyCommit,
  onToggle,
  onRecord,
  onRefresh,
  onToggleCommitMode,
  onToggleSelection,
  onConfirmCommit,
}: {
  challenges: Challenge[]
  catalog: Challenge[]
  committedIds: Set<string>
  commitMode: boolean
  selection: Set<string>
  busyChallenge: string | null
  busyCommit: boolean
  onToggle: (id: string, completed: boolean) => void
  onRecord: (id: string, amount: number) => Promise<void>
  onRefresh: () => void
  onToggleCommitMode: () => void
  onToggleSelection: (id: string) => void
  onConfirmCommit: () => void
}) {
  const [filter, setFilter] = useState<ChallengeFrequency>('daily')
  const [confirming, setConfirming] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const available = catalog.filter((challenge) => !committedIds.has(challenge.id))
  const visible = (commitMode ? available : challenges).filter((challenge) => challenge.frequency === filter)
  const chosen = catalog.filter((challenge) => selection.has(challenge.id))

  useEffect(() => { if (!commitMode) setConfirming(false) }, [commitMode])

  useEffect(() => {
    if (!confirming) return
    modalRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') setConfirming(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [confirming])

  return <div className="page">
    <header className="page-header"><span className="section-kicker">The work needs doing</span></header>
    <div className="filter-row" aria-label="Challenge filters">{(['daily', 'weekly', 'once'] as const).map((item) => <button key={item} className={filter === item ? 'is-active' : ''} type="button" onClick={() => setFilter(item)}>{item === 'once' ? 'Season' : item}</button>)}</div>
    {commitMode
      ? <div className="commit-block">
        <div className="commit-actions">
          <button className="secondary-button" type="button" onClick={onToggleCommitMode}>Cancel</button>
          <button className="primary-button" type="button" disabled={!selection.size} onClick={() => setConfirming(true)}>{selection.size ? `Confirm ${selection.size}` : 'Confirm'}</button>
        </div>
        <p className="commit-note">{commitmentStakes}</p>
      </div>
      : <button className="add-challenge-button" type="button" onClick={onToggleCommitMode}><Plus aria-hidden="true" size={16} /> Add challenge</button>}
    <div className="challenge-grid">{visible.map((challenge) => commitMode
      ? <ChallengeCard key={challenge.id} challenge={challenge} feature={challenge.frequency === 'once'} selection={{ selected: selection.has(challenge.id), onToggle: () => onToggleSelection(challenge.id) }} />
      : challenge.frequency === 'once' && challenge.requiresApproval
        ? <SeasonProofCard key={challenge.id} challenge={challenge} feature busy={busyChallenge === challenge.id} onToggle={onToggle} />
        : (challenge.trackingMode ?? 'binary') === 'binary'
          ? <ChallengeCard key={challenge.id} challenge={challenge} feature={challenge.frequency === 'once'} busy={busyChallenge === challenge.id} onToggle={onToggle} />
          : <TrackedChallengeCard key={challenge.id} challenge={challenge} busy={busyChallenge === challenge.id} onRecord={onRecord} onCooldownEnd={onRefresh} />
    )}</div>
    {commitMode && !visible.length && <p className="commit-empty">Nothing left to add here.</p>}
    {commitMode && confirming && <div className="modal-backdrop" onClick={() => setConfirming(false)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="commit-title" tabIndex={-1} ref={modalRef} onClick={(event) => event.stopPropagation()}>
        <h2 id="commit-title">{`Commit to ${chosen.length} ${chosen.length === 1 ? 'challenge' : 'challenges'}?`}</h2>
        <ul className="modal__list">{chosen.map((challenge) => <li key={challenge.id}>
          <div><strong>{challenge.title}</strong><small>{cadenceLabels[challenge.frequency]}</small></div>
          <span>+{challenge.points} XP</span>
        </li>)}</ul>
        <p className="modal__stakes">{commitmentStakes}</p>
        <div className="modal__actions">
          <button className="primary-button" type="button" disabled={busyCommit} onClick={onConfirmCommit}>{busyCommit ? 'Committing…' : 'Commit'}</button>
          <button className="text-button" type="button" onClick={() => setConfirming(false)}>Go back</button>
        </div>
      </div>
    </div>}
  </div>
}

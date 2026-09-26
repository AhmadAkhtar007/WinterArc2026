import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Challenge, ChallengeFrequency } from '../domain/types'
import { ChallengeCard } from '../components/ChallengeCard'
import { TrackedChallengeCard } from '../components/TrackedChallengeCard'
import { ChallengeIdeaForm } from '../components/ChallengeIdeaForm'

export function ChallengesPage({ challenges, catalog, committedIds, commitMode, selection, busyChallenge, busyCommit,
  onToggle, onRecord, onRefresh, onToggleCommitMode, onToggleSelection, onConfirmCommit, onUpgradeTarget, onSubmitIdea }: {
  challenges: Challenge[]; catalog: Challenge[]; committedIds: Set<string>; commitMode: boolean; selection: Set<string>
  busyChallenge: string | null; busyCommit: boolean
  onToggle: (id: string, completed: boolean) => void
  onRecord: (id: string, amount: number, requestId?: string) => Promise<void>
  onRefresh: () => void; onToggleCommitMode: () => void; onToggleSelection: (id: string) => void
  onConfirmCommit: (customTargets?: Record<string, number>, directId?: string) => void
  onUpgradeTarget?: (id: string, target: number) => Promise<void>
  onSubmitIdea: (title: string, description: string) => Promise<void>
}) {
  const [filter, setFilter] = useState<ChallengeFrequency>('daily')
  const [confirming, setConfirming] = useState(false)
  const [targets, setTargets] = useState<Record<string, number>>({})
  const [suggesting, setSuggesting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const visible = (commitMode ? catalog.filter((c) => c.published !== false && !committedIds.has(c.id)) : challenges)
    .filter((c) => c.frequency === filter)
  const chosen = catalog.filter((c) => selection.has(c.id))
  return <div className="page">
    <header className="page-header"><span className="section-kicker">The work needs doing</span></header>
    {submitted && <button className="success-banner" onClick={() => setSubmitted(false)}>Idea submitted for review.<X size={16} /></button>}
    <div className="filter-row" aria-label="Challenge filters">{(['daily', 'weekly', 'once'] as const).map((f) =>
      <button key={f} className={filter === f ? 'is-active' : ''} onClick={() => setFilter(f)}>{f === 'once' ? 'Season' : f === 'daily' ? 'Daily' : 'Weekly'}</button>)}</div>
    <div className="challenge-actions">
      <button className="add-challenge-button" onClick={() => { setConfirming(false); onToggleCommitMode() }}><Plus size={16} />{commitMode ? 'Cancel' : 'Add challenge'}</button>
      {commitMode ? <button className="primary-button" disabled={!selection.size} onClick={() => setConfirming(true)}>Confirm {selection.size || ''}</button>
        : <button className="text-button" onClick={() => setSuggesting(true)}>Suggest a challenge</button>}
    </div>
    <div className="challenge-grid">{visible.map((c) => commitMode
      ? <ChallengeCard key={c.id} challenge={{ ...c, pointsLabel: c.rules && c.rules.initialTargets.length > 1 ? 'Choose baseline' : c.pointsLabel }}
          selection={{ selected: selection.has(c.id), onToggle: () => onToggleSelection(c.id) }} />
      : (c.trackingMode ?? 'binary') !== 'binary'
        ? <TrackedChallengeCard key={c.id} challenge={c} busy={busyChallenge === c.id} onRecord={onRecord} onCooldownEnd={onRefresh} onUpgradeTarget={onUpgradeTarget} />
        : <article key={c.id} className="challenge-card">
            <button className="complete-button" disabled={busyChallenge === c.id || c.completed || c.active === false || (!!c.startsAt && new Date(c.startsAt).getTime() > Date.now())}
              aria-label={c.requiresApproval ? `Submit ${c.title} for review` : `Complete ${c.title}`} onClick={() => onToggle(c.id, true)}><Plus size={14} /></button>
            <h3>{c.title}</h3><span className="points">+{c.points} XP</span>
            <small>{c.status === 'pending' ? 'Awaiting proof review' : c.status === 'reversed' ? 'Rejected · start another attempt'
              : c.completed ? 'Completed · add again for another attempt' : c.startsAt && new Date(c.startsAt).getTime() > Date.now()
                ? `Starts ${new Date(c.startsAt).toLocaleString()}` : c.requiresApproval ? 'Submit proof in WhatsApp, then request review' : ''}</small>
          </article>)}</div>
    {!visible.length && <p className="commit-empty">{commitMode ? 'Nothing left to add here.' : 'Add a challenge to begin.'}</p>}
    {confirming && commitMode && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="commit-title">
      <h2 id="commit-title">Your commitments</h2>
      {chosen.map((c) => <label key={c.id} className="rule-field"><span>{c.title}</span>
        {(c.rules?.initialTargets.length ?? 0) > 1 && <select aria-label={`Baseline for ${c.title}`} value={targets[c.id] ?? c.rules!.initialTargets[0]}
          onChange={(e) => setTargets({ ...targets, [c.id]: Number(e.target.value) })}>
          {c.rules!.initialTargets.map((t) => <option key={t} value={t}>{t} {c.rules!.unit} · {c.targetRewards?.[String(t)] ?? 0} XP</option>)}</select>}
        {c.frequency === 'once' && c.rules?.durationMinutes ? <small>Adding starts the {c.rules.durationMinutes / 60}-hour countdown.</small> : null}
      </label>)}
      <p>Daily and weekly commitments start next period in Karachi time. Missing a target deducts XP in proportion to the shortfall. Commitments cannot be removed.</p>
      <button className="primary-button" disabled={busyCommit} onClick={() => { onConfirmCommit(targets); setConfirming(false) }}>Commit</button>
      <button className="text-button" onClick={() => setConfirming(false)}>Cancel</button>
    </div></div>}
    {suggesting && <ChallengeIdeaForm onClose={() => setSuggesting(false)} onSubmit={async (title, description) => {
      await onSubmitIdea(title, description); setSuggesting(false); setSubmitted(true)
    }} />}
  </div>
}

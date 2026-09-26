import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Challenge, ChallengeFrequency } from '../domain/types'
import { PULLUP_TARGET_OPTIONS, maxPeriodPoints, progressCap, scoringBreakdown, scoringProfileFor } from '../domain/challengeRules'
import { ChallengeCard } from '../components/ChallengeCard'
import { TrackedChallengeCard } from '../components/TrackedChallengeCard'
import { SeasonProofCard } from '../components/SeasonProofCard'
import { ChallengeIdeaForm } from '../components/ChallengeIdeaForm'

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
  onUpgradeTarget,
  onSubmitIdea,
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
  onConfirmCommit: (customTargets?: Record<string, number>, directId?: string) => void
  onUpgradeTarget?: (challengeId: string, newTarget: number) => Promise<void>
  onSubmitIdea: (title: string, description: string) => Promise<void>
}) {
  const [filter, setFilter] = useState<ChallengeFrequency>('daily')
  const [confirming, setConfirming] = useState(false)
  const [gymSessions, setGymSessions] = useState(4)
  const [gymConfiguring, setGymConfiguring] = useState<Challenge | null>(null)
  const [pushupTarget, setPushupTarget] = useState(100)
  const [pushupConfiguring, setPushupConfiguring] = useState<Challenge | null>(null)
  const [pullupTarget, setPullupTarget] = useState(PULLUP_TARGET_OPTIONS[1])
  const [pullupConfiguring, setPullupConfiguring] = useState<Challenge | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [ideaSubmitted, setIdeaSubmitted] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const gymScoring = scoringBreakdown('gym', gymSessions)
  const pushupScoring = scoringBreakdown('pushups', pushupTarget)
  const pushupCap = progressCap('pushups', pushupTarget)
  const pushupMax = maxPeriodPoints('pushups', pushupTarget)
  const pullupScoring = scoringBreakdown('pullups', pullupTarget)
  const pullupCap = progressCap('pullups', pullupTarget)
  const pullupMax = maxPeriodPoints('pullups', pullupTarget)
  const available = catalog.filter((challenge) => !committedIds.has(challenge.id))
  const visible = (commitMode ? available : challenges).filter((challenge) => challenge.frequency === filter)
  const chosen = catalog.filter((challenge) => selection.has(challenge.id))

  useEffect(() => {
    if (!commitMode) {
      setConfirming(false)
      setGymConfiguring(null)
      setPushupConfiguring(null)
      setPullupConfiguring(null)
    }
  }, [commitMode])

  useEffect(() => {
    if (!confirming && !gymConfiguring && !pushupConfiguring && !pullupConfiguring) return
    modalRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setConfirming(false)
        setGymConfiguring(null)
        setPushupConfiguring(null)
        setPullupConfiguring(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [confirming, gymConfiguring, pushupConfiguring, pullupConfiguring])

  function handleConfirmCommit() {
    const gymChallenge = chosen.find((c) => scoringProfileFor(c) === 'gym')
    const pushupChallenge = chosen.find((c) => scoringProfileFor(c) === 'pushups')
    const pullupChallenge = chosen.find((c) => scoringProfileFor(c) === 'pullups')
    const customTargets: Record<string, number> = {}
    if (gymChallenge) customTargets[gymChallenge.id] = gymSessions
    if (pushupChallenge) customTargets[pushupChallenge.id] = pushupTarget
    if (pullupChallenge) customTargets[pullupChallenge.id] = pullupTarget
    onConfirmCommit(Object.keys(customTargets).length ? customTargets : undefined)
  }

  return <div className="page">
    <header className="page-header"><span className="section-kicker">The work needs doing</span></header>
    {ideaSubmitted && <button className="success-banner" type="button" onClick={() => setIdeaSubmitted(false)}>Idea submitted for review.<X aria-hidden="true" size={16} /></button>}
    <div className="filter-row" aria-label="Challenge filters">{(['daily', 'weekly', 'once'] as const).map((item) => <button key={item} className={filter === item ? 'is-active' : ''} type="button" onClick={() => setFilter(item)}>{item === 'once' ? 'Season' : item}</button>)}</div>
    {commitMode
      ? <div className="commit-block">
        <div className="commit-actions">
          <button className="secondary-button" type="button" onClick={onToggleCommitMode}>Cancel</button>
          <button className="primary-button" type="button" disabled={!selection.size} onClick={() => setConfirming(true)}>{selection.size ? `Confirm ${selection.size}` : 'Confirm'}</button>
        </div>
        <p className="commit-note">{commitmentStakes}</p>
      </div>
      : <div className="challenge-actions">
        <button className="add-challenge-button" type="button" onClick={onToggleCommitMode}><Plus aria-hidden="true" size={16} /> Add challenge</button>
        <button className="text-button" type="button" onClick={() => setSuggesting(true)}>Suggest a challenge</button>
      </div>}
    <div className="challenge-grid">{visible.map((challenge) => {
      const profile = scoringProfileFor(challenge)
      const isGym = profile === 'gym'
      const isPushups = profile === 'pushups'
      const isPullups = profile === 'pullups'
      return commitMode
        ? <ChallengeCard
            key={challenge.id}
            challenge={isGym || isPushups || isPullups ? { ...challenge, pointsLabel: 'Custom split' } : challenge}
            feature={challenge.frequency === 'once'}
            selection={{
              selected: selection.has(challenge.id),
              onToggle: () => {
                if (isGym) {
                  setGymConfiguring(challenge)
                } else if (isPushups) {
                  setPushupConfiguring(challenge)
                } else if (isPullups) {
                  setPullupConfiguring(challenge)
                } else {
                  onToggleSelection(challenge.id)
                }
              }
            }}
          />
        : challenge.frequency === 'once' && challenge.requiresApproval
          ? <SeasonProofCard key={challenge.id} challenge={challenge} feature busy={busyChallenge === challenge.id} onToggle={onToggle} />
          : (challenge.trackingMode ?? 'binary') === 'binary'
            ? <ChallengeCard key={challenge.id} challenge={challenge} feature={challenge.frequency === 'once'} busy={busyChallenge === challenge.id} onToggle={onToggle} />
            : <TrackedChallengeCard key={challenge.id} challenge={challenge} busy={busyChallenge === challenge.id} onRecord={onRecord} onCooldownEnd={onRefresh} onUpgradeTarget={onUpgradeTarget} />
    })}</div>
    {commitMode && !visible.length && <p className="commit-empty">Nothing left to add here.</p>}
    {suggesting && <ChallengeIdeaForm
      onClose={() => setSuggesting(false)}
      onSubmit={async (title, description) => {
        await onSubmitIdea(title, description)
        setIdeaSubmitted(true)
      }}
    />}
    {commitMode && pushupConfiguring && <div className="modal-backdrop" onClick={() => setPushupConfiguring(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pushup-modal-title" tabIndex={-1} ref={modalRef} onClick={(event) => event.stopPropagation()}>
        <h2 id="pushup-modal-title">Set your Pushup baseline</h2>
        <p className="gym-modal__desc">How many pushups will you commit to every day this season? You can always log up to double your baseline for +1 XP per 10 bonus pushups.</p>
        <div className="gym-picker">
          <span className="gym-picker__title">Select daily baseline standard</span>
          <div className="gym-picker__pills" role="radiogroup" aria-label="Daily pushup baseline">
            {[50, 100, 150, 200].map((num) => (
              <button
                key={num}
                type="button"
                className={`gym-picker__pill ${pushupTarget === num ? 'is-active' : ''}`}
                onClick={() => setPushupTarget(num)}
              >
                {num}
              </button>
            ))}
          </div>
          <div className="gym-picker__summary">
            <span>{pushupScoring.base} XP base · bonus up to {pushupCap} reps (+{pushupScoring.base} XP)</span>
            <strong>= {pushupMax} XP max / day</strong>
          </div>
        </div>
        <p className="modal__stakes">{commitmentStakes}</p>
        <div className="modal__actions">
          <button
            className="primary-button"
            type="button"
            disabled={busyCommit}
            onClick={() => {
              onConfirmCommit({ [pushupConfiguring.id]: pushupTarget }, pushupConfiguring.id)
              setPushupConfiguring(null)
            }}
          >
            {busyCommit ? 'Committing…' : `Commit to ${pushupTarget} reps / day (+${pushupScoring.base} XP)`}
          </button>
          <button className="text-button" type="button" onClick={() => setPushupConfiguring(null)}>Cancel</button>
        </div>
      </div>
    </div>}
    {commitMode && pullupConfiguring && <div className="modal-backdrop" onClick={() => setPullupConfiguring(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pullup-modal-title" tabIndex={-1} ref={modalRef} onClick={(event) => event.stopPropagation()}>
        <h2 id="pullup-modal-title">Set your Pullup baseline</h2>
        <p className="gym-modal__desc">How many pullups will you commit to every day this season? You can always log up to double your baseline for bonus XP.</p>
        <div className="gym-picker">
          <span className="gym-picker__title">Select daily baseline standard</span>
          <div className="gym-picker__pills" role="radiogroup" aria-label="Daily pullup baseline">
            {PULLUP_TARGET_OPTIONS.map((num) => (
              <button
                key={num}
                type="button"
                className={`gym-picker__pill ${pullupTarget === num ? 'is-active' : ''}`}
                onClick={() => setPullupTarget(num)}
              >
                {num}
              </button>
            ))}
          </div>
          <div className="gym-picker__summary">
            <span>{pullupScoring.base} XP base · bonus up to {pullupCap} reps (+{pullupMax - pullupScoring.base} XP)</span>
            <strong>= {pullupMax} XP max / day</strong>
          </div>
        </div>
        <p className="modal__stakes">{commitmentStakes}</p>
        <div className="modal__actions">
          <button
            className="primary-button"
            type="button"
            disabled={busyCommit}
            onClick={() => {
              onConfirmCommit({ [pullupConfiguring.id]: pullupTarget }, pullupConfiguring.id)
              setPullupConfiguring(null)
            }}
          >
            {busyCommit ? 'Committing…' : `Commit to ${pullupTarget} pullups / day (+${pullupScoring.base} XP)`}
          </button>
          <button className="text-button" type="button" onClick={() => setPullupConfiguring(null)}>Cancel</button>
        </div>
      </div>
    </div>}
    {commitMode && gymConfiguring && <div className="modal-backdrop" onClick={() => setGymConfiguring(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="gym-modal-title" tabIndex={-1} ref={modalRef} onClick={(event) => event.stopPropagation()}>
        <h2 id="gym-modal-title">Set your Gym split</h2>
        <p className="gym-modal__desc">How many workout sessions will you commit to every week this season?</p>
        <div className="gym-picker">
          <div className="gym-picker__pills" role="radiogroup" aria-label="Gym sessions per week">
            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
              <button
                key={num}
                type="button"
                className={`gym-picker__pill ${gymSessions === num ? 'is-active' : ''}`}
                onClick={() => setGymSessions(num)}
              >
                {num}x
              </button>
            ))}
          </div>
          <div className="gym-picker__summary">
            <span>{gymScoring.base} XP ({gymSessions} × 10) + {gymScoring.bonus} XP bonus</span>
            <strong>= {gymScoring.total} XP / week</strong>
          </div>
        </div>
        <p className="modal__stakes">{commitmentStakes}</p>
        <div className="modal__actions">
          <button
            className="primary-button"
            type="button"
            disabled={busyCommit}
            onClick={() => {
              onConfirmCommit({ [gymConfiguring.id]: gymSessions }, gymConfiguring.id)
              setGymConfiguring(null)
            }}
          >
            {busyCommit ? 'Committing…' : `Commit to ${gymSessions}x / week (+${gymScoring.total} XP)`}
          </button>
          <button className="text-button" type="button" onClick={() => setGymConfiguring(null)}>Cancel</button>
        </div>
      </div>
    </div>}
    {commitMode && confirming && <div className="modal-backdrop" onClick={() => setConfirming(false)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="commit-title" tabIndex={-1} ref={modalRef} onClick={(event) => event.stopPropagation()}>
        <h2 id="commit-title">{`Commit to ${chosen.length} ${chosen.length === 1 ? 'challenge' : 'challenges'}?`}</h2>
        <ul className="modal__list">{chosen.map((challenge) => {
          const isGym = scoringProfileFor(challenge) === 'gym'
          const points = isGym ? gymScoring.total : challenge.points
          return (
            <li key={challenge.id} className={isGym ? 'modal__item--gym' : ''}>
              <div style={{ width: '100%' }}>
                <strong>{challenge.title}</strong>
                <small>{isGym ? `${gymSessions} sessions / week` : cadenceLabels[challenge.frequency]}</small>
                {isGym && (
                  <div className="gym-picker">
                    <span className="gym-picker__title">How many sessions will you do every week?</span>
                    <div className="gym-picker__pills" role="radiogroup" aria-label="Gym sessions per week">
                      {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                        <button
                          key={num}
                          type="button"
                          className={`gym-picker__pill ${gymSessions === num ? 'is-active' : ''}`}
                          onClick={() => setGymSessions(num)}
                        >
                          {num}x
                        </button>
                      ))}
                    </div>
                    <div className="gym-picker__summary">
                      <span>{gymScoring.base} XP ({gymSessions} × 10) + {gymScoring.bonus} XP bonus</span>
                      <strong>= {points} XP total</strong>
                    </div>
                  </div>
                )}
              </div>
              <span className="points">+{points} XP</span>
            </li>
          )
        })}</ul>
        <p className="modal__stakes">{commitmentStakes}</p>
        <div className="modal__actions">
          <button className="primary-button" type="button" disabled={busyCommit} onClick={handleConfirmCommit}>{busyCommit ? 'Committing…' : 'Commit'}</button>
          <button className="text-button" type="button" onClick={() => setConfirming(false)}>Go back</button>
        </div>
      </div>
    </div>}
  </div>
}

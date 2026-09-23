import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Lock, Plus } from 'lucide-react'
import type { Challenge } from '../domain/types'

function formatProgress(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function TrackedChallengeCard({
  challenge,
  busy = false,
  onRecord,
  onCooldownEnd,
}: {
  challenge: Challenge
  busy?: boolean
  onRecord: (challengeId: string, amount: number) => Promise<void>
  onCooldownEnd: () => void
}) {
  const cardRef = useRef<HTMLElement>(null)
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState('')
  const [now, setNow] = useState(Date.now())
  const progress = challenge.progress ?? 0
  const target = challenge.target ?? 1
  const ratio = Math.min(100, Math.max(0, (progress / target) * 100))
  const cooldownEnd = challenge.cooldownEndsAt ? new Date(challenge.cooldownEndsAt).getTime() : 0
  const remaining = Math.max(0, cooldownEnd - now)
  const locked = !challenge.completed && remaining > 0
  const attemptEnd = challenge.attemptEndsAt ? new Date(challenge.attemptEndsAt).getTime() : 0
  const attemptRemaining = Math.max(0, attemptEnd - now)
  const reward = challenge.securedPoints ?? 0
  const fixedStep = challenge.entryStep
  const progressText = `${formatProgress(progress)} / ${formatProgress(target)} ${challenge.unitLabel ?? ''}`.trim()

  useEffect(() => {
    if (!editing) return
    function cancelOutside(event: PointerEvent) {
      if (!cardRef.current?.contains(event.target as Node)) {
        setAmount('')
        setEditing(false)
      }
    }
    document.addEventListener('pointerdown', cancelOutside)
    return () => document.removeEventListener('pointerdown', cancelOutside)
  }, [editing])

  useEffect(() => {
    const timerEnd = Math.max(cooldownEnd, attemptEnd)
    if (!timerEnd || timerEnd <= Date.now()) return
    const interval = window.setInterval(() => {
      const nextNow = Date.now()
      setNow(nextNow)
      if (nextNow >= timerEnd) {
        window.clearInterval(interval)
        onCooldownEnd()
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [attemptEnd, cooldownEnd, onCooldownEnd])

  async function record(value: number) {
    await onRecord(challenge.id, value)
    setAmount('')
    setEditing(false)
  }

  function submitVariableAmount() {
    const parsedAmount = Number(amount)
    if (Number.isInteger(parsedAmount) && parsedAmount > 0 && parsedAmount <= target - progress) {
      void record(parsedAmount)
    }
  }

  return (
    <article
      ref={cardRef}
      className={`challenge-card tracked-card ${challenge.completed ? 'is-complete' : ''} ${locked ? 'is-locked' : ''} ${editing ? 'is-editing' : ''}`}
      aria-disabled={locked || undefined}
      onClick={() => {
        if (!fixedStep && !editing && !locked && !challenge.completed) setEditing(true)
      }}
    >
      <button
        type="button"
        className="complete-button tracked-card__action"
        aria-label={locked ? `Next progress entry available in ${Math.ceil(remaining / 60_000)} minutes` : challenge.completed ? `${challenge.title} complete` : fixedStep ? `Record ${fixedStep} ${challenge.unitLabel ?? ''}` : editing ? `Confirm ${challenge.title} progress` : `Enter progress for ${challenge.title}`}
        disabled={busy || locked || challenge.completed}
        onClick={() => {
          if (fixedStep) void record(fixedStep)
          else if (editing) submitVariableAmount()
          else setEditing(true)
        }}
      >
        <span aria-hidden="true">{locked ? <Lock size={12} strokeWidth={2.25} /> : challenge.completed ? <Check size={12} strokeWidth={2.5} /> : editing ? <ArrowUp size={13} strokeWidth={2.25} /> : <Plus size={13} strokeWidth={2} />}</span>
      </button>
      <h3>{challenge.title}</h3>
      <span className={`points ${locked || attemptRemaining > 0 ? 'tracked-card__timer' : ''} ${challenge.attemptFailed ? 'tracked-card__failed' : ''}`}>{locked ? formatCountdown(remaining) : attemptRemaining > 0 ? formatCountdown(attemptRemaining) : challenge.attemptFailed ? 'FAILED' : `+${challenge.points} XP`}</span>
      {editing ? (
        <label className="tracked-card__inline-entry" onClick={(event) => event.stopPropagation()}>
          <span className="sr-only">Progress amount in {challenge.unitLabel}</span>
          <input
            autoFocus
            inputMode="numeric"
            type="number"
            min="1"
            max={Math.max(1, target - progress)}
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitVariableAmount()
              if (event.key === 'Escape') { setAmount(''); setEditing(false) }
            }}
          />
          <strong>{challenge.unitLabel}</strong>
        </label>
      ) : (
        <span className="tracked-card__progress">{progressText}{reward > 0 ? ` · ${reward} XP secured` : ''}</span>
      )}
      <span className="tracked-card__meter" aria-hidden="true"><i style={{ width: `${ratio}%` }} /></span>
    </article>
  )
}

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
  onRecord: (challengeId: string, amount: number, requestId?: string) => Promise<void>
  onCooldownEnd: () => void
}) {
  const cardRef = useRef<HTMLElement>(null)
  const request = useRef<{ amount: number; id: string } | null>(null)
  const inFlight = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState('')
  const [now, setNow] = useState(Date.now())
  const progress = challenge.progress ?? 0
  const target = challenge.target ?? 1
  const cap = challenge.maxProgress ?? target
  const terminal = progress >= cap || (challenge.frequency === 'once' && challenge.completed)
  const ratio = Math.min(100, Math.max(0, (progress / target) * 100))
  const cooldownEnd = challenge.cooldownEndsAt ? new Date(challenge.cooldownEndsAt).getTime() : 0
  const remaining = Math.max(0, cooldownEnd - now)
  const locked = !terminal && remaining > 0
  const attemptEnd = challenge.attemptEndsAt ? new Date(challenge.attemptEndsAt).getTime() : 0
  const attemptRemaining = Math.max(0, attemptEnd - now)
  const reward = challenge.securedPoints ?? 0
  const fixedStep = challenge.rules?.step ?? challenge.entryStep ?? 0
  const expired = !!challenge.attemptFailed || (!!attemptEnd && attemptRemaining === 0 && !challenge.completed)
  const scheduled = !!challenge.startsAt && new Date(challenge.startsAt).getTime() > now
  const disabled = busy || saving || locked || terminal || expired || scheduled || challenge.active === false
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
    const timerEnd = [cooldownEnd, attemptEnd, challenge.startsAt ? new Date(challenge.startsAt).getTime() : 0].filter((t) => t > Date.now()).sort((a, b) => a - b)[0]
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
  }, [attemptEnd, cooldownEnd, challenge.startsAt, onCooldownEnd])

  async function record(value: number) {
    if (disabled || inFlight.current) return
    if (!Number.isInteger(value) || value <= 0 || value > cap - progress) {
      setError('Enter a whole amount within the remaining limit.')
      return
    }
    if (!request.current || request.current.amount !== value) request.current = { amount: value, id: crypto.randomUUID() }
    inFlight.current = true
    setSaving(true); setError('')
    try {
      await onRecord(challenge.id, value, request.current.id)
      request.current = null
      setAmount(''); setEditing(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save progress. Retry to confirm it.')
    } finally { inFlight.current = false; setSaving(false) }
  }

  function submitVariableAmount() { void record(Number(amount)) }

  return (
    <article
      ref={cardRef}
      className={`challenge-card tracked-card ${terminal ? 'is-complete' : ''} ${locked ? 'is-locked' : ''} ${editing ? 'is-editing' : ''}`}
      aria-disabled={locked || undefined}
      onClick={() => {
        if (!fixedStep && !editing && !disabled) setEditing(true)
      }}
    >
      <button
        type="button"
        className="complete-button tracked-card__action"
        aria-label={locked ? `Next progress entry available in ${Math.ceil(remaining / 60_000)} minutes` : terminal ? `${challenge.title} complete` : fixedStep ? `Record ${fixedStep} ${challenge.unitLabel ?? ''}` : editing ? `Confirm ${challenge.title} progress` : `Enter progress for ${challenge.title}`}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          if (fixedStep) void record(fixedStep)
          else if (editing) submitVariableAmount()
          else setEditing(true)
        }}
      >
        <span aria-hidden="true">{locked ? <Lock size={12} strokeWidth={2.25} /> : terminal ? <Check size={12} strokeWidth={2.5} /> : editing ? <ArrowUp size={13} strokeWidth={2.25} /> : <Plus size={13} strokeWidth={2} />}</span>
      </button>
      <h3>{challenge.title}</h3>
      <span className={`points ${locked || (!terminal && attemptRemaining > 0) ? 'tracked-card__timer' : ''} ${expired ? 'tracked-card__failed' : ''}`}>{locked ? formatCountdown(remaining) : (!terminal && attemptRemaining > 0) ? formatCountdown(attemptRemaining) : expired ? 'FAILED' : `+${challenge.points} XP`}</span>
      {editing ? (
        <label className="tracked-card__inline-entry" onClick={(event) => event.stopPropagation()}>
          <span className="sr-only">Progress amount in {challenge.unitLabel}</span>
          <input
            aria-label={`Amount for ${challenge.title}`}
            disabled={saving || busy}
            autoFocus
            inputMode="numeric"
            type="number"
            min="1"
            max={Math.max(1, cap - progress)}
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
      {error && <span role="alert" className="tracked-card__error">{error}</span>}
      <span className="tracked-card__meter" aria-hidden="true"><i style={{ width: `${ratio}%` }} /></span>
    </article>
  )
}

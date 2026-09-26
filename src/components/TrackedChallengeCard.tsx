import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Challenge } from '../domain/types'

export function TrackedChallengeCard({ challenge: c, busy = false, onRecord, onCooldownEnd, onUpgradeTarget }: {
  challenge: Challenge; busy?: boolean
  onRecord: (id: string, amount: number, requestId?: string) => Promise<void>
  onCooldownEnd: () => void
  onUpgradeTarget?: (id: string, target: number) => Promise<void>
}) {
  const [amount, setAmount] = useState('')
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState('')
  const [upgrading, setUpgrading] = useState(false)
  const [saving, setSaving] = useState(false)
  const request = useRef<{ amount: number; id: string } | null>(null)
  const target = c.target ?? 1
  const progress = c.progress ?? 0
  const cap = c.maxProgress ?? target
  const step = c.rules?.step ?? c.entryStep ?? 0
  const cooldown = c.cooldownEndsAt ? new Date(c.cooldownEndsAt).getTime() : 0
  const deadline = c.attemptEndsAt ? new Date(c.attemptEndsAt).getTime() : 0
  const starts = c.startsAt ? new Date(c.startsAt).getTime() : 0
  const scheduled = starts > now
  const expired = c.attemptFailed || (!!deadline && deadline <= now && !c.completed)
  const locked = scheduled || cooldown > now || expired || c.active === false || progress >= cap
  const upgrades = (c.rules?.targets ?? []).filter((t) => t > (c.pendingTarget ?? target))
  const [upgrade, setUpgrade] = useState(upgrades[0] ?? target)
  useEffect(() => {
    const boundary = [cooldown, deadline, starts].filter((t) => t > Date.now()).sort((a, b) => a - b)[0]
    if (!boundary) return
    const timer = window.setInterval(() => {
      const time = Date.now(); setNow(time)
      if (time >= boundary) { clearInterval(timer); onCooldownEnd() }
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown, deadline, starts, onCooldownEnd])
  async function record() {
    const value = step || Number(amount)
    if (!Number.isInteger(value) || value <= 0 || value > cap - progress) { setError('Enter a whole amount within the remaining limit.'); return }
    if (!request.current || request.current.amount !== value) request.current = { amount: value, id: crypto.randomUUID() }
    setSaving(true); setError('')
    try {
      await onRecord(c.id, value, request.current.id)
      request.current = null; setAmount('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Progress could not be saved. Retry to confirm it.') }
    finally { setSaving(false) }
  }
  return <article className={`challenge-card tracked-card ${c.completed ? 'is-complete' : ''}`}>
    <button className="complete-button" aria-label={`Record progress for ${c.title}`} disabled={busy || saving || locked} onClick={() => void record()}><Plus size={14} /></button>
    <h3>{c.title}</h3><span className="points">{c.securedPoints ?? 0} XP earned</span>
    <div className="tracked-card__detail">
      <p>{progress} / {target} {c.unitLabel} · maximum {cap}</p>
      {!step && !locked && <input aria-label={`Amount for ${c.title}`} inputMode="numeric" type="number" min="1" max={cap - progress} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />}
      {!!step && !locked && <small>Each entry adds {step} {c.unitLabel}.</small>}
      {scheduled ? <p>Starts {new Date(starts).toLocaleString()}</p> : expired ? <p>Attempt expired. Add the challenge again to retry.</p>
        : cooldown > now ? <p>Next entry in {Math.ceil((cooldown - now) / 60000)} minutes</p>
          : deadline > now && !c.completed ? <p>{Math.ceil((deadline - now) / 60000)} minutes remaining</p> : null}
      {c.rules?.gate === 'target' && progress < target && <small>XP unlocks at your baseline.</small>}
      {c.pendingTarget && <p>Baseline increases to {c.pendingTarget} next period.</p>}
      {c.frequency !== 'once' && c.active !== false && upgrades.length > 0 && onUpgradeTarget && <>
        <button className="text-button" onClick={() => { setUpgrade(upgrades[0]); setUpgrading(!upgrading) }}>Raise baseline</button>
        {upgrading && <div>
          <label>New baseline<select value={upgrade} onChange={(e) => setUpgrade(Number(e.target.value))}>{upgrades.map((t) => <option key={t}>{t}</option>)}</select></label>
          <p>Takes effect next period. Previous XP stays unchanged.</p>
          <button disabled={saving} onClick={async () => {
            setSaving(true); setError('')
            try { await onUpgradeTarget(c.id, upgrade); setUpgrading(false) }
            catch (cause) { setError(cause instanceof Error ? cause.message : 'Upgrade failed.') }
            finally { setSaving(false) }
          }}>Confirm upgrade</button>
        </div>}
      </>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  </article>
}

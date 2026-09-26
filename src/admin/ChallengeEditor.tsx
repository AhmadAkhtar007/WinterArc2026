import { useState, type FormEvent } from 'react'
import type { ChallengeDefinition, ChallengeRules, ChallengeCategory, ChallengeFrequency, ChallengeTrackingMode } from '../domain/types'

export const defaultRules: ChallengeRules = {
  mode: 'binary', unit: 'completion', targets: [1], initialTargets: [1], cap: 1, capMultiplier: 0,
  step: 1, burst: 1, cooldownMinutes: 0, durationMinutes: 0, rateEvery: 1, ratePoints: 0,
  targetBonus: 10, gate: 'target', milestones: [], approval: false, penalty: 'baseline',
}
export function ChallengeEditor({ initial, seasonId, onSave, onCancel }: {
  initial?: Partial<ChallengeDefinition>; seasonId: string
  onSave: (definition: ChallengeDefinition) => Promise<void>; onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState<ChallengeCategory>(initial?.category ?? 'mind')
  const [frequency, setFrequency] = useState<ChallengeFrequency>(initial?.frequency ?? 'daily')
  const [rules, setRules] = useState<ChallengeRules>(initial?.rules ?? defaultRules)
  const [targets, setTargets] = useState((initial?.rules?.targets ?? [1]).join(', '))
  const [initialTargets, setInitialTargets] = useState((initial?.rules?.initialTargets ?? [1]).join(', '))
  const [published, setPublished] = useState(initial?.published ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [milestones, setMilestones] = useState(initial?.rules?.milestones ?? [])
  const [rates, setRates] = useState(Object.entries(initial?.rules?.targetRates ?? {}).map(([target, points]) => ({ target: Number(target), points })))
  function numbers(value: string) {
    const values = value.split(',').map((v) => Number(v.trim()))
    if (values.some((v) => !Number.isInteger(v) || v <= 0)) throw new Error('Target choices must be positive whole numbers separated by commas.')
    return [...new Set(values)]
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await onSave({
        id: initial?.id, seasonId, title, description, category, frequency, published,
        rules: { ...rules, targets: numbers(targets), initialTargets: numbers(initialTargets),
          milestones, targetRates: Object.fromEntries(rates.map((r) => [String(r.target), r.points])),
          penalty: frequency === 'once' ? 'none' : rules.penalty },
      })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save challenge.') }
    finally { setBusy(false) }
  }
  const numericFields = [
    ['cap', 'Hard maximum (0 uses baseline multiplier)'], ['capMultiplier', 'Maximum as a multiple of baseline'],
    ['step', 'Amount per entry (0 allows typed amounts)'], ['burst', 'Entries before cooldown'],
    ['cooldownMinutes', 'Cooldown in minutes'], ['durationMinutes', 'Attempt deadline in minutes (season only)'],
    ['rateEvery', 'Units per XP award'], ['ratePoints', 'XP per award'], ['targetBonus', 'XP bonus at baseline'],
  ] as const
  return <form className="admin-form challenge-editor" onSubmit={submit}>
    <h2>{initial?.id ? 'Edit challenge' : 'Configure challenge'}</h2>
    <p>Existing commitments retain their rules. Changes apply to new commitments.</p>
    <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={160} /></label>
    <label>Instructions<textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
    <label>Category<select value={category} onChange={(e) => setCategory(e.target.value as ChallengeCategory)}>
      {(['mind', 'body', 'craft', 'soul'] as const).map((v) => <option key={v}>{v}</option>)}</select></label>
    <label>Schedule<select value={frequency} onChange={(e) => setFrequency(e.target.value as ChallengeFrequency)}>
      <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="once">Repeatable season attempt</option></select></label>
    <label>Record<select value={rules.mode} onChange={(e) => setRules({ ...rules, mode: e.target.value as ChallengeTrackingMode })}>
      <option value="binary">Completion submission</option><option value="quantity">Amount</option><option value="occurrence">One occurrence</option></select></label>
    <label>Unit<input value={rules.unit} onChange={(e) => setRules({ ...rules, unit: e.target.value })} required /></label>
    <label>Supported baselines, including upgrades<input value={targets} onChange={(e) => setTargets(e.target.value)} required /></label>
    <label>Baselines available when joining<input value={initialTargets} onChange={(e) => setInitialTargets(e.target.value)} required /></label>
    {numericFields.map(([key, label]) => <label key={key}>{label}<input type="number" min={key === 'burst' || key === 'rateEvery' ? 1 : 0} step="1" max="1000000"
      value={rules[key]} onChange={(e) => setRules({ ...rules, [key]: Number(e.target.value) })} required /></label>)}
    <label>When XP unlocks<select value={rules.gate} onChange={(e) => setRules({ ...rules, gate: e.target.value as ChallengeRules['gate'] })}>
      <option value="immediate">As progress is recorded</option><option value="target">Once baseline is reached</option></select></label>
    <fieldset><legend>Milestone rewards (replace the per-unit rate)</legend>
      {milestones.map((m, i) => <div key={i} className="rule-row">
        <label>Amount<input type="number" min="1" value={m.threshold} onChange={(e) => setMilestones(milestones.map((v, j) => j === i ? { ...v, threshold: Number(e.target.value) } : v))} /></label>
        <label>Total XP<input type="number" min="0" value={m.points} onChange={(e) => setMilestones(milestones.map((v, j) => j === i ? { ...v, points: Number(e.target.value) } : v))} /></label>
        <button type="button" onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}>Remove</button>
      </div>)}
      <button type="button" onClick={() => setMilestones([...milestones, { threshold: (milestones.at(-1)?.threshold ?? 0) + 1, points: 0 }])}>Add milestone</button>
    </fieldset>
    <fieldset><legend>Baseline-specific rates (optional)</legend>
      <p>For example, a baseline of 8 earns 5 XP per 8 units. Fractions round down.</p>
      {rates.map((r, i) => <div key={i} className="rule-row">
        <label>Baseline<input type="number" min="1" value={r.target} onChange={(e) => setRates(rates.map((v, j) => j === i ? { ...v, target: Number(e.target.value) } : v))} /></label>
        <label>XP per baseline<input type="number" min="1" value={r.points} onChange={(e) => setRates(rates.map((v, j) => j === i ? { ...v, points: Number(e.target.value) } : v))} /></label>
        <button type="button" onClick={() => setRates(rates.filter((_, j) => j !== i))}>Remove</button>
      </div>)}
      <button type="button" onClick={() => setRates([...rates, { target: 1, points: 1 }])}>Add baseline rate</button>
    </fieldset>
    <label><input type="checkbox" checked={rules.approval} onChange={(e) => setRules({ ...rules, approval: e.target.checked })} />Require proof approval</label>
    {frequency !== 'once' && <label><input type="checkbox" checked={rules.penalty === 'baseline'} onChange={(e) => setRules({ ...rules, penalty: e.target.checked ? 'baseline' : 'none' })} />Proportional missed-target penalty, up to baseline XP</label>}
    <label><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />Published in the catalog</label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="primary-button" disabled={busy}>Save challenge</button>
    <button type="button" className="text-button" disabled={busy} onClick={onCancel}>Cancel</button>
  </form>
}

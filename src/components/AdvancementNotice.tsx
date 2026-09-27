import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { AdvancementOffer } from '../domain/types'

export function AdvancementNotice({ offers, onAdvance, onDismiss }: {
  offers: AdvancementOffer[]
  onAdvance: (id: string, target: number) => Promise<void>
  onDismiss: (id: string, target: number) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const dialog = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const offer = offers[0]

  useEffect(() => {
    if (!open || !offer) return
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !inFlight.current) { setOpen(false); trigger.current?.focus() }
      if (event.key !== 'Tab') return
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
      if (!buttons?.length) { event.preventDefault(); return }
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [open, offer?.commitmentId])

  async function resolve(advance: boolean) {
    if (!offer || inFlight.current) return
    inFlight.current = true; setSaving(true); setError('')
    try {
      await (advance ? onAdvance : onDismiss)(offer.commitmentId, offer.nextTarget)
      setOpen(false)
      trigger.current?.focus()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this offer. Try again.') }
    finally { inFlight.current = false; setSaving(false) }
  }

  if (!offer) return null
  return <>
    <button ref={trigger} type="button" className="advancement-notice" onClick={() => { setError(''); setOpen(true) }}>
      <span><strong>Next level available</strong><small>{offers.length > 1 ? `${offers.length} challenges ready to advance` : offer.title}</small></span>
      <ArrowUpRight size={18} aria-hidden="true" />
    </button>
    {open && <div className="modal-backdrop advancement-backdrop" onClick={() => { if (!saving) setOpen(false) }}>
      <div ref={dialog} className="modal advancement-sheet" role="dialog" aria-modal="true" aria-labelledby="advancement-title"
        tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <span className="section-kicker">Two weeks. Every target met.</span>
        <h2 id="advancement-title">{offer.title}</h2>
        <p className="advancement-target">{offer.currentTarget} <span aria-label="to">→</span> {offer.nextTarget} <small>{offer.unit}</small></p>
        <p className="modal__stakes">{offer.reward} XP at your new target · up to {offer.maximumPenalty} XP deducted for a missed target.</p>
        <p className="modal__stakes">Starts immediately. Your logged progress and earned XP stay. Complete another two full weeks at this level to qualify again.</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="modal__actions">
          <button type="button" className="primary-button" disabled={saving} onClick={() => void resolve(true)}>{saving ? 'Saving…' : 'Advance to next level'}</button>
          <button type="button" className="text-button" disabled={saving} onClick={() => void resolve(false)}>Keep current target</button>
        </div>
        <p className="modal__stakes">Keep your target to hide this offer for one week.</p>
      </div>
    </div>}
  </>
}

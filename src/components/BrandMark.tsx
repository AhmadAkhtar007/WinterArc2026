export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? 'brand-mark--compact' : ''}`} aria-label="Winter Arc">
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 1.5c.8 9.6 4.9 13.7 14.5 14.5C20.9 16.8 16.8 20.9 16 30.5 15.2 20.9 11.1 16.8 1.5 16 11.1 15.2 15.2 11.1 16 1.5Z" /></svg>
      <span>{compact ? 'WA / 26' : 'WINTER ARC'}</span>
    </div>
  )
}

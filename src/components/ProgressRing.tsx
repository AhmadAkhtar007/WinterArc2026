export function ProgressRing({ value, label, detail }: { value: number; label: string; detail: string }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(value, 100) / 100) * circumference
  return (
    <div className="progress-ring" role="img" aria-label={`${label}: ${value}%`}>
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle className="progress-ring__track" cx="64" cy="64" r={radius} />
        <circle className="progress-ring__value" cx="64" cy="64" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div><strong>{value}%</strong><span>{label}</span><small>{detail}</small></div>
    </div>
  )
}

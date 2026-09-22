import { useState, type CSSProperties } from 'react'
import { BrandMark } from '../components/BrandMark'

interface IntroSequenceProps {
  onComplete: () => void
}

const DAYS_IN_2026 = 365
const ELAPSED_DAYS = 265

function YearDots({ remaining }: { remaining: boolean }) {
  return <div className="intro-dots" aria-hidden="true">
    {Array.from({ length: DAYS_IN_2026 }, (_, index) => {
      const state = remaining
        ? index < ELAPSED_DAYS ? 'inactive' : 'remaining'
        : index < ELAPSED_DAYS ? 'elapsed' : 'inactive'
      return <span
        className={`intro-dot intro-dot--${state}`}
        data-testid="year-dot"
        data-state={state}
        key={index}
        style={{ '--dot-index': index } as CSSProperties}
      ><i data-testid={`${state}-dot`} /></span>
    })}
  </div>
}

const chartPoints = Array.from({ length: 121 }, (_, day) => {
  const value = 1.01 ** day
  const x = 28 + (day / 120) * 344
  const y = 224 - ((value - 1) / (1.01 ** 120 - 1)) * 174
  return `${x.toFixed(2)},${y.toFixed(2)}`
}).join(' ')

function CompoundChart() {
  return <div className="compound-chart">
    <svg viewBox="0 0 400 270" role="img" aria-label="One percent daily compound growth passing 2.7 times at day 100 and continuing beyond">
      <defs>
        <linearGradient id="compound-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--success)" stopOpacity=".28" />
          <stop offset="1" stopColor="var(--success)" stopOpacity="0" />
        </linearGradient>
        <filter id="compound-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g className="compound-chart__grid">
        <line x1="28" y1="224" x2="372" y2="224" />
        <line x1="28" y1="122" x2="372" y2="122" />
        <line x1="28" y1="50" x2="372" y2="50" />
      </g>
      <polygon points={`28,224 ${chartPoints} 372,224`} fill="url(#compound-fill)" />
      <line className="compound-chart__checkpoint" x1="315" y1="95" x2="315" y2="224" />
      <polyline className="compound-chart__line" points={chartPoints} pathLength="1" />
      <circle className="compound-chart__point" cx="315" cy="95" r="5" />
      <g className="compound-chart__labels">
        <text x="28" y="244">DAY 1</text>
        <text x="320" y="244" textAnchor="middle">DAY 100</text>
        <text x="390" y="244" textAnchor="end">DAY 120</text>
        <text x="28" y="216">1.0×</text>
        <text x="28" y="114">2.0×</text>
        <text x="308" y="59" textAnchor="end">2.7X</text>
      </g>
    </svg>
    <span>THE MATHEMATICS OF CONSISTENCY</span>
  </div>
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [step, setStep] = useState(0)

  function continueIntro() {
    if (step === 2) onComplete()
    else setStep(current => current + 1)
  }

  return <main className={`intro-page intro-page--${step + 1}`}>
    <div className="grain" aria-hidden="true" />
    <header className="intro-header">
      <BrandMark />
      {step < 2 && <span className="intro-year">2026</span>}
      {step === 2 && <span className="intro-kicker">The final 100</span>}
    </header>

    <section className="intro-stage" aria-live="polite">
      <div className="intro-slide" key={step}>
        {step === 0 && <>
          <h1><em>73%</em> of 2026 is already gone.</h1>
          <p className="sr-only">265 days have passed and 100 days remain.</p>
          <YearDots remaining={false} />
        </>}
        {step === 1 && <>
          <h1>But <em>27% remains.</em><br />What happens next is yours.</h1>
          <p className="sr-only">265 days have passed and 100 days remain.</p>
          <YearDots remaining />
        </>}
        {step === 2 && <>
          <div className="compound-number">
            <strong>2.7X</strong>
            <span>Your potential trajectory</span>
          </div>
          <CompoundChart />
          <div className="compound-details">
            <code>1.01¹⁰⁰ = 2.70</code>
          </div>
          <p className="compound-copy">Improve by 1% for 100 days.</p>
        </>}
      </div>
    </section>

    <footer className="intro-footer">
      <span>{String(step + 1).padStart(2, '0')} / 03</span>
      <button className="primary-button" type="button" onClick={continueIntro}>Continue</button>
    </footer>
  </main>
}

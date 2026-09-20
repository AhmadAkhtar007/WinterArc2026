import type { DashboardSnapshot } from '../domain/types'
import { ChallengeCard } from '../components/ChallengeCard'
import { ProgressRing } from '../components/ProgressRing'

export function TodayPage({ dashboard, busyChallenge, onComplete }: { dashboard: DashboardSnapshot; busyChallenge: string | null; onComplete: (id: string) => void }) {
  const completed = dashboard.todayChallenges.filter((challenge) => challenge.completed).length
  const dailyProgress = Math.round((completed / Math.max(dashboard.todayChallenges.length, 1)) * 100)
  return (
    <div className="page today-page">
      <section className="hero-panel">
        <div className="hero-panel__atmosphere" aria-hidden="true" />
        <div className="eyebrow"><span /> Day {dashboard.dayNumber} of {dashboard.totalDays}</div>
        <h1>Enter the <em>cold.</em></h1>
        <p>What you repeat today becomes who you are by winter's end.</p>
        <div className="season-line"><span style={{ transform: `scaleX(${dashboard.dayNumber / dashboard.totalDays})` }} /></div>
        <div className="hero-panel__stats">
          <div><strong>{dashboard.points.toLocaleString()}</strong><span>confirmed XP</span></div>
          <div><strong>#{dashboard.rank}</strong><span>current rank</span></div>
          <div><strong>{dashboard.daysRemaining}</strong><span>days remain</span></div>
        </div>
      </section>
      <section className="daily-overview">
        <ProgressRing value={dailyProgress} label="today" detail={`${completed} of ${dashboard.todayChallenges.length} complete`} />
        <div className="daily-overview__copy"><span className="section-kicker">Daily protocol</span><h2>{dailyProgress === 100 ? 'The day is yours.' : 'Finish what you started.'}</h2><p>{dashboard.streak} days without breaking your word.</p></div>
      </section>
      <section className="section-block">
        <div className="section-heading"><div><span className="section-kicker">Your protocol</span><h2>Today's work</h2></div><span>{completed}/{dashboard.todayChallenges.length}</span></div>
        <div className="challenge-stack">{dashboard.todayChallenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} busy={busyChallenge === challenge.id} onComplete={onComplete} />)}</div>
      </section>
      {dashboard.nearestRival && <section className="rival-card"><div><span className="section-kicker">The next ascent</span><h2>{dashboard.nearestRival.displayName} is {dashboard.nearestRival.points - dashboard.points} XP ahead.</h2></div><div className="rival-rank"><span>{dashboard.nearestRival.initials}</span><strong>#{dashboard.nearestRival.rank}</strong></div></section>}
    </div>
  )
}

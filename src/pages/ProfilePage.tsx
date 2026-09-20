import type { DashboardSnapshot } from '../domain/types'

export function ProfilePage({ dashboard, onSignOut }: { dashboard: DashboardSnapshot; onSignOut: () => Promise<void> }) {
  return <div className="page profile-page">
    <section className="profile-identity"><div className="profile-portrait"><span>{dashboard.profile.initials}</span></div><span className="section-kicker">Winter Arc contender</span><h1>{dashboard.profile.displayName}</h1><p>Day {dashboard.dayNumber} · {dashboard.streak} day streak</p></section>
    <section className="profile-metrics"><div><strong>{dashboard.points.toLocaleString()}</strong><span>XP earned</span></div><div><strong>#{dashboard.rank}</strong><span>season rank</span></div><div><strong>{dashboard.completionRate}%</strong><span>completion</span></div></section>
    <section className="consistency-card"><div className="section-heading"><div><span className="section-kicker">Consistency</span><h2>100-day record</h2></div><span>{dashboard.completionRate}%</span></div><div className="heatmap" aria-label={`${dashboard.completionRate}% season completion`}>{Array.from({ length: 100 }, (_, day) => <span key={day} className={day < dashboard.dayNumber && day % 7 !== 5 ? 'is-complete' : day === dashboard.dayNumber ? 'is-today' : ''} />)}</div></section>
    <button className="secondary-button" type="button" onClick={() => void onSignOut()}>Sign out</button>
  </div>
}

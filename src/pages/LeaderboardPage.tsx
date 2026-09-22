import type { LeaderboardEntry } from '../domain/types'

export function LeaderboardPage({ entries }: { entries: LeaderboardEntry[] }) {
  const podium = entries.slice(0, 3)
  const rankings = entries.slice(3)
  return <div className="page leaderboard-page">
    <header className="leaderboard-header"><span className="section-kicker">Season standings</span></header>
    <section className="podium" aria-label="Top three players">{podium.map((entry, index) => <article key={entry.id} className={`podium__player podium__player--${index + 1}`}><span className="podium__medal">0{entry.rank}</span><div className="avatar-orbit"><span>{entry.initials}</span></div><strong>{entry.displayName}</strong><small>{entry.points.toLocaleString()} XP</small></article>)}</section>
    <section className="rank-list" aria-label="Season rankings">{rankings.map((entry) => <article key={entry.id} className={entry.isCurrentPlayer ? 'is-current' : ''}><span className="rank-number">{entry.rank}</span><strong className="rank-name">{entry.displayName}</strong><span className="rank-points">{entry.points.toLocaleString()} XP</span></article>)}</section>
  </div>
}

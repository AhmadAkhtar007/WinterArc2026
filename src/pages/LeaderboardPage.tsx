import type { LeaderboardEntry } from '../domain/types'

export function LeaderboardPage({ entries }: { entries: LeaderboardEntry[] }) {
  const podium = entries.slice(0, 3)
  return <div className="page leaderboard-page">
    <header className="page-header page-header--center"><span className="section-kicker">Season standing</span><h1>The disciplined<br /><em>rise.</em></h1><p>Confirmed work only. Updated when the ledger changes.</p></header>
    <section className="podium" aria-label="Top three players">{podium.map((entry, index) => <article key={entry.id} className={`podium__player podium__player--${index + 1}`}><span className="podium__medal">0{entry.rank}</span><div className="avatar-orbit"><span>{entry.initials}</span></div><strong>{entry.displayName}</strong><small>{entry.points.toLocaleString()} XP</small></article>)}</section>
    <section className="rank-list"><div className="rank-list__header"><span>Rank</span><span>Player</span><span>Done</span><span>XP</span></div>{entries.map((entry) => <article key={entry.id} className={entry.isCurrentPlayer ? 'is-current' : ''}><span className="rank-number">{String(entry.rank).padStart(2, '0')}</span><span className="rank-player"><i>{entry.initials}</i><strong>{entry.displayName}{entry.isCurrentPlayer && <small>You</small>}</strong></span><span>{entry.completedCount}</span><strong>{entry.points.toLocaleString()}</strong></article>)}</section>
  </div>
}

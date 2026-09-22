import type { ReactNode } from 'react'
import type { AppRoute } from '../app/navigation'
import { playerNavigation } from '../app/navigation'

function NavigationIcon({ route }: { route: AppRoute }) {
  const paths: Record<string, ReactNode> = {
    challenges: <><path d="M6 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="M8 9h8M8 13h6M8 17h4" /></>,
    leaderboard: <><path d="M8 21v-7H4v7M14 21V8h-4v13M20 21V3h-4v18" /><path d="M2 21h20" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[route]}</svg>
}

export function BottomNavigation({ activeRoute, onNavigate }: { activeRoute: AppRoute; onNavigate: (route: AppRoute) => void }) {
  return <nav className="bottom-nav" aria-label="Primary navigation">{playerNavigation.map((item) => (
    <button key={item.id} className={activeRoute === item.id ? 'is-active' : ''} type="button" onClick={() => onNavigate(item.id)} aria-current={activeRoute === item.id ? 'page' : undefined}>
      <NavigationIcon route={item.id} /><span>{item.label}</span>
    </button>
  ))}</nav>
}

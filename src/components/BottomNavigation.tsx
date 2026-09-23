import { ChartNoAxesColumnIncreasing, ClipboardList, UserRound } from 'lucide-react'
import type { AppRoute } from '../app/navigation'
import { playerNavigation } from '../app/navigation'

function NavigationIcon({ route }: { route: AppRoute }) {
  const Icon = route === 'leaderboard' ? ChartNoAxesColumnIncreasing : route === 'profile' ? UserRound : ClipboardList
  return <Icon aria-hidden="true" />
}

export function BottomNavigation({ activeRoute, onNavigate }: { activeRoute: AppRoute; onNavigate: (route: AppRoute) => void }) {
  return <nav className="bottom-nav" aria-label="Primary navigation">{playerNavigation.map((item) => (
    <button key={item.id} className={activeRoute === item.id ? 'is-active' : ''} type="button" onClick={() => onNavigate(item.id)} aria-current={activeRoute === item.id ? 'page' : undefined}>
      <NavigationIcon route={item.id} /><span>{item.label}</span>
    </button>
  ))}</nav>
}

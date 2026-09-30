import { NavLink } from 'react-router-dom'

import { navigationItems } from '../data/dashboard'

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4 gap-2">
        {navigationItems.map((item) => {
          const Icon = item.icon

          return (
            <li key={item.key}>
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition ${
                    isActive ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/picks', label: 'Picks', icon: '🎯' },
  { href: '/board', label: 'Board', icon: '🏆' },
  { href: '/results', label: 'Results', icon: '📊' },
]

export default function BottomNav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()

  const items = isAdmin
    ? [...NAV_ITEMS, { href: '/admin', label: 'Admin', icon: '⚙️' }]
    : NAV_ITEMS

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-primary)] border-t border-[var(--border-subtle)]">
      <div className="flex justify-around items-center max-w-lg mx-auto py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-colors ${
                active
                  ? 'text-[var(--fire)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

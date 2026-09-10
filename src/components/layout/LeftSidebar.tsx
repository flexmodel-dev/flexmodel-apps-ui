import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { userNavs, type NavItem } from '@/data/mock'

export function LeftSidebar({
  navs = userNavs,
  sectionKey,
  collapsed,
}: {
  navs?: NavItem[]
  sectionKey?: string
  collapsed?: boolean
}) {
  const location = useLocation()
  const [openMenus, setOpenMenus] = React.useState<string[]>([])

  React.useEffect(() => {
    for (const nav of navs) {
      if (nav.sub?.some((sub) => sub.to && location.pathname.startsWith(sub.to.replace(/\/tasks.*/, '')))) {
        setOpenMenus((open) => (open.includes(nav.id) ? open : [...open, nav.id]))
      }
    }
  }, [location.pathname, navs])

  React.useEffect(() => {
    setOpenMenus([])
  }, [sectionKey])

  const isActive = (nav: NavItem) => {
    if (!nav.to) return false
    return location.pathname === nav.to || (nav.to !== '/dashboard/home' && location.pathname.startsWith(nav.to))
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] border-r bg-background transition-[width] duration-200 md:block',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <nav className="h-full overflow-y-auto p-3">
        <ul className="space-y-1">
          {navs.map((nav) => {
            const isDivider = !nav.to && !nav.sub
            const isOpen = openMenus.includes(nav.id)

            if (isDivider) {
              return (
                <li key={nav.id} className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {!collapsed && nav.text}
                </li>
              )
            }

            if (nav.sub) {
              return (
                <li key={nav.id}>
                  <button
                    type="button"
                    onClick={() => setOpenMenus((open) => (open.includes(nav.id) ? open.filter((id) => id !== nav.id) : [...open, nav.id]))}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    title={nav.text}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      {nav.icon ? <nav.icon className="h-4 w-4" /> : null}
                      {!collapsed && <span className="truncate">{nav.text}</span>}
                    </span>
                    {!collapsed && <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />}
                  </button>
                  {isOpen && !collapsed && (
                    <div className="mt-1 space-y-1 pl-9">
                      {nav.sub.map((child) => (
                        <Link
                          key={child.id}
                          to={child.to!}
                          className={
                            isActive(child)
                              ? 'block rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary'
                              : 'block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary'
                          }
                        >
                          {child.text}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              )
            }

            return (
              <li key={nav.id}>
                <Link
                  to={nav.to!}
                  title={nav.text}
                  className={
                    isActive(nav)
                      ? 'flex items-center gap-3 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary shadow-sm'
                      : 'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary'
                  }
                >
                  {nav.icon ? <nav.icon className="h-4 w-4" /> : null}
                  {!collapsed && <span className="truncate">{nav.text}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

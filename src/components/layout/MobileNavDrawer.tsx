import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from '@/components/ui/drawer'
import type { NavItem, TopNavItem } from '@/data/mock'

type MobileNavDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  navs: NavItem[]
  topNavs?: TopNavItem[]
  activeTopId?: string
  onTopNavChange?: (id: string) => void
}

export function MobileNavDrawer({
  open,
  onOpenChange,
  title,
  navs,
  topNavs,
  activeTopId,
  onTopNavChange,
}: MobileNavDrawerProps) {
  const location = useLocation()
  const [openMenus, setOpenMenus] = React.useState<string[]>([])

  React.useEffect(() => {
    if (!open) {
      setOpenMenus([])
      return
    }

    for (const nav of navs) {
      if (nav.sub?.some((sub) => sub.to && location.pathname.startsWith(sub.to.replace(/\/tasks.*/, '')))) {
        setOpenMenus((open) => (open.includes(nav.id) ? open : [...open, nav.id]))
      }
    }
  }, [location.pathname, navs, open])

  const isActive = (nav: NavItem) => {
    if (!nav.to) return false
    return location.pathname === nav.to || (nav.to !== '/workbench/home' && location.pathname.startsWith(nav.to))
  }

  const closeDrawer = () => onOpenChange(false)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        hideClose
        stacked={false}
        side="left"
        aria-describedby={undefined}
      >
        <DrawerTitle className="border-b px-4 py-4 text-lg font-semibold">
          {title}
        </DrawerTitle>

        {topNavs && topNavs.length > 0 && (
          <nav className="shrink-0 border-b bg-muted/40 p-3">
            <ul className="space-y-1">
              {topNavs.map((topNav) => (
                <li key={topNav.id}>
                  <Link
                    to={topNav.to}
                    onClick={() => onTopNavChange?.(topNav.id)}
                    className={cn(
                      'block rounded-md px-3 py-2 text-sm transition-colors',
                      activeTopId === topNav.id
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
                    )}
                  >
                    {topNav.text}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <nav className="min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {navs.map((nav) => {
              const isDivider = !nav.to && !nav.sub
              const isOpen = openMenus.includes(nav.id)

              if (isDivider) {
                return (
                  <li
                    key={nav.id}
                    className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {nav.text}
                  </li>
                )
              }

              if (nav.sub) {
                return (
                  <li key={nav.id}>
                    <button
                      type="button"
                      onClick={() => setOpenMenus((current) =>
                        current.includes(nav.id)
                          ? current.filter((id) => id !== nav.id)
                          : [...current, nav.id],
                      )}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        {nav.icon ? <nav.icon className="h-4 w-4" /> : null}
                        <span className="truncate">{nav.text}</span>
                      </span>
                      <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                    </button>
                    {isOpen && (
                      <div className="mt-1 space-y-1 pl-9">
                        {nav.sub.map((child) => (
                          <Link
                            key={child.id}
                            to={child.to!}
                            onClick={closeDrawer}
                            className={cn(
                              'block rounded-md px-3 py-2 text-sm transition-colors',
                              isActive(child)
                                ? 'bg-primary/10 font-medium text-primary'
                                : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
                            )}
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
                    onClick={closeDrawer}
                    title={nav.text}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive(nav)
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
                    )}
                  >
                    {nav.icon ? <nav.icon className="h-4 w-4" /> : null}
                    <span className="truncate">{nav.text}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </DrawerContent>
    </Drawer>
  )
}

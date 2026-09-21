import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { userNavs, type NavItem } from '@/data/mock'
import { AppLauncher } from './AppLauncher'

export function LeftSidebar({
  navs = userNavs,
  sectionKey,
  collapsed,
  headerHidden,
  onToggleCollapsed,
}: {
  navs?: NavItem[]
  sectionKey?: string
  collapsed?: boolean
  headerHidden?: boolean
  onToggleCollapsed?: () => void
}) {
  const location = useLocation()
  const currentAppId = location.pathname.match(/^\/app\/([^/]+)/)?.[1]
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
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'fixed left-0 z-30 border-r bg-background transition-[width] duration-200',
          headerHidden ? 'block top-0 h-screen' : 'hidden top-16 h-[calc(100vh-4rem)] md:block',
          headerHidden ? 'top-0 h-screen' : 'top-16 h-[calc(100vh-4rem)]',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <nav className="flex h-full flex-col overflow-hidden p-3">
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {navs.map((nav) => {
              const isDivider = !nav.to && !nav.sub
              const isOpen = openMenus.includes(nav.id)

              if (isDivider) {
                if (collapsed) return null
                return (
                  <li key={nav.id} className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {nav.text}
                  </li>
                )
              }

              if (nav.sub) {
                const trigger = (
                  <button
                    type="button"
                    onClick={() => setOpenMenus((open) => (open.includes(nav.id) ? open.filter((id) => id !== nav.id) : [...open, nav.id]))}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      {nav.icon ? <nav.icon className="h-4 w-4" /> : null}
                      {!collapsed && <span className="truncate">{nav.text}</span>}
                    </span>
                    {!collapsed && <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />}
                  </button>
                )
                return (
                  <li key={nav.id}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                        <TooltipContent side="right">{nav.text}</TooltipContent>
                      </Tooltip>
                    ) : (
                      trigger
                    )}
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

              const link = (
                <Link
                  to={nav.to!}
                  className={
                    isActive(nav)
                      ? 'flex items-center gap-3 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary shadow-sm'
                      : 'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary'
                  }
                >
                  {nav.icon ? <nav.icon className="h-4 w-4" /> : null}
                  {!collapsed && <span className="truncate">{nav.text}</span>}
                </Link>
              )
              return (
                <li key={nav.id}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{nav.text}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        <div className={cn('mt-2 flex shrink-0 items-center border-t pt-2', collapsed ? 'flex-col gap-1' : 'justify-between')}>
          <AppLauncher collapsed={collapsed} currentAppId={currentAppId} />
          <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={onToggleCollapsed}
                >
                  {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? 'right' : 'top'}>{collapsed ? '展开菜单' : '折叠菜单'}</TooltipContent>
            </Tooltip>
          </div>
        </nav>
      </aside>
    </TooltipProvider>
  )
}

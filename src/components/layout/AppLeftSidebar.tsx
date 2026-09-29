import * as React from 'react'
import {Link, useLocation} from 'react-router-dom'
import {ChevronDown, ChevronsLeft, ChevronsRight, Settings} from 'lucide-react'
import {cn} from '@/lib/utils'
import {Button} from '@/components/ui/button'
import {Popover, PopoverAnchor, PopoverContent} from '@/components/ui/popover'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {userNavs, type NavItem} from '@/data/mock'
import {AppLauncher} from './AppLauncher'

function getActiveMenuIds(navs: NavItem[], pathname: string) {
  return navs
    .filter((nav) => nav.sub?.some((sub) => sub.to && pathname.startsWith(sub.to.replace(/\/tasks.*/, ''))))
    .map((nav) => nav.id)
}

function CollapsedGroupMenu({
                              nav,
                              trigger,
                              isActive,
                            }: {
  nav: NavItem
  trigger: React.ReactNode
  isActive: (nav: NavItem) => boolean
}) {
  const [open, setOpen] = React.useState(false)
  const closeTimeoutRef = React.useRef<number>()

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = undefined
    }
  }
  const openMenu = () => {
    clearCloseTimeout()
    setOpen(true)
  }
  const closeMenu = () => {
    clearCloseTimeout()
    closeTimeoutRef.current = window.setTimeout(() => setOpen(false), 100)
  }

  React.useEffect(() => clearCloseTimeout, [])

  if (!nav.sub) return null

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          clearCloseTimeout()
          setOpen(false)
        }
      }}
    >
      <PopoverAnchor asChild>
        <span
          className="block"
          onMouseEnter={openMenu}
          onMouseLeave={closeMenu}
        >
          {trigger}
        </span>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={6}
        className="w-48 p-2"
        onMouseEnter={openMenu}
        onMouseLeave={closeMenu}
      >
        <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">{nav.text}</p>
        <div className="space-y-1">
          {nav.sub.map((child) => (
            <Link
              key={child.id}
              to={child.to!}
              onClick={() => setOpen(false)}
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
      </PopoverContent>
    </Popover>
  )
}

export function AppLeftSidebar({
                                 navs = userNavs,
                                 sectionKey,
                                 collapsed,
                                 headerHidden,
                                 onToggleCollapsed,
                                 onEditMenus,
                               }: {
  navs?: NavItem[]
  sectionKey?: string
  collapsed?: boolean
  headerHidden?: boolean
  onToggleCollapsed?: () => void
  onEditMenus?: () => void
}) {
  const location = useLocation()
  const currentAppId = location.pathname.match(/^\/app\/([^/]+)/)?.[1]
  const [openMenus, setOpenMenus] = React.useState<string[]>(() =>
    getActiveMenuIds(navs, location.pathname),
  )
  const previousSectionKeyRef = React.useRef(sectionKey)

  React.useEffect(() => {
    const activeMenuIds = getActiveMenuIds(navs, location.pathname)
    const sectionChanged = previousSectionKeyRef.current !== sectionKey
    previousSectionKeyRef.current = sectionKey

    setOpenMenus((current) => {
      if (sectionChanged) return activeMenuIds
      return activeMenuIds.reduce(
        (ids, id) => (ids.includes(id) ? ids : [...ids, id]),
        current,
      )
    })
  }, [location.pathname, navs, sectionKey])

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
              const isOpen = openMenus.includes(nav.id)

              if (nav.sub) {
                const trigger = (
                  <button
                    type="button"
                    onClick={() => setOpenMenus((open) => (open.includes(nav.id) ? open.filter((id) => id !== nav.id) : [...open, nav.id]))}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      {nav.icon ? <nav.icon className="h-4 w-4"/> : null}
                      {!collapsed && <span className="truncate">{nav.text}</span>}
                    </span>
                    {!collapsed &&
                      <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}/>}
                  </button>
                )
                return (
                  <li key={nav.id}>
                    {collapsed ? (
                      <CollapsedGroupMenu nav={nav} trigger={trigger} isActive={isActive}/>
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
                  {nav.icon ? <nav.icon className="h-4 w-4"/> : null}
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
          <div
            className={cn('mt-2 flex shrink-0 items-center border-t pt-2', collapsed ? 'flex-col gap-1' : 'justify-between')}>
            <AppLauncher collapsed={collapsed} currentAppId={currentAppId}/>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={onEditMenus}
                >
                  <Settings className="h-4 w-4"/>
                </Button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? 'right' : 'top'}>编辑菜单</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={onToggleCollapsed}
                >
                  {collapsed ? <ChevronsRight className="h-4 w-4"/> : <ChevronsLeft className="h-4 w-4"/>}
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

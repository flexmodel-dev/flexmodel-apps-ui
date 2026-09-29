import * as React from 'react'
import {Link, useLocation} from 'react-router-dom'
import {Briefcase, ChevronsLeft, ChevronsRight, LayoutGrid, Pencil, ShieldCheck, Users} from 'lucide-react'
import {cn} from '@/lib/utils'
import {Button} from '@/components/ui/button'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import type {NavItem} from '@/data/mock'
import {AppLauncher} from './AppLauncher'

export const adminNavs: NavItem[] = [
  {id: 'apps', text: '应用管理', to: '/admin/apps', icon: LayoutGrid},
  {id: 'divider-users', text: '用户', to: ''},
  {id: 'users', text: '部门用户', to: '/admin/bizuser/users', icon: Users},
  {id: 'roles', text: '角色权限', to: '/admin/bizuser/role-privileges', icon: ShieldCheck},
  {id: 'teams', text: '团队', to: '/admin/bizuser/teams', icon: Briefcase},
]

export function AdminLeftSidebar({
                                   collapsed,
                                   onToggleCollapsed,
                                   onEditMenus,
                                 }: {
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onEditMenus?: () => void
}) {
  const location = useLocation()

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] border-r bg-background transition-[width] duration-200 md:block',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <nav className="flex h-full flex-col overflow-hidden p-3">
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {adminNavs.map((nav) => {
              if (!nav.to) {
                if (collapsed) return null
                return (
                  <li
                    key={nav.id}
                    className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {nav.text}
                  </li>
                )
              }

              const active = location.pathname === nav.to
              const link = (
                <Link
                  to={nav.to}
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
                  )}
                >
                  {nav.icon ? <nav.icon className="h-4 w-4"/> : null}
                  {!collapsed && <span className="truncate">{nav.text}</span>}
                </Link>
              )
              return (
                <li key={nav.id}>
                  <div className="flex items-center">
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{nav.text}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <div
            className={cn('mt-2 flex shrink-0 items-center border-t pt-2', collapsed ? 'flex-col gap-1' : 'justify-between')}>
            <AppLauncher collapsed={collapsed}/>
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

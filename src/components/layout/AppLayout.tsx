import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {getEntity, getTopNavIdByPath, topNavs, type NavItem} from '@/data/mock'
import {Briefcase, ChevronsLeft, ChevronsRight, LayoutGrid, Pencil, ShieldCheck, Users} from 'lucide-react'
import { TopHeader } from './TopHeader'
import { LeftSidebar } from './LeftSidebar'
import { AppLauncher } from './AppLauncher'
import {MenuEditorDialog} from './MenuEditorDialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const adminNavs: NavItem[] = [
  { id: 'apps', text: '应用管理', to: '/admin/apps', icon: LayoutGrid },
  { id: 'divider-users', text: '用户', to: '' },
  { id: 'users', text: '部门用户', to: '/admin/bizuser/users', icon: Users },
  { id: 'roles', text: '角色权限', to: '/admin/bizuser/role-privileges', icon: ShieldCheck },
  { id: 'teams', text: '团队', to: '/admin/bizuser/teams', icon: Briefcase },
]

function AdminSidebar({
                        collapsed,
                        onToggleCollapsed,
                        onEditMenus,
                      }: {
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onEditMenus?: () => void
}) {
  const location = useLocation()
  const currentAppId = location.pathname.match(/^\/app\/([^/]+)/)?.[1]
  const entityDesignMatch = location.pathname.match(/^\/admin\/entity\/([^/]+)/)
  const currentEntity = entityDesignMatch?.[1]
  const showEntitySubmenu = Boolean(entityDesignMatch)

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

              const active = location.pathname === nav.to || (nav.id === 'entities' && showEntitySubmenu)
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
                  {nav.icon ? <nav.icon className="h-4 w-4" /> : null}
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
        <div className={cn('mt-2 flex shrink-0 items-center border-t pt-2', collapsed ? 'flex-col gap-1' : 'justify-between')}>
          <AppLauncher collapsed={collapsed} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={onEditMenus}
              >
                <Pencil className="h-4 w-4"/>
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

export function AppLayout({
  children,
  admin,
  adminActive,
  noPadding,
  contentClassName,
  noOuterScroll,
  hideHeader,
}: {
  children: React.ReactNode
  admin?: boolean
  adminActive?: string
  noPadding?: boolean
  contentClassName?: string
  noOuterScroll?: boolean
  hideHeader?: boolean
}) {
  const location = useLocation()
  const [collapsed, setCollapsed] = React.useState(false)
  const [activeTopId, setActiveTopId] = React.useState(() => getTopNavIdByPath(location.pathname))
  const [menuEditorOpen, setMenuEditorOpen] = React.useState(false)
  const [menuVersion, setMenuVersion] = React.useState(0)

  React.useEffect(() => {
    const nextTopId = getTopNavIdByPath(location.pathname, activeTopId)
    if (nextTopId !== activeTopId) setActiveTopId(nextTopId)
  }, [location.pathname, activeTopId, menuVersion])

  const activeTop = topNavs.find((nav) => nav.id === activeTopId) ?? topNavs[0]
  const useAdminSidebar = admin || activeTop.id === 'top-admin'
  const showEntitySidebar = useAdminSidebar && /^\/admin\/entity\//.test(location.pathname)
  const currentEntity = location.pathname.match(/^\/admin\/entity\/([^/]+)/)?.[1]
  const currentEntityMeta = currentEntity ? getEntity(currentEntity) : undefined
  const mobileNavs = useAdminSidebar
    ? showEntitySidebar && currentEntity
      ? [
          ...adminNavs,
          {
            id: 'mobile-entity',
            text: currentEntityMeta?.label ?? '实体',
            sub: [
              { id: 'mobile-entity-base', text: '基本信息', to: `/admin/entity/${currentEntity}/base` },
              { id: 'mobile-entity-fields', text: '字段管理', to: `/admin/entity/${currentEntity}/fields` },
              { id: 'mobile-entity-form-design', text: '表单设计', to: `/admin/entity/${currentEntity}/form-design` },
              { id: 'mobile-entity-easy-action', text: '自定义操作', to: `/admin/entity/${currentEntity}/easy-action` },
              { id: 'mobile-entity-record-alerts', text: '记录锁定', to: `/admin/entity/${currentEntity}/record-alerts` },
              { id: 'mobile-entity-advanced', text: '高级配置', to: `/admin/entity/${currentEntity}/advanced` },
            ],
          },
        ]
      : adminNavs
    : activeTop.navs

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideHeader && (
        <TopHeader
          activeTopId={activeTop.id}
          onTopNavChange={setActiveTopId}
          isAdmin={useAdminSidebar}
          mobileNavs={mobileNavs}
        />
      )}

      {!hideHeader &&
        (useAdminSidebar ? (
          <AdminSidebar
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((value) => !value)}
            onEditMenus={() => setMenuEditorOpen(true)}
          />
        ) : (
          <LeftSidebar
            collapsed={collapsed}
            navs={activeTop.navs}
            sectionKey={activeTop.id}
            onToggleCollapsed={() => setCollapsed((value) => !value)}
            onEditMenus={() => setMenuEditorOpen(true)}
          />
        ))}

      <MenuEditorDialog
        open={menuEditorOpen}
        onOpenChange={setMenuEditorOpen}
        activeTopId={activeTop.id}
        onActiveTopIdChange={setActiveTopId}
        onMenusChange={() => setMenuVersion((version) => version + 1)}
      />

      {showEntitySidebar && (
        <aside
          className={cn(
            'fixed top-16 z-30 hidden h-[calc(100vh-4rem)] w-64 border-r bg-background md:block',
            collapsed ? 'left-16' : 'left-64',
          )}
        >
          <div className="flex h-full flex-col">
            <div className="border-b px-4 py-4">
              <div className="text-xl font-semibold text-foreground">
                {currentEntityMeta?.label ?? '实体'}
              </div>
              {currentEntityMeta?.description && (
                <p className="mb-0 mt-1 text-xs text-muted-foreground">
                  {currentEntityMeta.description}
                </p>
              )}
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {[
                  { key: 'base', label: '基本信息', to: `/admin/entity/${currentEntity}/base` },
                  { key: 'fields', label: '字段管理', to: `/admin/entity/${currentEntity}/fields` },
                  { key: 'form-design', label: '表单设计', to: `/admin/entity/${currentEntity}/form-design` },
                  { key: 'easy-action', label: '自定义操作', to: `/admin/entity/${currentEntity}/easy-action` },
                  { key: 'record-alerts', label: '记录锁定', to: `/admin/entity/${currentEntity}/record-alerts` },
                  { key: 'advanced', label: '高级配置', to: `/admin/entity/${currentEntity}/advanced` },
                ].map((item) => (
                  <li key={item.key}>
                    <Link
                      to={item.to}
                      className={cn(
                        'block rounded-md px-3 py-2 text-sm transition-colors',
                        location.pathname === item.to
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>
      )}

      <main
        className={cn(
          hideHeader ? 'mt-0 h-screen md:ml-0' : 'mt-16 h-[calc(100vh-4rem)]',
          noOuterScroll ? 'overflow-hidden' : 'overflow-y-auto',
          noPadding ? '' : 'px-4 pb-4 md:px-6 md:pb-6',
          hideHeader
            ? ''
            : showEntitySidebar
              ? collapsed
                ? 'md:ml-[20rem]'
                : 'md:ml-[32rem]'
              : collapsed
                ? 'md:ml-16'
                : 'md:ml-64',
        )}
      >
        <div className={cn('w-full pt-4 md:pt-6', contentClassName)}>{children}</div>
      </main>
    </div>
  )
}

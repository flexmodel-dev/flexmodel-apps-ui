import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { getEntity, getTopNavIdByPath, topNavs, type NavItem } from '@/data/mock'
import { Briefcase, Boxes, ChevronsLeft, ChevronsRight, ClipboardCheck, LogIn, Recycle, Settings, Shapes, ShieldCheck, Users } from 'lucide-react'
import { TopHeader } from './TopHeader'
import { LeftSidebar } from './LeftSidebar'
import { Button } from '@/components/ui/button'

const adminNavs: NavItem[] = [
  { id: 'divider-systems', text: '系统', to: '' },
  { id: 'systems', text: '通用配置', to: '/admin/systems', icon: Settings },
  { id: 'divider-entities', text: '业务对象', to: '' },
  { id: 'entities', text: '实体管理', to: '/admin/entities', icon: Boxes },
  { id: 'approvals', text: '审批流程', to: '/admin/robot/approvals', icon: ClipboardCheck },
  { id: 'triggers', text: '触发器', to: '/admin/robot/triggers', icon: Settings },
  { id: 'divider-features', text: '更多功能', to: '' },
  { id: 'projects', text: '项目', to: '/admin/projects', icon: Shapes },
  { id: 'divider-users', text: '用户', to: '' },
  { id: 'users', text: '部门用户', to: '/admin/bizuser/users', icon: Users },
  { id: 'roles', text: '角色权限', to: '/admin/bizuser/role-privileges', icon: ShieldCheck },
  { id: 'teams', text: '团队', to: '/admin/bizuser/teams', icon: Briefcase },
  { id: 'divider-audit', text: '审计', to: '' },
  { id: 'login-logs', text: '登录日志', to: '/admin/audit/login-logs', icon: LogIn },
  { id: 'recycle-bin', text: '回收站', to: '/admin/audit/recycle-bin', icon: Recycle },
]

function AdminSidebar({ collapsed, onToggleCollapsed }: { collapsed?: boolean; onToggleCollapsed?: () => void }) {
  const location = useLocation()
  const entityDesignMatch = location.pathname.match(/^\/admin\/entity\/([^/]+)/)
  const currentEntity = entityDesignMatch?.[1]
  const showEntitySubmenu = Boolean(entityDesignMatch)

  return (
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
              return (
                <li
                  key={nav.id}
                  className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {!collapsed && nav.text}
                </li>
              )
            }

            const active = location.pathname === nav.to || (nav.id === 'entities' && showEntitySubmenu)
            return (
              <li key={nav.id}>
                <div className="flex items-center">
                  <Link
                    to={nav.to}
                    title={nav.text}
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
                </div>
              </li>
            )
          })}
        </ul>
        <div className={cn('mt-2 flex shrink-0 border-t pt-2', collapsed ? 'justify-center' : 'justify-end')}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={onToggleCollapsed}
            title={collapsed ? '展开菜单' : '折叠菜单'}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </Button>
        </div>
      </nav>
    </aside>
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

  React.useEffect(() => {
    const currentTop = topNavs.find((nav) => nav.id === activeTopId)
    const currentContains = currentTop?.navs.some(
      (nav) => nav.to === location.pathname || (nav.to && location.pathname.startsWith(`${nav.to}/`)),
    )
    const nextTopId = getTopNavIdByPath(location.pathname)
    if (!currentContains && nextTopId !== activeTopId) {
      setActiveTopId(nextTopId)
    }
  }, [location.pathname, activeTopId])

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
          <AdminSidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((value) => !value)} />
        ) : (
          <LeftSidebar
            collapsed={collapsed}
            navs={activeTop.navs}
            sectionKey={activeTop.id}
            onToggleCollapsed={() => setCollapsed((value) => !value)}
          />
        ))}

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

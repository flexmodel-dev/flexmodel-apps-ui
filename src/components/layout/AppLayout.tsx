import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { getTopNavIdByPath, topNavs } from '@/data/mock'
import { ClipboardCheck, LogIn, Recycle, Settings, Shapes, ShieldCheck, Users, Briefcase, Boxes } from 'lucide-react'
import { TopHeader } from './TopHeader'
import { LeftSidebar } from './LeftSidebar'

const adminNavs = [
  { id: 'divider-systems', label: '系统', to: '' },
  { id: 'systems', label: '通用配置', to: '/admin/systems', icon: Settings },
  { id: 'divider-entities', label: '业务实体', to: '' },
  { id: 'entities', label: '实体管理', to: '/admin/entities', icon: Boxes },
  { id: 'approvals', label: '审批流程', to: '/admin/robot/approvals', icon: ClipboardCheck },
  { id: 'triggers', label: '触发器', to: '/admin/robot/triggers', icon: Settings },
  { id: 'divider-features', label: '更多功能', to: '' },
  { id: 'projects', label: '项目', to: '/admin/projects', icon: Shapes },
  { id: 'divider-users', label: '用户', to: '' },
  { id: 'users', label: '部门用户', to: '/admin/bizuser/users', icon: Users },
  { id: 'roles', label: '角色权限', to: '/admin/bizuser/role-privileges', icon: ShieldCheck },
  { id: 'teams', label: '团队', to: '/admin/bizuser/teams', icon: Briefcase },
  { id: 'divider-audit', label: '审计', to: '' },
  { id: 'login-logs', label: '登录日志', to: '/admin/audit/login-logs', icon: LogIn },
  { id: 'recycle-bin', label: '回收站', to: '/admin/audit/recycle-bin', icon: Recycle },
]

function AdminSidebar({ collapsed }: { collapsed?: boolean }) {
  const location = useLocation()

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] border-r bg-background transition-[width] duration-200 md:block',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <nav className="h-full overflow-y-auto p-3">
        <ul className="space-y-1">
          {adminNavs.map((nav) => {
            if (!nav.to) {
              return (
                <li
                  key={nav.id}
                  className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {!collapsed && nav.label}
                </li>
              )
            }

            const active = location.pathname === nav.to
            return (
              <li key={nav.id}>
                <Link
                  to={nav.to}
                  title={nav.label}
                  className={
                    active
                      ? 'flex items-center gap-3 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary shadow-sm'
                      : 'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary'
                  }
                >
                  {nav.icon ? <nav.icon className="h-4 w-4" /> : null}
                  {!collapsed && <span className="truncate">{nav.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
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
}: {
  children: React.ReactNode
  admin?: boolean
  adminActive?: string
  noPadding?: boolean
  contentClassName?: string
  noOuterScroll?: boolean
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopHeader
        activeTopId={activeTop.id}
        onTopNavChange={setActiveTopId}
        onToggleSidebar={() => setCollapsed((value) => !value)}
      />

      {useAdminSidebar ? <AdminSidebar collapsed={collapsed} /> : <LeftSidebar collapsed={collapsed} navs={activeTop.navs} sectionKey={activeTop.id} />}

      <main
        className={cn(
          'mt-16 h-[calc(100vh-4rem)] transition-[margin-left] duration-200',
          noOuterScroll ? 'overflow-hidden' : 'overflow-y-auto',
          noPadding ? '' : 'px-4 pb-4 md:px-6 md:pb-6',
          collapsed ? 'md:ml-16' : 'md:ml-64',
        )}
      >
        <div className={cn('w-full pt-4 md:pt-6', contentClassName)}>{children}</div>
      </main>
    </div>
  )
}

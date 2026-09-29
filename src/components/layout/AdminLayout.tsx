import * as React from 'react'
import {Link, useLocation} from 'react-router-dom'
import {cn} from '@/lib/utils'
import {getEntity, topNavs} from '@/data/mock'
import {AdminTopHeader} from './AdminTopHeader'
import {AdminLeftSidebar, adminNavs} from './AdminLeftSidebar'
import {MenuEditorDialog} from './MenuEditorDialog'

export function AdminLayout({
                              children,
                              noPadding,
                              contentClassName,
                              noOuterScroll,
                              hideHeader,
                            }: {
  children: React.ReactNode
  noPadding?: boolean
  contentClassName?: string
  noOuterScroll?: boolean
  hideHeader?: boolean
}) {
  const location = useLocation()
  const [collapsed, setCollapsed] = React.useState(false)
  const [activeTopId, setActiveTopId] = React.useState(topNavs[0].id)
  const [menuEditorOpen, setMenuEditorOpen] = React.useState(false)

  const showEntitySidebar = /^\/admin\/entity\//.test(location.pathname)
  const currentEntity = location.pathname.match(/^\/admin\/entity\/([^/]+)/)?.[1]
  const currentEntityMeta = currentEntity ? getEntity(currentEntity) : undefined
  const mobileNavs = showEntitySidebar && currentEntity
    ? [
      ...adminNavs,
      {
        id: 'mobile-entity',
        text: currentEntityMeta?.label ?? '实体',
        sub: [
          {id: 'mobile-entity-base', text: '基本信息', to: `/admin/entity/${currentEntity}/base`},
          {id: 'mobile-entity-fields', text: '字段管理', to: `/admin/entity/${currentEntity}/fields`},
          {id: 'mobile-entity-form-design', text: '表单设计', to: `/admin/entity/${currentEntity}/form-design`},
          {id: 'mobile-entity-easy-action', text: '自定义操作', to: `/admin/entity/${currentEntity}/easy-action`},
          {id: 'mobile-entity-record-alerts', text: '记录锁定', to: `/admin/entity/${currentEntity}/record-alerts`},
          {id: 'mobile-entity-advanced', text: '高级配置', to: `/admin/entity/${currentEntity}/advanced`},
        ],
      },
    ]
    : adminNavs

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideHeader && <AdminTopHeader mobileNavs={mobileNavs}/>}

      {!hideHeader && (
        <AdminLeftSidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onEditMenus={() => setMenuEditorOpen(true)}
        />
      )}

      <MenuEditorDialog
        open={menuEditorOpen}
        onOpenChange={setMenuEditorOpen}
        activeTopId={activeTopId}
        onActiveTopIdChange={setActiveTopId}
        onMenusChange={() => undefined}
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
                  {key: 'base', label: '基本信息', to: `/admin/entity/${currentEntity}/base`},
                  {key: 'fields', label: '字段管理', to: `/admin/entity/${currentEntity}/fields`},
                  {key: 'form-design', label: '表单设计', to: `/admin/entity/${currentEntity}/form-design`},
                  {key: 'easy-action', label: '自定义操作', to: `/admin/entity/${currentEntity}/easy-action`},
                  {key: 'record-alerts', label: '记录锁定', to: `/admin/entity/${currentEntity}/record-alerts`},
                  {key: 'advanced', label: '高级配置', to: `/admin/entity/${currentEntity}/advanced`},
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

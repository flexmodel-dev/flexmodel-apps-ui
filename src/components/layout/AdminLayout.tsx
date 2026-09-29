import * as React from 'react'
import {Link, useLocation} from 'react-router-dom'
import {cn} from '@/lib/utils'
import {getBusinessObject, topNavs} from '@/data/mock'
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

  const showBusinessObjectSidebar = /^\/admin\/business-object\//.test(location.pathname)
  const currentBusinessObject = location.pathname.match(/^\/admin\/business-object\/([^/]+)/)?.[1]
  const currentBusinessObjectMeta = currentBusinessObject ? getBusinessObject(currentBusinessObject) : undefined
  const mobileNavs = showBusinessObjectSidebar && currentBusinessObject
    ? [
      ...adminNavs,
      {
        id: 'mobile-business-object',
        text: currentBusinessObjectMeta?.label ?? '业务对象',
        sub: [
          {
            id: 'mobile-business-object-base',
            text: '基本信息',
            to: `/admin/business-object/${currentBusinessObject}/base`
          },
          {
            id: 'mobile-business-object-fields',
            text: '字段管理',
            to: `/admin/business-object/${currentBusinessObject}/fields`
          },
          {
            id: 'mobile-business-object-form-design',
            text: '表单设计',
            to: `/admin/business-object/${currentBusinessObject}/form-design`
          },
          {
            id: 'mobile-business-object-easy-action',
            text: '自定义操作',
            to: `/admin/business-object/${currentBusinessObject}/easy-action`
          },
          {
            id: 'mobile-business-object-record-alerts',
            text: '记录锁定',
            to: `/admin/business-object/${currentBusinessObject}/record-alerts`
          },
          {
            id: 'mobile-business-object-advanced',
            text: '高级配置',
            to: `/admin/business-object/${currentBusinessObject}/advanced`
          },
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

      {showBusinessObjectSidebar && (
        <aside
          className={cn(
            'fixed top-16 z-30 hidden h-[calc(100vh-4rem)] w-64 border-r bg-background md:block',
            collapsed ? 'left-16' : 'left-64',
          )}
        >
          <div className="flex h-full flex-col">
            <div className="border-b px-4 py-4">
              <div className="text-xl font-semibold text-foreground">
                {currentBusinessObjectMeta?.label ?? '业务对象'}
              </div>
              {currentBusinessObjectMeta?.description && (
                <p className="mb-0 mt-1 text-xs text-muted-foreground">
                  {currentBusinessObjectMeta.description}
                </p>
              )}
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {[
                  {key: 'base', label: '基本信息', to: `/admin/business-object/${currentBusinessObject}/base`},
                  {key: 'fields', label: '字段管理', to: `/admin/business-object/${currentBusinessObject}/fields`},
                  {
                    key: 'form-design',
                    label: '表单设计',
                    to: `/admin/business-object/${currentBusinessObject}/form-design`
                  },
                  {
                    key: 'easy-action',
                    label: '自定义操作',
                    to: `/admin/business-object/${currentBusinessObject}/easy-action`
                  },
                  {
                    key: 'record-alerts',
                    label: '记录锁定',
                    to: `/admin/business-object/${currentBusinessObject}/record-alerts`
                  },
                  {key: 'advanced', label: '高级配置', to: `/admin/business-object/${currentBusinessObject}/advanced`},
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
            : showBusinessObjectSidebar
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

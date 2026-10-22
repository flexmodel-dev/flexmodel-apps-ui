import * as React from 'react'
import {Link, useLocation} from 'react-router-dom'
import {cn} from '@/lib/utils'
import {topNavs} from '@/data/mock'
import {AdminTopHeader} from './AdminTopHeader'
import {AdminLeftSidebar, adminNavs} from './AdminLeftSidebar'
import {MenuEditorDialog} from './MenuEditorDialog'
import {getAppForm} from '@/services/appForms'

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

  const showFormSidebar = /^\/admin\/apps\/[^/]+\/forms\//.test(location.pathname)
  const currentFormMatch = location.pathname.match(/^\/admin\/apps\/([^/]+)\/forms\/([^/]+)/)
  const currentAppId = currentFormMatch?.[1] ?? ''
  const currentFormName = currentFormMatch?.[2] ?? ''
  const [currentFormLabel, setCurrentFormLabel] = React.useState(currentFormName)

  React.useEffect(() => {
    if (!currentAppId || !currentFormName) {
      setCurrentFormLabel('')
      return
    }
    let cancelled = false
    setCurrentFormLabel(currentFormName)
    getAppForm(currentAppId, currentFormName)
      .then((form) => {
        if (!cancelled) setCurrentFormLabel(form.label)
      })
      .catch(() => {
        if (!cancelled) setCurrentFormLabel(currentFormName)
      })
    return () => {
      cancelled = true
    }
  }, [currentAppId, currentFormName])

  const mobileNavs = showFormSidebar && currentFormName
    ? [
      ...adminNavs,
      {
        id: 'mobile-form',
        text: currentFormLabel,
        sub: [
          {
            id: 'mobile-form-base',
            text: '基本信息',
            to: `/admin/apps/${currentAppId}/forms/${currentFormName}/base`
          },
          {
            id: 'mobile-form-design',
            text: '表单设计',
            to: `/admin/apps/${currentAppId}/forms/${currentFormName}/form-design`
          },
          {
            id: 'mobile-form-fields',
            text: '字段管理',
            to: `/admin/apps/${currentAppId}/forms/${currentFormName}/fields`
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

      {showFormSidebar && (
        <aside
          className={cn(
            'fixed top-16 z-30 hidden h-[calc(100vh-4rem)] w-64 border-r bg-background md:block',
            collapsed ? 'left-16' : 'left-64',
          )}
        >
          <div className="flex h-full flex-col">
            <div className="border-b px-4 py-4">
              <div className="text-xl font-semibold text-foreground">
                {currentFormLabel}
              </div>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {[
                  {key: 'base', label: '基本信息', to: `/admin/apps/${currentAppId}/forms/${currentFormName}/base`},
                  {
                    key: 'form-design',
                    label: '表单设计',
                    to: `/admin/apps/${currentAppId}/forms/${currentFormName}/form-design`
                  },
                  {key: 'fields', label: '字段管理', to: `/admin/apps/${currentAppId}/forms/${currentFormName}/fields`},
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
            : showFormSidebar
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

import * as React from 'react'
import {useLocation} from 'react-router-dom'
import { cn } from '@/lib/utils'
import {getTopNavIdByPath, topNavs} from '@/data/mock'
import {AppTopHeader} from './AppTopHeader'
import {AppLeftSidebar} from './AppLeftSidebar'
import {MenuEditorDialog} from './MenuEditorDialog'

export function AppLayout({
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
  const [activeTopId, setActiveTopId] = React.useState(() => getTopNavIdByPath(location.pathname))
  const [menuEditorOpen, setMenuEditorOpen] = React.useState(false)
  const [menuVersion, setMenuVersion] = React.useState(0)

  React.useEffect(() => {
    const nextTopId = getTopNavIdByPath(location.pathname, activeTopId)
    if (nextTopId !== activeTopId) setActiveTopId(nextTopId)
  }, [location.pathname, activeTopId, menuVersion])

  const activeTop = topNavs.find((nav) => nav.id === activeTopId) ?? topNavs[0]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideHeader && (
        <AppTopHeader
          activeTopId={activeTop.id}
          onTopNavChange={setActiveTopId}
          mobileNavs={activeTop.navs}
        />
      )}

      {!hideHeader && (
        <AppLeftSidebar
          collapsed={collapsed}
          navs={activeTop.navs}
          sectionKey={activeTop.id}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onEditMenus={() => setMenuEditorOpen(true)}
        />
      )}

      <MenuEditorDialog
        open={menuEditorOpen}
        onOpenChange={setMenuEditorOpen}
        activeTopId={activeTop.id}
        onActiveTopIdChange={setActiveTopId}
        onMenusChange={() => setMenuVersion((version) => version + 1)}
      />

      <main
        className={cn(
          hideHeader ? 'mt-0 h-screen md:ml-0' : 'mt-16 h-[calc(100vh-4rem)]',
          noOuterScroll ? 'overflow-hidden' : 'overflow-y-auto',
          noPadding ? '' : 'px-4 pb-4 md:px-6 md:pb-6',
          hideHeader ? '' : collapsed ? 'md:ml-16' : 'md:ml-64',
        )}
      >
        <div className={cn('w-full pt-4 md:pt-6', contentClassName)}>{children}</div>
      </main>
    </div>
  )
}

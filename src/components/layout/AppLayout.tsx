import * as React from 'react'
import {useLocation} from 'react-router-dom'
import { cn } from '@/lib/utils'
import {getTopNavIdByPath, topNavs} from '@/data/mock'
import {getAppById, type App} from '@/services/apps'
import {getAppMenus, type AppMenu} from '@/services/appMenus'
import {toTopNavigationItem} from '@/services/appMenuNavigation'
import {AppTopHeader} from './AppTopHeader'
import {AppLeftSidebar} from './AppLeftSidebar'
import {MenuEditorDialog} from './MenuEditorDialog'

export function AppLayout({
  children,
  noPadding,
  contentClassName,
  noOuterScroll,
  hideHeader,
                            menuEditorOpen: menuEditorOpenProp,
                            onMenuEditorOpenChange,
}: {
  children: React.ReactNode
  noPadding?: boolean
  contentClassName?: string
  noOuterScroll?: boolean
  hideHeader?: boolean
  menuEditorOpen?: boolean
  onMenuEditorOpenChange?: (open: boolean) => void
}) {
  const location = useLocation()
  const appId = location.pathname.match(/^\/apps\/([^/]+)/)?.[1]
  const routeTopId = appId ? new URLSearchParams(location.search).get('top') : null
  const [collapsed, setCollapsed] = React.useState(false)
  const [activeTopId, setActiveTopId] = React.useState(() => appId ? routeTopId ?? '' : getTopNavIdByPath(location.pathname))
  const [menuEditorOpen, setMenuEditorOpen] = React.useState(false)
  const [menuVersion, setMenuVersion] = React.useState(0)
  const [app, setApp] = React.useState<App | null>(null)
  const [appMenus, setAppMenus] = React.useState<AppMenu[]>([])
  const effectiveMenuEditorOpen = menuEditorOpenProp ?? menuEditorOpen
  const setEffectiveMenuEditorOpen = onMenuEditorOpenChange ?? setMenuEditorOpen

  React.useEffect(() => {
    if (appId) {
      if (routeTopId) {
        if (routeTopId !== activeTopId) setActiveTopId(routeTopId)
      } else if (appMenus.length > 0 && !appMenus.some((menu) => menu.id === activeTopId)) {
        setActiveTopId(appMenus[0].id)
      }
      return
    }
    const nextTopId = getTopNavIdByPath(location.pathname, activeTopId)
    if (nextTopId !== activeTopId) setActiveTopId(nextTopId)
  }, [appId, routeTopId, appMenus, location.pathname, activeTopId, menuVersion])

  React.useEffect(() => {
    document.documentElement.dataset.primary = app?.primaryColor ?? 'indigo'
    return () => {
      document.documentElement.dataset.primary = 'indigo'
    }
  }, [app?.primaryColor])

  React.useEffect(() => {
    if (!appId) {
      setApp(null)
      return
    }
    let cancelled = false
    getAppById(appId)
      .then((loadedApp) => {
        if (cancelled) return
        setApp(loadedApp)
      })
      .catch(() => {
        if (cancelled) return
        setApp(null)
      })
    return () => {
      cancelled = true
    }
  }, [appId])

  React.useEffect(() => {
    if (!appId) {
      setAppMenus([])
      return
    }
    let cancelled = false
    getAppMenus(appId)
      .then((loadedMenus) => !cancelled && setAppMenus(loadedMenus))
      .catch(() => !cancelled && setAppMenus([]))
    return () => {
      cancelled = true
    }
  }, [appId, menuVersion])

  const topMenuItems = appId
    ? appMenus.map((menu) => toTopNavigationItem(menu, appId))
    : topNavs
  const activeTop = topMenuItems.find((nav) => nav.id === activeTopId) ?? topMenuItems[0]
  const editMenus = () => setEffectiveMenuEditorOpen(true)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideHeader && (
        <AppTopHeader
          activeTopId={activeTop?.id ?? ''}
          onTopNavChange={setActiveTopId}
          mobileNavs={appId ? (activeTop?.navs ?? []) : activeTop.navs}
          app={app ?? undefined}
          topNavItems={topMenuItems}
        />
      )}

      {!hideHeader && (
        <AppLeftSidebar
          collapsed={collapsed}
          navs={appId ? (activeTop?.navs ?? []) : activeTop.navs}
          sectionKey={activeTop?.id ?? ''}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onEditMenus={editMenus}
        />
      )}

      <MenuEditorDialog
        open={effectiveMenuEditorOpen}
        onOpenChange={setEffectiveMenuEditorOpen}
        activeTopId={activeTop?.id ?? ''}
        onActiveTopIdChange={setActiveTopId}
        onMenusChange={(menus) => {
          if (menus) setAppMenus(menus)
          setMenuVersion((version) => version + 1)
        }}
        appId={appId}
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

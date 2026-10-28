import * as React from 'react'
import {useLocation} from 'react-router-dom'
import { cn } from '@/lib/utils'
import {getTopNavIdByPath, topNavs} from '@/data/mock'
import {getAppById, type App} from '@/services/apps'
import {applyAppPrimaryColor} from '@/theme/appPrimaryColors'
import {getAppMenus, type AppMenu} from '@/services/appMenus'
import {
  findFormMenuTargets,
  findMenuById,
  findTopMenuIdForMenu,
  toTopNavigationItem,
} from '@/services/appMenuNavigation'
import {AppRecordCreateDialog} from '@/components/biz/AppRecordCreateDialog'
import {AppTopHeader} from './AppTopHeader'
import {AppLeftSidebar} from './AppLeftSidebar'
import {MenuEditorDialog, type MenuEditorDraft} from './MenuEditorDialog'

export function AppLayout({
  children,
  noPadding,
  contentClassName,
  noOuterScroll,
  hideHeader,
                            hideNavigation,
                            showBack,
                            menuEditorOpen: menuEditorOpenProp,
                            onMenuEditorOpenChange,
}: {
  children: React.ReactNode
  noPadding?: boolean
  contentClassName?: string
  noOuterScroll?: boolean
  hideHeader?: boolean
  hideNavigation?: boolean
  showBack?: boolean
  menuEditorOpen?: boolean
  onMenuEditorOpenChange?: (open: boolean) => void
}) {
  const location = useLocation()
  const appId = location.pathname.match(/^\/apps\/([^/]+)/)?.[1]
  const routeTopId = appId ? new URLSearchParams(location.search).get('top') : null
  const routeMenuId = appId ? location.pathname.match(/^\/apps\/[^/]+\/([^/]+)/)?.[1] : null
  const [collapsed, setCollapsed] = React.useState(false)
  const [activeTopId, setActiveTopId] = React.useState(() => appId ? routeTopId ?? '' : hideNavigation ? '' : getTopNavIdByPath(location.pathname))
  const [menuEditorOpen, setMenuEditorOpen] = React.useState(false)
  const [menuEditorDraft, setMenuEditorDraft] = React.useState<MenuEditorDraft | null>(null)
  const [menuVersion, setMenuVersion] = React.useState(0)
  const [app, setApp] = React.useState<App | null>(null)
  const [appMenus, setAppMenus] = React.useState<AppMenu[]>([])
  const [isAppLoading, setIsAppLoading] = React.useState(Boolean(appId))
  const [isMenusLoading, setIsMenusLoading] = React.useState(Boolean(appId))
  const [recordFormName, setRecordFormName] = React.useState<string | null>(null)
  const [recordFormOpen, setRecordFormOpen] = React.useState(false)
  const effectiveMenuEditorOpen = menuEditorOpenProp ?? menuEditorOpen
  const setEffectiveMenuEditorOpen = onMenuEditorOpenChange ?? setMenuEditorOpen
  const handleMenuEditorOpenChange = (open: boolean) => {
    setEffectiveMenuEditorOpen(open)
    if (!open) setMenuEditorDraft(null)
  }
  const handleRecordFormOpenChange = (open: boolean) => {
    setRecordFormOpen(open)
    if (!open) {
      setRecordFormName(null)
    }
  }

  React.useEffect(() => {
    if (appId) {
      if (routeTopId) {
        if (routeTopId !== activeTopId) setActiveTopId(routeTopId)
      } else {
        const menuTopId = findTopMenuIdForMenu(appMenus, routeMenuId ?? undefined)
        if (menuTopId) {
          if (menuTopId !== activeTopId) setActiveTopId(menuTopId)
        } else if (appMenus.length > 0 && !appMenus.some((menu) => menu.id === activeTopId)) {
          setActiveTopId(appMenus[0].id)
        }
      }
      return
    }
    if (hideNavigation) return
    const nextTopId = getTopNavIdByPath(location.pathname, activeTopId)
    if (nextTopId !== activeTopId) setActiveTopId(nextTopId)
  }, [appId, routeTopId, appMenus, location.pathname, activeTopId, menuVersion, hideNavigation])

  React.useEffect(() => {
    applyAppPrimaryColor(app?.primaryColor)
    return () => {
      applyAppPrimaryColor()
    }
  }, [app?.primaryColor])

  React.useEffect(() => {
    if (appId && (isAppLoading || !app || (Boolean(routeMenuId) && isMenusLoading))) {
      document.title = '应用加载中…'
      return () => {
        document.title = 'Flexmodel Apps'
      }
    }
    if (appId && app) {
      const menu = routeMenuId ? findMenuById(appMenus, routeMenuId) : undefined
      document.title = menu ? `${menu.name} - ${app.name}` : app.name
      return () => {
        document.title = 'Flexmodel Apps'
      }
    }
    document.title = 'Flexmodel Apps'
    return () => {
      document.title = 'Flexmodel Apps'
    }
  }, [appId, routeMenuId, appMenus, app, isAppLoading, isMenusLoading])

  React.useEffect(() => {
    if (!appId) {
      setApp(null)
      setIsAppLoading(false)
      return
    }
    let cancelled = false
    setApp(null)
    setIsAppLoading(true)
    getAppById(appId)
      .then((loadedApp) => {
        if (cancelled) return
        setApp(loadedApp)
      })
      .catch(() => {
        if (cancelled) return
        setApp(null)
      })
      .finally(() => {
        if (!cancelled) setIsAppLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appId])

  React.useEffect(() => {
    setMenuEditorDraft(null)
  }, [appId])

  React.useEffect(() => {
    setRecordFormName(null)
    setRecordFormOpen(false)
  }, [appId])

  React.useEffect(() => {
    if (!appId) {
      setAppMenus([])
      setIsMenusLoading(false)
      return
    }
    let cancelled = false
    setAppMenus([])
    setIsMenusLoading(true)
    getAppMenus(appId)
      .then((loadedMenus) => !cancelled && setAppMenus(loadedMenus))
      .catch(() => !cancelled && setAppMenus([]))
      .finally(() => {
        if (!cancelled) setIsMenusLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appId, menuVersion])

  const topMenuItems = appId
    ? appMenus.map((menu) => toTopNavigationItem(menu, appId))
    : hideNavigation
      ? []
      : topNavs
  const routeMenuTopId = findTopMenuIdForMenu(appMenus, routeMenuId ?? undefined)
  const resolvedActiveTopId = appId ? routeTopId ?? routeMenuTopId ?? activeTopId : activeTopId
  const activeTop = appId
    ? topMenuItems.find((nav) => nav.id === resolvedActiveTopId) ?? (isMenusLoading ? undefined : topMenuItems[0])
    : topMenuItems.find((nav) => nav.id === activeTopId) ?? topMenuItems[0]
  const createRecordItems = React.useMemo(() => findFormMenuTargets(appMenus), [appMenus])
  const editMenus = (draft?: MenuEditorDraft) => {
    setMenuEditorDraft(draft ?? null)
    setEffectiveMenuEditorOpen(true)
  }
  const openRecordForm = (formName: string) => {
    setRecordFormName(formName)
    setRecordFormOpen(true)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideHeader && (
        <AppTopHeader
          activeTopId={activeTop?.id ?? ''}
          onTopNavChange={setActiveTopId}
          mobileNavs={hideNavigation ? [] : activeTop?.navs ?? []}
          app={app ?? undefined}
          topNavItems={topMenuItems}
          showSearch={!hideNavigation}
          showBack={showBack}
          isAppLoading={isAppLoading}
          isMenusLoading={isMenusLoading}
          createRecordItems={createRecordItems}
          onCreateRecord={openRecordForm}
        />
      )}

      {!hideHeader && !hideNavigation && (
        <AppLeftSidebar
          collapsed={collapsed}
          navs={activeTop?.navs ?? []}
          sectionKey={activeTop?.id ?? ''}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onEditMenus={editMenus}
        />
      )}

      <MenuEditorDialog
        open={effectiveMenuEditorOpen}
        onOpenChange={handleMenuEditorOpenChange}
        activeTopId={activeTop?.id ?? ''}
        onActiveTopIdChange={setActiveTopId}
        onMenusChange={(menus) => {
          if (menus) setAppMenus(menus)
          setMenuVersion((version) => version + 1)
        }}
        appId={appId}
        draft={menuEditorDraft}
      />

      <AppRecordCreateDialog
        open={recordFormOpen}
        onOpenChange={handleRecordFormOpenChange}
        appId={appId ?? ''}
        formName={recordFormName}
      />

      <main
        className={cn(
          hideHeader ? 'mt-0 h-screen md:ml-0' : 'mt-16 h-[calc(100vh-4rem)]',
          noOuterScroll ? 'overflow-hidden' : 'overflow-y-auto',
          noPadding ? '' : 'px-4 pb-4 md:px-6 md:pb-6',
          hideHeader ? '' : hideNavigation ? 'md:ml-0' : collapsed ? 'md:ml-16' : 'md:ml-64',
        )}
      >
        <div className={cn('w-full pt-4 md:pt-6', contentClassName)}>{children}</div>
      </main>
    </div>
  )
}

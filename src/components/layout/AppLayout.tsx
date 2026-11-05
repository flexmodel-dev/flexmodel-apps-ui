import * as React from 'react'
import {useLocation} from 'react-router-dom'
import {cn} from '@/lib/utils'
import {getTopNavIdByPath, topNavs} from '@/data/mock'
import {type App, getAppById} from '@/services/apps'
import {
  type AppNav,
  findFormNavDestinations,
  findNavById,
  findTopNavIdForNav,
  getAppNavigation,
  toTopNavigationItem
} from '@/services/appNavigation'
import {AppRecordCreateDialog} from '@/components/biz/AppRecordCreateDialog'
import {AppTopHeader} from './AppTopHeader'
import {AppLeftSidebar} from './AppLeftSidebar'
import {MenuEditorDialog, type MenuEditorDraft} from './MenuEditorDialog'
import {useAiAssistant} from '@/components/ai/AiProvider'

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
  const ai = useAiAssistant()
  const appId = location.pathname.match(/^\/apps\/([^/]+)/)?.[1]
  const routeTopId = appId ? new URLSearchParams(location.search).get('top') : null
  const routeNavId = appId ? location.pathname.match(/^\/apps\/[^/]+\/([^/]+)/)?.[1] : null
  const [collapsed, setCollapsed] = React.useState(false)
  const [activeTopId, setActiveTopId] = React.useState(() => appId ? routeTopId ?? '' : hideNavigation ? '' : getTopNavIdByPath(location.pathname))
  const [menuEditorOpen, setMenuEditorOpen] = React.useState(false)
  const [menuEditorDraft, setMenuEditorDraft] = React.useState<MenuEditorDraft | null>(null)
  const [navVersion, setNavVersion] = React.useState(0)
  const [app, setApp] = React.useState<App | null>(null)
  const [navs, setNavs] = React.useState<AppNav[]>([])
  const [isAppLoading, setIsAppLoading] = React.useState(Boolean(appId))
  const [isNavsLoading, setIsNavsLoading] = React.useState(Boolean(appId))
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
        const navTopId = findTopNavIdForNav(navs, routeNavId ?? undefined)
        if (navTopId) {
          if (navTopId !== activeTopId) setActiveTopId(navTopId)
        } else if (navs.length > 0 && !navs.some((nav) => nav.id === activeTopId)) {
          setActiveTopId(navs[0].id)
        }
      }
      return
    }
    if (hideNavigation) return
    const nextTopId = getTopNavIdByPath(location.pathname, activeTopId)
    if (nextTopId !== activeTopId) setActiveTopId(nextTopId)
  }, [appId, routeTopId, navs, location.pathname, activeTopId, navVersion, hideNavigation])

  React.useEffect(() => {
    if (appId && (isAppLoading || !app || (Boolean(routeNavId) && isNavsLoading))) {
      document.title = '应用加载中…'
      return () => {
        document.title = 'Flexmodel Apps'
      }
    }
    if (appId && app) {
      const nav = routeNavId ? findNavById(navs, routeNavId) : undefined
      document.title = nav ? `${nav.name} - ${app.name}` : app.name
      return () => {
        document.title = 'Flexmodel Apps'
      }
    }
    document.title = 'Flexmodel Apps'
    return () => {
      document.title = 'Flexmodel Apps'
    }
  }, [appId, routeNavId, navs, app, isAppLoading, isNavsLoading])

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
      setNavs([])
      setIsNavsLoading(false)
      return
    }
    let cancelled = false
    setNavs([])
    setIsNavsLoading(true)
    getAppNavigation(appId)
      .then((loadedNavs) => !cancelled && setNavs(loadedNavs))
      .catch(() => !cancelled && setNavs([]))
      .finally(() => {
        if (!cancelled) setIsNavsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appId, navVersion])

  const topNavItems = appId
    ? navs.map((nav) => toTopNavigationItem(nav, appId))
    : hideNavigation
      ? []
      : topNavs
  const routeNavTopId = findTopNavIdForNav(navs, routeNavId ?? undefined)
  const resolvedActiveTopId = appId ? routeTopId ?? routeNavTopId ?? activeTopId : activeTopId
  const activeTop = appId
    ? topNavItems.find((nav) => nav.id === resolvedActiveTopId) ?? (isNavsLoading ? undefined : topNavItems[0])
    : topNavItems.find((nav) => nav.id === activeTopId) ?? topNavItems[0]
  const createRecordItems = React.useMemo(() => findFormNavDestinations(navs), [navs])
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
          appId={appId}
          navs={navs}
          topNavItems={topNavItems}
          showSearch={!hideNavigation}
          showBack={showBack}
          isAppLoading={isAppLoading}
          isNavsLoading={isNavsLoading}
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
        onNavsChange={(nextNavs) => {
          if (nextNavs) setNavs(nextNavs)
          setNavVersion((version) => version + 1)
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
          !hideHeader && ai.panelOpen && 'lg:pr-[calc(var(--ai-panel-width)_+_1.5rem)]',
        )}
      >
        <div className={cn('w-full pt-4 md:pt-6', contentClassName)}>{children}</div>
      </main>
    </div>
  )
}

import * as React from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {cn, toErrorMessage} from '@/lib/utils'
import {getTopNavIdByPath, topNavs} from '@/data/mock'
import {type App, getAppById} from '@/services/apps'
import {
  type AppNav,
  deleteAppNav,
  findFormNavDestinations,
  findNavById,
  findTopNavIdForNav,
  getAppNavigation,
  navOrderInput,
  reorderAppNavigation,
  reorderNavChildren,
  toTopNavigationItem
} from '@/services/appNavigation'
import {AppRecordCreateDialog} from '@/components/biz/AppRecordCreateDialog'
import {message} from '@/components/ui/message'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {MenuAuthorizationDialog} from '@/components/biz/MenuAuthorizationDialog'
import {rememberAppLocation} from '@/lib/appLocationMemory'
import {AppTopHeader} from './AppTopHeader'
import {AppLeftSidebar} from './AppLeftSidebar'
import {NavEditorDialog, type NavEditorDraft} from './NavEditorDialog'
import type {OnNavMenuAction} from './NavMenuActions'
import {useAiAssistant} from '@/components/ai/AiProvider'

export function AppLayout({
  children,
  noPadding,
  contentClassName,
  noOuterScroll,
  hideHeader,
                            hideNavigation,
                            showBack,
}: {
  children: React.ReactNode
  noPadding?: boolean
  contentClassName?: string
  noOuterScroll?: boolean
  hideHeader?: boolean
  hideNavigation?: boolean
  showBack?: boolean
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const ai = useAiAssistant()
  const appId = location.pathname.match(/^\/apps\/([^/]+)/)?.[1]
  const routeTopId = appId ? new URLSearchParams(location.search).get('top') : null
  const routeNavId = appId ? location.pathname.match(/^\/apps\/[^/]+\/([^/]+)/)?.[1] : null
  const [collapsed, setCollapsed] = React.useState(false)
  const [activeTopId, setActiveTopId] = React.useState(() => appId ? routeTopId ?? '' : hideNavigation ? '' : getTopNavIdByPath(location.pathname))
  const [navDraft, setNavDraft] = React.useState<NavEditorDraft | null>(null)
  const [app, setApp] = React.useState<App | null>(null)
  const [navs, setNavs] = React.useState<AppNav[]>([])
  const [isAppLoading, setIsAppLoading] = React.useState(Boolean(appId))
  const [isNavsLoading, setIsNavsLoading] = React.useState(Boolean(appId))
  const [recordFormName, setRecordFormName] = React.useState<string | null>(null)
  const [recordFormOpen, setRecordFormOpen] = React.useState(false)
  const [authorization, setAuthorization] = React.useState<AppNav | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<AppNav | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
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
  }, [appId, routeTopId, navs, location.pathname, activeTopId, hideNavigation])

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
    if (!appId) return
    const match = location.pathname.match(/^\/apps\/[^/]+\/([^/]+)(?:\/view\/[^/]+)?\/?$/)
    if (match) rememberAppLocation(appId, `/apps/${appId}/${match[1]}`)
  }, [appId, location.pathname])

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
    setNavDraft(null)
    setAuthorization(null)
    setDeleteTarget(null)
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
  }, [appId])

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

  const persistNavOrder = React.useCallback((nextNavs: AppNav[]) => {
    if (!appId) return
    setNavs(nextNavs)
    reorderAppNavigation(appId, navOrderInput(nextNavs))
      .then((savedNavs) => setNavs(savedNavs))
      .catch(() => {
        message.error('保存菜单顺序失败，请稍后重试。')
        getAppNavigation(appId).then((reverted) => setNavs(reverted)).catch(() => undefined)
      })
  }, [appId])

  const handleTopNavsReorder = React.useCallback((orderedIds: string[]) => {
    if (orderedIds.length !== navs.length) return
    const navsById = new Map(navs.map((nav) => [nav.id, nav]))
    const nextNavs = orderedIds
      .map((id) => navsById.get(id))
      .filter((nav): nav is AppNav => Boolean(nav))
    if (nextNavs.length === navs.length) persistNavOrder(nextNavs)
  }, [navs, persistNavOrder])

  const handleMenusReorder = React.useCallback((parentId: string, orderedChildIds: string[]) => {
    if (!parentId) return
    persistNavOrder(reorderNavChildren(navs, parentId, orderedChildIds))
  }, [navs, persistNavOrder])
  const createNav = (draft: NavEditorDraft) => {
    setNavDraft({...draft, parentId: draft.topLevel ? undefined : draft.parentId ?? activeTop?.id})
  }
  const handleNavAction: OnNavMenuAction = (id, action) => {
    const nav = findNavById(navs, id)
    if (!nav) return
    if (action === 'authorize') setAuthorization(nav)
    else if (action === 'delete') {
      setDeleteError(null)
      setDeleteTarget(nav)
    } else if (action === 'create') {
      createNav({parentId: id})
    } else if (action === 'createAfter') {
      createNav({type: 'GROUP', topLevel: true, insertAfterId: id})
    } else {
      setNavDraft({nav})
    }
  }
  const refreshNavs = async () => {
    if (appId) setNavs(await getAppNavigation(appId))
  }
  const confirmDeleteNav = async () => {
    if (!appId || !deleteTarget || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAppNav(appId, deleteTarget.id)
      const nextNavs = await getAppNavigation(appId)
      setNavs(nextNavs)
      setDeleteTarget(null)
      const currentTopId = activeTop?.id
      if ((routeNavId && !findNavById(nextNavs, routeNavId))
        || (currentTopId && !nextNavs.some((nav) => nav.id === currentTopId))) {
        setActiveTopId(nextNavs[0]?.id ?? '')
        navigate(`/apps/${appId}`, {replace: true})
      }
    } catch (caught) {
      setDeleteError(toErrorMessage(caught, '删除菜单失败，请稍后重试。'))
    } finally {
      setDeleting(false)
    }
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
          onTopNavsReorder={appId ? handleTopNavsReorder : undefined}
          onNavAction={appId ? handleNavAction : undefined}
        />
      )}

      {!hideHeader && !hideNavigation && (
        <AppLeftSidebar
          collapsed={collapsed}
          navs={activeTop?.navs ?? []}
          sectionKey={activeTop?.id ?? ''}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onMenusReorder={appId ? handleMenusReorder : undefined}
          onNavAction={appId ? handleNavAction : undefined}
          onCreateNav={appId ? createNav : undefined}
        />
      )}

      {appId && navDraft && <NavEditorDialog appId={appId} draft={navDraft} onClose={() => setNavDraft(null)}
                                             onSaved={async (saved) => {
                                               await refreshNavs()
                                               if (!saved.parentId && !navDraft.nav) {
                                                 setActiveTopId(saved.id)
                                                 navigate(`/apps/${appId}?top=${encodeURIComponent(saved.id)}`)
                                               }
                                             }}/>}

      {appId && <MenuAuthorizationDialog appId={appId} nav={authorization} open={authorization !== null}
                                         onOpenChange={(open) => !open && setAuthorization(null)}
                                         onSaved={refreshNavs}/>}
      <BizDialog open={deleteTarget !== null} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
                 title="删除菜单" footer={<>
        <Button variant="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>取消</Button>
        <Button variant="danger" disabled={deleting}
                onClick={() => void confirmDeleteNav()}>{deleting ? '删除中…' : '删除'}</Button>
      </>}>
        {deleteError && <p role="alert" className="mb-3 text-destructive">{deleteError}</p>}
        确认删除「{deleteTarget?.name}」吗？{deleteTarget?.type === 'GROUP' && '分组内的菜单也会一并删除。'}
      </BizDialog>

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

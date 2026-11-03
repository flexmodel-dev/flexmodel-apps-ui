import * as React from 'react'
import {Link, useParams} from 'react-router-dom'
import {AppLayout} from '@/components/layout/AppLayout'
import {AppLoading} from '@/components/biz/AppLoading'
import ApprovalHome from '@/pages/ApprovalHome'
import ContactsHome from '@/pages/ContactsHome'
import WorkbenchHome from '@/pages/WorkbenchHome'
import FeedsHome from '@/pages/FeedsHome'
import FilesDocs from '@/pages/FilesDocs'
import Notifications from '@/pages/Notifications'
import RecordList from '@/pages/RecordList'
import {type AppNav, getAppNavigation} from '@/services/appNavigation'
import {toErrorMessage} from '@/lib/utils'

function findNav(navs: AppNav[], navId?: string): AppNav | undefined {
  for (const nav of navs) {
    if (nav.id === navId) return nav
    const child = findNav(nav.children ?? [], navId)
    if (child) return child
  }
  return undefined
}

function BuiltinPage({destinationId, workbenchId}: { destinationId: string; workbenchId?: string | null }) {
  switch (destinationId) {
    case 'workbench':
      return <WorkbenchHome workbenchId={workbenchId}/>
    case 'feeds':
      return <FeedsHome/>
    case 'files':
      return <FilesDocs/>
    case 'approval':
      return <ApprovalHome/>
    case 'contacts':
      return <ContactsHome/>
    case 'notifications':
      return <Notifications/>
    default:
      return (
        <AppLayout>
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">内置页面不存在。</div>
        </AppLayout>
      )
  }
}

export default function AppMenuPage() {
  const {appId, navId} = useParams<{ appId: string; navId: string }>()
  const [navs, setNavs] = React.useState<AppNav[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!appId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getAppNavigation(appId)
      .then((loadedNavs) => !cancelled && setNavs(loadedNavs))
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(toErrorMessage(caught, '加载应用菜单失败，请稍后重试。'))
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, navId])

  if (isLoading) {
    return <AppLayout><AppLoading center className="min-h-[400px]"/></AppLayout>
  }
  if (error) {
    return (
      <AppLayout>
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          {error}
          <Link className="ml-1 text-primary hover:underline" to={`/apps/${appId}`}>返回应用</Link>
        </div>
      </AppLayout>
    )
  }

  const nav = findNav(navs, navId)
  if (!nav || nav.type !== 'ENTRY') {
    return (
      <AppLayout>
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">菜单不存在或已被删除。</div>
      </AppLayout>
    )
  }

  if (nav.destination?.type === 'BUILTIN') {
    return <BuiltinPage destinationId={nav.destination.id} workbenchId={nav.destination.workbenchId}/>
  }
  if (nav.destination?.type === 'FORM') {
    return <RecordList formName={nav.destination.id}/>
  }
  if (nav.destination?.type === 'LINK') {
    return (
      <AppLayout noPadding noOuterScroll contentClassName="-mt-4 h-[calc(100vh-4rem)] w-full md:-mt-6">
        <iframe
          src={nav.destination.id}
          title={nav.name}
          className="h-full w-full border-0"
          referrerPolicy="no-referrer"
        />
      </AppLayout>
    )
  }
  return (
    <AppLayout>
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        该菜单暂未绑定页面。
        <Link className="ml-1 text-primary hover:underline"
              to={`/admin/apps/${appId}/settings/menus`}>去绑定</Link>
      </div>
    </AppLayout>
  )
}

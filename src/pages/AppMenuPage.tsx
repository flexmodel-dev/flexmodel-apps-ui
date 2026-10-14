import * as React from 'react'
import {Link, useParams} from 'react-router-dom'
import {AppLayout} from '@/components/layout/AppLayout'
import {AppLoading} from '@/components/biz/AppLoading'
import ApprovalHome from '@/pages/ApprovalHome'
import ContactsHome from '@/pages/ContactsHome'
import DashboardHome from '@/pages/DashboardHome'
import FeedsHome from '@/pages/FeedsHome'
import FilesDocs from '@/pages/FilesDocs'
import Notifications from '@/pages/Notifications'
import RecordList from '@/pages/RecordList'
import {getAppMenus, type AppMenu} from '@/services/appMenus'

function findMenu(menus: AppMenu[], menuId?: string): AppMenu | undefined {
  for (const menu of menus) {
    if (menu.id === menuId) return menu
    const child = findMenu(menu.children ?? [], menuId)
    if (child) return child
  }
  return undefined
}

function BuiltinPage({targetId}: { targetId: string }) {
  switch (targetId) {
    case 'dashboard':
      return <DashboardHome/>
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
  const {appId, menuId} = useParams<{ appId: string; menuId: string }>()
  const [menus, setMenus] = React.useState<AppMenu[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!appId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getAppMenus(appId)
      .then((loadedMenus) => !cancelled && setMenus(loadedMenus))
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : '加载应用菜单失败，请稍后重试。')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, menuId])

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

  const menu = findMenu(menus, menuId)
  if (!menu || menu.type !== 'ITEM') {
    return (
      <AppLayout>
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">菜单不存在或已被删除。</div>
      </AppLayout>
    )
  }

  if (menu.target?.type === 'BUILTIN') {
    return <BuiltinPage targetId={menu.target.id}/>
  }
  if (menu.target?.type === 'FORM') {
    return <RecordList formName={menu.target.id}/>
  }
  if (menu.target?.type === 'LINK') {
    return (
      <AppLayout noPadding noOuterScroll contentClassName="-mt-4 h-[calc(100vh-4rem)] w-full md:-mt-6">
        <iframe
          src={menu.target.id}
          title={menu.name}
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

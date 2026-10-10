import * as React from 'react'
import {Link, useParams} from 'react-router-dom'
import {AppLayout} from '@/components/layout/AppLayout'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppRecordDetail} from '@/components/biz/AppRecordDetail'
import {getAppMenus, type AppMenu} from '@/services/appMenus'

function findMenu(menus: AppMenu[], menuId?: string): AppMenu | undefined {
  for (const menu of menus) {
    if (menu.id === menuId) return menu
    const child = findMenu(menu.children ?? [], menuId)
    if (child) return child
  }
  return undefined
}

export default function AppRecordView() {
  const {appId, menuId, recordId = ''} = useParams<{ appId: string; menuId: string; recordId: string }>()
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
        setError(caught instanceof Error ? caught.message : '加载应用菜单失败')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId])

  if (isLoading) return <AppLayout><AppLoading center className="min-h-[400px]"/></AppLayout>
  if (!appId || !menuId) {
    return (
      <AppLayout>
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">页面参数缺失。</div>
      </AppLayout>
    )
  }
  if (error) {
    return (
      <AppLayout>
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          {error}
          <Link className="ml-1 text-primary hover:underline" to={`/apps/${appId}/${menuId}`}>返回列表</Link>
        </div>
      </AppLayout>
    )
  }

  const menu = findMenu(menus, menuId)
  if (menu?.target?.type !== 'FORM') {
    return (
      <AppLayout>
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">该菜单未绑定表单。</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl">
        <AppRecordDetail
          appId={appId}
          formName={menu.target.id}
          recordId={recordId}
        />
      </div>
    </AppLayout>
  )
}

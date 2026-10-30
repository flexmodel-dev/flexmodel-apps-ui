import * as React from 'react'
import {Link, useParams} from 'react-router-dom'
import {AppLayout} from '@/components/layout/AppLayout'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppRecordDetail} from '@/components/biz/AppRecordDetail'
import {type AppNav, findNavById, getAppNavigation} from '@/services/appNavigation'
import {toErrorMessage} from '@/lib/utils'

export default function AppRecordView() {
  const {appId, navId, recordId = ''} = useParams<{ appId: string; navId: string; recordId: string }>()
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
        setError(toErrorMessage(caught, '加载应用菜单失败'))
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId])

  if (isLoading) return <AppLayout><AppLoading center className="min-h-[400px]"/></AppLayout>
  if (!appId || !navId) {
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
          <Link className="ml-1 text-primary hover:underline" to={`/apps/${appId}/${navId}`}>返回列表</Link>
        </div>
      </AppLayout>
    )
  }

  const nav = findNavById(navs, navId)
  if (nav?.destination?.type !== 'FORM') {
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
          formName={nav.destination.id}
          recordId={recordId}
        />
      </div>
    </AppLayout>
  )
}

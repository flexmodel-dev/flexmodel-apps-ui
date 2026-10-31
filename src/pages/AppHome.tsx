import * as React from 'react'
import {useLocation, useNavigate, useParams} from 'react-router-dom'
import {AppLayout} from '@/components/layout/AppLayout'
import {Plus, RefreshCw} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Empty} from '@/components/ui/empty'
import {AppLoading} from '@/components/biz/AppLoading'
import {findFirstEntryRoute, findFirstEntryRouteInNav, getAppNavigation} from '@/services/appNavigation'
import {toErrorMessage} from '@/lib/utils'

export default function AppHome() {
  const {appId = ''} = useParams<{ appId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuEditorOpen, setMenuEditorOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    if (!appId) return
    let cancelled = false
    setError(null)
    const selectedTopId = new URLSearchParams(location.search).get('top')
    getAppNavigation(appId)
      .then((navs) => {
        if (cancelled) return
        const selectedTop = selectedTopId
          ? navs.find((nav) => nav.id === selectedTopId)
          : undefined
        const firstEntryRoute = selectedTopId
          ? (selectedTop ? findFirstEntryRouteInNav(selectedTop) : undefined)
          : findFirstEntryRoute(navs)
        if (firstEntryRoute) navigate(firstEntryRoute, {replace: true})
        else setIsLoading(false)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(toErrorMessage(caught, '加载应用导航失败，请稍后重试。'))
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appId, location.search, navigate, reloadKey])

  const retry = () => {
    setIsLoading(true)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  return (
    <AppLayout
      menuEditorOpen={menuEditorOpen}
      onMenuEditorOpenChange={setMenuEditorOpen}
    >
      {isLoading ? (
        <AppLoading center className="min-h-[60vh]"/>
      ) : error ? (
        <div className="flex min-h-[60vh] w-full items-center justify-center">
          <div role="alert"
               className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 text-center">
            <p className="text-base text-muted-foreground">{error}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 h-10 w-full justify-center rounded-xl"
              onClick={retry}
            >
              <RefreshCw className="h-4 w-4"/> 重试
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[60vh] w-full items-center justify-center">
          <Empty
            className="w-full max-w-md rounded-2xl border-border/70"
            description={<span className="text-base">当前分组没有关联菜单</span>}
          >
            <Button
              type="button"
              className="h-10 w-full justify-center rounded-xl"
              onClick={() => setMenuEditorOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4"/> 新增菜单
            </Button>
          </Empty>
        </div>
      )}
    </AppLayout>
  )
}

import * as React from 'react'
import {useLocation, useNavigate, useParams} from 'react-router-dom'
import {AppLayout} from '@/components/layout/AppLayout'
import {Plus} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Empty} from '@/components/ui/empty'
import {AppLoading} from '@/components/biz/AppLoading'
import {findFirstEntryRoute, findFirstEntryRouteInNav} from '@/services/appNavigation'
import {getAppNavigation} from '@/services/appNavigation'

export default function AppHome() {
  const {appId = ''} = useParams<{ appId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuEditorOpen, setMenuEditorOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (!appId) return
    let cancelled = false
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
      .catch(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, location.search, navigate])

  return (
    <AppLayout
      menuEditorOpen={menuEditorOpen}
      onMenuEditorOpenChange={setMenuEditorOpen}
    >
      {isLoading ? (
        <AppLoading center className="min-h-[60vh]"/>
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

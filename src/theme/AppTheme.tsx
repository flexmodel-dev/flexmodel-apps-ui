import * as React from 'react'
import {useLocation} from 'react-router-dom'
import {AppLoading} from '@/components/biz/AppLoading'
import {type App, getAppById} from '@/services/apps'
import {getAuthSession} from '@/services/auth'
import {useAppFavicon} from '@/lib/appFavicon'
import {applyAppPrimaryColor, getCachedAppPrimaryColor} from './appPrimaryColors'

/** 路由统一管理全局主色与标签页图标，避免布局挂载、卸载或异步加载时回落到默认值。 */
export function AppTheme({children}: {children: React.ReactNode}) {
  const {pathname} = useLocation()
  const appId = getAuthSession() ? pathname.match(/^\/apps\/([^/]+)/)?.[1] : undefined
  const [resolvedAppId, setResolvedAppId] = React.useState<string>()
  const [app, setApp] = React.useState<App | null>(null)
  const color = appId ? getCachedAppPrimaryColor(appId) : undefined
  const pending = Boolean(appId && !color && resolvedAppId !== appId)

  React.useLayoutEffect(() => {
    applyAppPrimaryColor(color)
  }, [appId, color])

  React.useEffect(() => {
    if (!appId) {
      setApp(null)
      return
    }
    let cancelled = false
    setApp(null)
    getAppById(appId)
      .then((loadedApp) => {
        if (cancelled) return
        setApp(loadedApp)
        setResolvedAppId(appId)
      })
      .catch(() => {
        // 失败后交还页面展示错误，避免首次无缓存时一直停在加载状态。
        if (!cancelled) setResolvedAppId(appId)
      })
    return () => { cancelled = true }
  }, [appId])

  useAppFavicon(app)

  if (pending) {
    return <AppLoading center label="应用加载中" className="h-screen bg-background text-foreground"/>
  }
  return children
}

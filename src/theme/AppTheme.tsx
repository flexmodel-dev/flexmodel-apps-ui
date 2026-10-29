import * as React from 'react'
import {useLocation} from 'react-router-dom'
import {AppLoading} from '@/components/biz/AppLoading'
import {getAppById} from '@/services/apps'
import {getAuthSession} from '@/services/auth'
import {applyAppPrimaryColor, getCachedAppPrimaryColor} from './appPrimaryColors'

/** 路由统一管理全局主色，避免布局挂载、卸载或异步加载时回落到默认色。 */
export function AppTheme({children}: {children: React.ReactNode}) {
  const {pathname} = useLocation()
  const appId = getAuthSession() ? pathname.match(/^\/apps\/([^/]+)/)?.[1] : undefined
  const [resolvedAppId, setResolvedAppId] = React.useState<string>()
  const color = appId ? getCachedAppPrimaryColor(appId) : undefined
  const pending = Boolean(appId && !color && resolvedAppId !== appId)

  React.useLayoutEffect(() => {
    applyAppPrimaryColor(color)
  }, [appId, color])

  React.useEffect(() => {
    if (!appId) return
    let cancelled = false
    getAppById(appId)
      .then(() => {
        if (!cancelled) setResolvedAppId(appId)
      })
      .catch(() => {
        // 失败后交还页面展示错误，避免首次无缓存时一直停在加载状态。
        if (!cancelled) setResolvedAppId(appId)
      })
    return () => { cancelled = true }
  }, [appId])

  if (pending) {
    return <div role="status" aria-label="应用加载中" className="h-screen bg-background text-foreground">
      <AppLoading center className="h-full"/>
    </div>
  }
  return children
}

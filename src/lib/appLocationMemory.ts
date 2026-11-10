const APP_LOCATION_STORAGE_PREFIX = 'flexmodel-apps.last-location.'

export function rememberAppLocation(appId: string, path: string): void {
  if (!appId || !path) return
  try {
    window.localStorage.setItem(APP_LOCATION_STORAGE_PREFIX + appId, path)
  } catch {
    // 本地存储不可用时位置记忆自然失效。
  }
}

export function recallAppLocation(appId: string): string | null {
  if (!appId) return null
  try {
    return window.localStorage.getItem(APP_LOCATION_STORAGE_PREFIX + appId)
  } catch {
    return null
  }
}

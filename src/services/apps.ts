import {requestJson} from '@/services/http'
import {cachedFetch, createAppDataCache} from '@/services/appDataCache'
import {
  type AppPrimaryColor,
  cacheAppPrimaryColor,
  getAppPrimaryColor,
  removeCachedAppPrimaryColor,
} from '@/theme/appPrimaryColors'
import {type AppIconName, resolveAppIconName} from '@/data/appIcons'

export interface App {
  id: string
  projectId: string
  name: string
  description: string
  iconName: AppIconName
  primaryColor: AppPrimaryColor
  enabled: boolean
  owner: string
  createdAt: string
  updatedAt: string
}

export interface AppInput {
  name: string
  description: string
  iconName: AppIconName
  primaryColor: AppPrimaryColor
}

interface AppPayload {
  id?: string
  projectId?: string
  name?: string
  description?: string
  iconName?: string
  primaryColor?: AppPrimaryColor
  enabled?: boolean
  owner?: string
  createdAt?: string
  updatedAt?: string
  message?: string
}

const API_BASE = '/api/apps'

const appsCache = createAppDataCache<App[]>()
const appCache = createAppDataCache<App>()

function formatDateTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const pad = (part: number) => String(part).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function normalizeApp(payload: AppPayload): App {
  const app: App = {
    id: payload.id ?? payload.projectId ?? '',
    projectId: payload.projectId ?? payload.id ?? '',
    name: payload.name ?? '',
    description: payload.description ?? '',
    iconName: resolveAppIconName(payload.iconName),
    primaryColor: getAppPrimaryColor(payload.primaryColor).value,
    enabled: payload.enabled ?? true,
    owner: payload.owner ?? 'admin',
    createdAt: formatDateTime(payload.createdAt),
    updatedAt: formatDateTime(payload.updatedAt),
  }
  cacheAppPrimaryColor(app.id, app.primaryColor)
  return app
}

export function getApps(): Promise<App[]> {
  return cachedFetch(appsCache, '', () =>
    requestJson<AppPayload[]>(API_BASE).then((apps) => apps.map(normalizeApp)))
}

/** 应用包导入等绕过常规接口的变更后，失效列表与详情缓存以重新拉取。 */
export function invalidateAppCaches() {
  appsCache.clear()
  appCache.clear()
}

export function getAppById(appId: string): Promise<App> {
  return cachedFetch(appCache, appId, () =>
    requestJson<AppPayload>(`${API_BASE}/${appId}`).then(normalizeApp))
}

function cacheApp(app: App) {
  appCache.set(app.id, Promise.resolve(app))
  const cachedAppsRequest = appsCache.get('')
  if (cachedAppsRequest) {
    appsCache.set('', cachedAppsRequest.then((cachedApps) =>
      cachedApps.map((cachedApp) => (cachedApp.id === app.id ? app : cachedApp)),
    ))
  }
}

export async function createApp(input: AppInput): Promise<App> {
  const app = await requestJson<AppPayload>(API_BASE, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const normalizedApp = normalizeApp(app)
  const cachedAppsRequest = appsCache.get('')
  if (cachedAppsRequest) {
    appsCache.set('', cachedAppsRequest.then((cachedApps) => [...cachedApps, normalizedApp]))
  }
  appCache.set(normalizedApp.id, Promise.resolve(normalizedApp))
  return normalizedApp
}

export async function updateApp(appId: string, input: AppInput): Promise<App> {
  const app = await requestJson<AppPayload>(`${API_BASE}/${appId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  const normalizedApp = normalizeApp(app)
  cacheApp(normalizedApp)
  return normalizedApp
}

export async function deleteApp(appId: string): Promise<void> {
  await requestJson<null>(`${API_BASE}/${appId}`, {method: 'DELETE'})
  appCache.delete(appId)
  removeCachedAppPrimaryColor(appId)
  const cachedAppsRequest = appsCache.get('')
  if (cachedAppsRequest) {
    appsCache.set('', cachedAppsRequest.then((cachedApps) => cachedApps.filter((app) => app.id !== appId)))
  }
}

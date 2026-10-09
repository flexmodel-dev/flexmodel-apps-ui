import {requestJson} from '@/services/http'
import {createAppDataCache} from '@/services/appDataCache'

export type AppIconName =
  | 'ShoppingCart'
  | 'Banknote'
  | 'Boxes'
  | 'Folder'
  | 'Tags'
  | 'TrendingUp'

export type AppPrimaryColor = 'indigo' | 'blue' | 'green' | 'amber' | 'rose' | 'black'

export interface App {
  id: string
  projectId: string
  name: string
  description: string
  iconName: AppIconName
  primaryColor: AppPrimaryColor
  enabled: boolean
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
  iconName?: AppIconName
  primaryColor?: AppPrimaryColor
  enabled?: boolean
  createdAt?: string
  updatedAt?: string
  message?: string
}

const API_BASE = '/api/apps'

const appsCache = createAppDataCache<App[]>()
const appCache = createAppDataCache<App>()

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(path, init)
}

function normalizeApp(payload: AppPayload): App {
  return {
    id: payload.id ?? payload.projectId ?? '',
    projectId: payload.projectId ?? payload.id ?? '',
    name: payload.name ?? '',
    description: payload.description ?? '',
    iconName: (payload.iconName ?? 'Boxes') as AppIconName,
    primaryColor: (payload.primaryColor ?? 'indigo') as AppPrimaryColor,
    enabled: payload.enabled ?? true,
    createdAt: payload.createdAt ?? '',
    updatedAt: payload.updatedAt ?? '',
  }
}

export async function getApps(): Promise<App[]> {
  let appsRequest = appsCache.get('')
  if (!appsRequest) {
    appsRequest = request<AppPayload[]>(API_BASE)
      .then((apps) => apps.map(normalizeApp))
      .catch((caught: unknown) => {
        appsCache.delete('')
        throw caught
      })
    appsCache.set('', appsRequest)
  }
  return appsRequest
}

export async function getAppById(appId: string): Promise<App> {
  let appRequest = appCache.get(appId)
  if (!appRequest) {
    appRequest = request<AppPayload>(`${API_BASE}/${appId}`)
      .then(normalizeApp)
      .catch((caught: unknown) => {
        appCache.delete(appId)
        throw caught
      })
    appCache.set(appId, appRequest)
  }
  return appRequest
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
  const app = await request<AppPayload>(API_BASE, {
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
  const app = await request<AppPayload>(`${API_BASE}/${appId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  const normalizedApp = normalizeApp(app)
  cacheApp(normalizedApp)
  return normalizedApp
}

export async function deleteApp(appId: string): Promise<void> {
  await request<null>(`${API_BASE}/${appId}`, {method: 'DELETE'})
  appCache.delete(appId)
  const cachedAppsRequest = appsCache.get('')
  if (cachedAppsRequest) {
    appsCache.set('', cachedAppsRequest.then((cachedApps) => cachedApps.filter((app) => app.id !== appId)))
  }
}

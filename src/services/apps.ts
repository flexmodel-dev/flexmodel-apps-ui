import {getAuthToken} from '@/services/auth'

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
    },
  })
  const payload = await response.json().catch(() => null) as AppPayload | null
  if (!response.ok) {
    throw new Error(payload?.message ?? `请求失败（${response.status}）`)
  }
  return payload as T
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
  const apps = await request<AppPayload[]>(API_BASE)
  return apps.map(normalizeApp)
}

export async function getAppById(appId: string): Promise<App> {
  const app = await request<AppPayload>(`${API_BASE}/${appId}`)
  return normalizeApp(app)
}

export async function createApp(input: AppInput): Promise<App> {
  const app = await request<AppPayload>(API_BASE, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return normalizeApp(app)
}

export async function updateApp(appId: string, input: AppInput): Promise<App> {
  const app = await request<AppPayload>(`${API_BASE}/${appId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return normalizeApp(app)
}

export async function deleteApp(appId: string): Promise<void> {
  await request<null>(`${API_BASE}/${appId}`, {method: 'DELETE'})
}

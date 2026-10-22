import {requestJson} from '@/services/http'
import {cachedFetch, createAppDataCache} from '@/services/appDataCache'

export type AppMenuType = 'GROUP' | 'ITEM'
export type AppMenuTargetType = 'BUILTIN' | 'FORM' | 'LINK'

export interface AppMenuTarget {
  type: AppMenuTargetType
  id: string
  label?: string
}

export interface AppMenu {
  id: string
  type: AppMenuType
  name: string
  iconName?: string | null
  parentId?: string | null
  target?: AppMenuTarget | null
  pageRoute?: string | null
  children: AppMenu[]
}

export interface AppMenuInput {
  type: AppMenuType
  name: string
  iconName?: string | null
  parentId?: string | null
  target?: { type: AppMenuTargetType; id: string } | null
}

export interface AppMenuTargets {
  builtIn: Array<{ type: AppMenuTargetType; id: string; label: string }>
  forms: Array<{ type: AppMenuTargetType; id: string; label: string }>
}

export interface AppMenuOrderInput {
  root: string[]
  children: Record<string, string[]>
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

const API_BASE = '/api/apps'

const menuCache = createAppDataCache<AppMenu[]>()
const menuTargetCache = createAppDataCache<AppMenuTargets>()

export function invalidateAppMenus(appId: string) {
  menuCache.delete(appId)
}

export function invalidateAppMenuTargets(appId: string) {
  menuTargetCache.delete(appId)
}

function normalizeMenus(menus: AppMenu[]): AppMenu[] {
  return menus.map((menu) => ({
    ...menu,
    children: Array.isArray(menu.children) ? normalizeMenus(menu.children) : [],
  }))
}

export function getAppMenus(appId: string): Promise<AppMenu[]> {
  return cachedFetch(menuCache, appId, () =>
    requestJson<AppMenu[]>(`${API_BASE}/${appId}/menus`).then(normalizeMenus))
}

export function getAppMenuTargets(appId: string): Promise<AppMenuTargets> {
  return cachedFetch(menuTargetCache, appId, () =>
    requestJson<AppMenuTargets>(`${API_BASE}/${appId}/menus/targets`))
}

export async function createAppMenu(appId: string, input: AppMenuInput): Promise<AppMenu> {
  const menu = await requestJson<AppMenu>(`${API_BASE}/${appId}/menus`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  menuCache.delete(appId)
  return {...menu, children: menu.children ?? []}
}

export async function updateAppMenu(
  appId: string,
  menuId: string,
  input: AppMenuInput,
): Promise<AppMenu> {
  const menu = await requestJson<AppMenu>(`${API_BASE}/${appId}/menus/${menuId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  menuCache.delete(appId)
  return {...menu, children: menu.children ?? []}
}

export async function deleteAppMenu(appId: string, menuId: string): Promise<void> {
  await requestJson<null>(`${API_BASE}/${appId}/menus/${menuId}`, {method: 'DELETE'})
  menuCache.delete(appId)
}

export async function reorderAppMenus(
  appId: string,
  input: AppMenuOrderInput,
): Promise<AppMenu[]> {
  const menus = await requestJson<AppMenu[]>(`${API_BASE}/${appId}/menus/order`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  const normalizedMenus = normalizeMenus(menus)
  menuCache.set(appId, Promise.resolve(normalizedMenus))
  return normalizedMenus
}

import {requestJson} from '@/services/http'

export type AppMenuType = 'GROUP' | 'MENU'
export type AppMenuTargetType = 'BUILT_IN' | 'ENTITY'

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
  entities: Array<{ type: AppMenuTargetType; id: string; label: string }>
}

export interface AppMenuOrderInput {
  root: string[]
  children: Record<string, string[]>
}

const API_BASE = '/api/apps'

function normalizeMenus(menus: AppMenu[]): AppMenu[] {
  return menus.map((menu) => ({
    ...menu,
    children: Array.isArray(menu.children) ? normalizeMenus(menu.children) : [],
  }))
}

export async function getAppMenus(appId: string): Promise<AppMenu[]> {
  const menus = await requestJson<AppMenu[]>(`${API_BASE}/${appId}/menus`)
  return normalizeMenus(menus)
}

export async function getAppMenuTargets(appId: string): Promise<AppMenuTargets> {
  return requestJson<AppMenuTargets>(`${API_BASE}/${appId}/menus/targets`)
}

export async function createAppMenu(appId: string, input: AppMenuInput): Promise<AppMenu> {
  const menu = await requestJson<AppMenu>(`${API_BASE}/${appId}/menus`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
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
  return {...menu, children: menu.children ?? []}
}

export async function deleteAppMenu(appId: string, menuId: string): Promise<void> {
  await requestJson<null>(`${API_BASE}/${appId}/menus/${menuId}`, {method: 'DELETE'})
}

export async function reorderAppMenus(
  appId: string,
  input: AppMenuOrderInput,
): Promise<AppMenu[]> {
  const menus = await requestJson<AppMenu[]>(`${API_BASE}/${appId}/menus/order`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return normalizeMenus(menus)
}

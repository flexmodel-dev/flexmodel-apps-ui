import {requestJson} from '@/services/http'
import {cachedFetch, createAppDataCache} from '@/services/appDataCache'
import type {DirectorySelection} from '@/types/directory'
import {resolveAppIcon} from '@/data/appIcons'
import type {NavItem, TopNavItem} from '@/data/mock'
import {findInTree, flattenTree} from '@/lib/utils'

export type AppNavType = 'GROUP' | 'ENTRY'
export type NavDestinationType = 'BUILTIN' | 'FORM' | 'LINK'

export interface NavDestination {
  type: NavDestinationType
  id: string
  label?: string
  workbenchId?: string | null
  robotId?: string | null
}

export interface AppNav {
  id: string
  type: AppNavType
  name: string
  iconName?: string | null
  parentId?: string | null
  destination?: NavDestination | null
  pageRoute?: string | null
  children: AppNav[]
  visibility?: DirectorySelection[]
  ownerId?: string
}

export interface AppNavInput {
  visibility?: DirectorySelection[]
  type: AppNavType
  name: string
  iconName?: string | null
  parentId?: string | null
  destination?: {
    type: NavDestinationType
    id: string
    workbenchId?: string | null
    robotId?: string | null
  } | null
}

export interface AppNavDestinations {
  builtIn: Array<{ type: NavDestinationType; id: string; label: string }>
  forms: Array<{ type: NavDestinationType; id: string; label: string }>
}

export interface AppNavOrderInput {
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

const navCache = createAppDataCache<AppNav[]>(appId => ({appId, resources: ['navigation']}))
const destinationCache = createAppDataCache<AppNavDestinations>(appId => ({
  appId, resources: ['navigation', 'form', 'workbench'],
}))

export function invalidateAppNavigation(appId: string) {
  navCache.delete(appId)
}

export function invalidateAppNavDestinations(appId: string) {
  destinationCache.delete(appId)
}

function normalizeNavs(navs: AppNav[]): AppNav[] {
  return navs.map((nav) => ({
    ...nav,
    children: Array.isArray(nav.children) ? normalizeNavs(nav.children) : [],
  }))
}

export function getAppNavigation(appId: string): Promise<AppNav[]> {
  return cachedFetch(navCache, appId, () =>
    requestJson<AppNav[]>(`${API_BASE}/${appId}/navigation`).then(normalizeNavs))
}

export function getAppNavDestinations(appId: string): Promise<AppNavDestinations> {
  return cachedFetch(destinationCache, appId, () =>
    requestJson<AppNavDestinations>(`${API_BASE}/${appId}/navigation/destinations`))
}

export async function createAppNav(appId: string, input: AppNavInput): Promise<AppNav> {
  const nav = await requestJson<AppNav>(`${API_BASE}/${appId}/navigation`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  navCache.delete(appId)
  return {...nav, children: nav.children ?? []}
}

export async function updateAppNav(
  appId: string,
  navId: string,
  input: Partial<AppNavInput>,
  method: 'PUT' | 'PATCH' = 'PUT',
): Promise<AppNav> {
  const nav = await requestJson<AppNav>(`${API_BASE}/${appId}/navigation/${navId}`, {
    method,
    body: JSON.stringify(input),
  })
  navCache.delete(appId)
  return {...nav, children: nav.children ?? []}
}

export async function deleteAppNav(appId: string, navId: string): Promise<void> {
  await requestJson<null>(`${API_BASE}/${appId}/navigation/${navId}`, {method: 'DELETE'})
  navCache.delete(appId)
}

export async function reorderAppNavigation(
  appId: string,
  input: AppNavOrderInput,
): Promise<AppNav[]> {
  const navs = await requestJson<AppNav[]>(`${API_BASE}/${appId}/navigation/order`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  const normalizedNavs = normalizeNavs(navs)
  navCache.set(appId, Promise.resolve(normalizedNavs))
  return normalizedNavs
}

// ---- 导航树辅助 ----

export function navIcon(iconName?: string | null) {
  return iconName && iconName !== 'none' ? resolveAppIcon(iconName) : undefined
}

function findFirstPageRoute(nav: AppNav): string | undefined {
  if (nav.type === 'ENTRY') return nav.pageRoute ?? undefined
  for (const child of nav.children) {
    const pageRoute = findFirstPageRoute(child)
    if (pageRoute) return pageRoute
  }
  return undefined
}

export function findFirstEntryRoute(navs: AppNav[]): string | undefined {
  for (const nav of navs) {
    const pageRoute = findFirstPageRoute(nav)
    if (pageRoute) return pageRoute
  }
  return undefined
}

export function findFirstEntryRouteInNav(nav: AppNav): string | undefined {
  return findFirstPageRoute(nav)
}

function containsNav(nav: AppNav, navId: string): boolean {
  return nav.id === navId || nav.children.some((child) => containsNav(child, navId))
}

export function findNavById(navs: AppNav[], navId: string): AppNav | undefined {
  return findInTree(navs, navId)
}

export function findTopNavIdForNav(navs: AppNav[], navId?: string): string | undefined {
  if (!navId) return undefined
  return navs.find((nav) => containsNav(nav, navId))?.id
}

export function findFormNavDestinations(navs: AppNav[]): Array<{ id: string; label: string }> {
  const destinations = new Map<string, string>()
  const collect = (nav: AppNav) => {
    if (nav.destination?.type === 'FORM') {
      destinations.set(nav.destination.id, nav.destination.label ?? nav.destination.id)
    }
    nav.children.forEach(collect)
  }
  navs.forEach(collect)
  return [...destinations].map(([id, label]) => ({id, label}))
}

export function toNavigationItem(nav: AppNav, appId: string): NavItem {
  return {
    id: nav.id,
    icon: navIcon(nav.iconName),
    text: nav.name,
    to: nav.type === 'ENTRY' ? (nav.pageRoute ?? `/apps/${appId}/${nav.id}`) : undefined,
    sub: nav.type === 'GROUP' ? nav.children.map((child) => toNavigationItem(child, appId)) : undefined,
  }
}

export function toTopNavigationItem(nav: AppNav, appId: string): TopNavItem {
  return {
    id: nav.id,
    text: nav.name,
    to: findFirstPageRoute(nav) ?? `/apps/${appId}?top=${encodeURIComponent(nav.id)}`,
    navs: nav.children.map((child) => toNavigationItem(child, appId)),
  }
}

function collectChildrenOrder(navs: AppNav[], order: Record<string, string[]>) {
  navs.forEach((nav) => {
    if (nav.type === 'GROUP') {
      order[nav.id] = nav.children.map((child) => child.id)
      collectChildrenOrder(nav.children, order)
    }
  })
}

export function navOrderInput(navs: AppNav[]): AppNavOrderInput {
  const children: Record<string, string[]> = {}
  collectChildrenOrder(navs, children)
  return {root: navs.map((nav) => nav.id), children}
}

export function moveNavNode(
  navs: AppNav[],
  navId: string,
  targetParentId: string,
  targetIndex: number,
): AppNav[] {
  const movedNav = flattenTree(navs).find((nav) => nav.id === navId)
  if (!movedNav) return navs

  const remainingNavs = removeNavNode(navs, navId)
  return insertNavNode(remainingNavs, movedNav, targetParentId, targetIndex)
}

function removeNavNode(navs: AppNav[], navId: string): AppNav[] {
  return navs
    .filter((nav) => nav.id !== navId)
    .map((nav) => ({...nav, children: removeNavNode(nav.children, navId)}))
}

function insertNavNode(
  navs: AppNav[],
  movedNav: AppNav,
  targetParentId: string,
  targetIndex: number,
): AppNav[] {
  return navs.map((nav) => {
    if (nav.id === targetParentId) {
      const index = Math.max(0, Math.min(targetIndex, nav.children.length))
      return {
        ...nav,
        children: [
          ...nav.children.slice(0, index),
          {...movedNav, parentId: targetParentId},
          ...nav.children.slice(index),
        ],
      }
    }
    return {...nav, children: insertNavNode(nav.children, movedNav, targetParentId, targetIndex)}
  })
}

export function reorderNavChildren(
  navs: AppNav[],
  parentId: string,
  orderedChildIds: string[],
): AppNav[] {
  return navs.map((nav) => {
    if (nav.id === parentId) {
      const childrenById = new Map(nav.children.map((child) => [child.id, child]))
      return {
        ...nav,
        children: orderedChildIds
          .map((id) => childrenById.get(id))
          .filter((child): child is AppNav => Boolean(child)),
      }
    }
    if (nav.children.length === 0) return nav
    return {...nav, children: reorderNavChildren(nav.children, parentId, orderedChildIds)}
  })
}

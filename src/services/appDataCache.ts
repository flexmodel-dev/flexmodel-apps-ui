export type AppDataResource = 'app' | 'form' | 'navigation' | 'workbench' | 'record' | 'approval'

export interface AppDataChange {
  appId: string
  resource: AppDataResource
  formName?: string
  entityId?: string
}

export interface AppDataScope {
  appId?: string
  resources: readonly AppDataResource[]
  formName?: string
}

export interface AppDataCache<T> {
  get(key: string): Promise<T> | undefined

  set(key: string, value: Promise<T>): void

  delete(key: string): void

  clear(): void

  invalidate(change: AppDataChange): void

  version(key: string): number
}

const caches = new Set<AppDataCache<unknown>>()
const listeners = new Set<() => void>()
const revisions = new Map<string, { change: AppDataChange; revision: number }>()
const pending = new Map<string, AppDataChange>()
let revision = 0
let timer: ReturnType<typeof setTimeout> | undefined

function matches(scope: AppDataScope, change: AppDataChange) {
  return (!scope.appId || scope.appId === change.appId)
    && scope.resources.includes(change.resource)
    && (!scope.formName || !change.formName || scope.formName === change.formName)
}

function changeKey(change: AppDataChange) {
  return JSON.stringify([change.appId, change.resource, change.formName ?? ''])
}

export function subscribeAppData(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getAppDataRevision(scope: AppDataScope): number {
  let latest = 0
  revisions.forEach(item => {
    if (matches(scope, item.change)) latest = Math.max(latest, item.revision)
  })
  return latest
}

/** 先失效缓存，最多每 350ms 通知一次；路由切换期间也不会读到旧缓存。 */
export function notifyAppDataChange(change: AppDataChange) {
  caches.forEach(cache => cache.invalidate(change))
  pending.set(changeKey(change), change)
  timer ??= setTimeout(flushAppDataChanges, 350)
}

export function flushAppDataChanges() {
  clearTimeout(timer)
  timer = undefined
  if (!pending.size) return
  const next = ++revision
  pending.forEach((change, key) => revisions.set(key, {change, revision: next}))
  pending.clear()
  listeners.forEach(listener => listener())
}

export function createAppDataCache<T>(scope?: (key: string) => AppDataScope): AppDataCache<T> {
  const requests = new Map<string, Promise<T>>()
  const versions = new Map<string, number>()
  let sequence = 0
  let epoch = 0
  const invalidate = (key: string) => {
    requests.delete(key)
    versions.set(key, ++sequence)
  }
  const cache: AppDataCache<T> = {
    get: (key) => requests.get(key),
    set: (key, value) => requests.set(key, value),
    delete: invalidate,
    clear: () => {
      requests.clear()
      versions.clear()
      epoch = ++sequence
    },
    version: key => versions.get(key) ?? epoch,
    invalidate: change => {
      if (scope) requests.forEach((_, key) => {
        if (matches(scope(key), change)) invalidate(key)
      })
    },
  }
  caches.add(cache as AppDataCache<unknown>)
  return cache
}

export function clearAppDataCache() {
  caches.forEach((cache) => cache.clear())
  clearTimeout(timer)
  timer = undefined
  pending.clear()
  revisions.clear()
}

/** 读缓存；未命中时发起请求并写入缓存，失败时清除缓存以便重试 */
export function cachedFetch<T>(cache: AppDataCache<T>, key: string, load: () => Promise<T>): Promise<T> {
  let request = cache.get(key)
  if (!request) {
    const version = cache.version(key)
    const current: Promise<T> = load().then(value => {
      // 按失效版本判断，不能按 Promise 身份判断：本地 CRUD 可能用旧 Promise 派生新缓存。
      return cache.version(key) === version ? value : cachedFetch(cache, key, load)
    }, (caught: unknown) => {
      if (cache.version(key) !== version) return cachedFetch(cache, key, load)
      if (cache.get(key) === current) cache.delete(key)
      throw caught
    })
    request = current
    cache.set(key, request)
  }
  return request
}

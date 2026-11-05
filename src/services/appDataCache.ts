export interface AppDataCache<T> {
  get(key: string): Promise<T> | undefined

  set(key: string, value: Promise<T>): void

  delete(key: string): void

  clear(): void
}

const caches = new Set<AppDataCache<unknown>>()

export function createAppDataCache<T>(): AppDataCache<T> {
  const requests = new Map<string, Promise<T>>()
  const cache: AppDataCache<T> = {
    get: (key) => requests.get(key),
    set: (key, value) => requests.set(key, value),
    delete: (key) => requests.delete(key),
    clear: () => requests.clear(),
  }
  caches.add(cache as AppDataCache<unknown>)
  return cache
}

export function clearAppDataCache() {
  caches.forEach((cache) => cache.clear())
}

/** 读缓存；未命中时发起请求并写入缓存，失败时清除缓存以便重试 */
export function cachedFetch<T>(cache: AppDataCache<T>, key: string, load: () => Promise<T>): Promise<T> {
  let request = cache.get(key)
  if (!request) {
    request = load().catch((caught: unknown) => {
      cache.delete(key)
      throw caught
    })
    cache.set(key, request)
  }
  return request
}

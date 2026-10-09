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

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {
  cachedFetch, clearAppDataCache, createAppDataCache, flushAppDataChanges,
  getAppDataRevision, notifyAppDataChange, subscribeAppData,
} from './appDataCache'

beforeEach(() => {
  clearAppDataCache();
  vi.useFakeTimers()
})
afterEach(() => {
  clearAppDataCache();
  vi.useRealTimers()
})

describe('应用变更缓存', () => {
  it('按应用和表单失效缓存，连续变更合并通知，其他应用保持缓存', () => {
    const cache = createAppDataCache<string>(key => {
      const [appId, formName] = key.split(':')
      return {appId, formName, resources: ['form']}
    })
    cache.set('a:orders', Promise.resolve('orders'))
    cache.set('a:customers', Promise.resolve('customers'))
    cache.set('b:orders', Promise.resolve('other app'))
    const listener = vi.fn()
    const unsubscribe = subscribeAppData(listener)
    try {
      notifyAppDataChange({appId: 'a', resource: 'form', formName: 'orders'})
      expect(cache.get('a:orders')).toBeUndefined()
      expect(cache.get('a:customers')).toBeDefined()
      expect(cache.get('b:orders')).toBeDefined()
      vi.advanceTimersByTime(200)
      notifyAppDataChange({appId: 'a', resource: 'form', formName: 'orders'})
      vi.advanceTimersByTime(150)
      expect(listener).toHaveBeenCalledTimes(1)
      expect(getAppDataRevision({appId: 'a', resources: ['form'], formName: 'orders'})).toBeGreaterThan(0)
      expect(getAppDataRevision({appId: 'a', resources: ['form'], formName: 'customers'})).toBe(0)
      expect(getAppDataRevision({appId: 'b', resources: ['form']})).toBe(0)
    } finally {
      unsubscribe()
    }
  })

  it('失效期间返回的旧响应跟随新请求，不能覆盖新数据', async () => {
    const cache = createAppDataCache<string>(appId => ({appId, resources: ['app']}))
    let resolveOld!: (value: string) => void
    const load = vi.fn().mockImplementationOnce(() => new Promise<string>(resolve => {
      resolveOld = resolve
    }))
      .mockResolvedValue('new')
    const old = cachedFetch(cache, 'a', load)
    notifyAppDataChange({appId: 'a', resource: 'app'})
    const current = cachedFetch(cache, 'a', load)
    resolveOld('old')
    expect(await old).toBe('new')
    expect(await current).toBe('new')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('旧请求失败不能移除已经替换的新缓存', async () => {
    const cache = createAppDataCache<string>()
    let rejectOld!: (error: Error) => void
    const old = cachedFetch(cache, 'a', () => new Promise<string>((_, reject) => {
      rejectOld = reject
    }))
    const replacement = Promise.resolve('saved')
    cache.set('a', replacement)
    rejectOld(new Error('late failure'))
    await expect(old).rejects.toThrow('late failure')
    expect(cache.get('a')).toBe(replacement)
    flushAppDataChanges()
  })

  it('本地 CRUD 从旧 Promise 派生缓存时不会形成循环等待', async () => {
    const cache = createAppDataCache<string[]>()
    const initial = cachedFetch(cache, 'apps', () => Promise.resolve(['initial']))
    const updated = initial.then(apps => [...apps, 'created'])
    cache.set('apps', updated)
    expect(await initial).toEqual(['initial'])
    expect(await cachedFetch(cache, 'apps', vi.fn())).toEqual(['initial', 'created'])
  })
})

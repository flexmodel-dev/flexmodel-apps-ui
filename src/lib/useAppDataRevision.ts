import {useCallback, useSyncExternalStore} from 'react'
import {getAppDataRevision, subscribeAppData, type AppDataResource} from '@/services/appDataCache'

/** 只订阅当前页面关心的资源；返回稳定的数字供加载 effect 或查询 reloadKey 使用。 */
export function useAppDataRevision(appId: string | undefined, resources: readonly AppDataResource[], formName?: string) {
  const resourceKey = resources.join(',')
  const getSnapshot = useCallback(() => getAppDataRevision({
    appId, resources: resourceKey.split(',') as AppDataResource[], formName,
  }), [appId, resourceKey, formName])
  return useSyncExternalStore(subscribeAppData, getSnapshot)
}

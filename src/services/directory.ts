import {requestJson} from './http'
import {cachedFetch, createAppDataCache} from './appDataCache'
import type {Directory} from '@/types/directory'

const directoryCache = createAppDataCache<Directory>()

export function getDirectory(appId: string): Promise<Directory> {
  return cachedFetch(directoryCache, appId, () => requestJson<Directory>(`/api/apps/${encodeURIComponent(appId)}/directory`))
}

/** 最近使用为纯前端记录：后端暂无对应接口，先以本地存储保存访问轨迹。 */
export interface RecentUse {
  appId: string
  navId?: string
  name: string
  kind: 'app' | 'form'
  at: number
}

const STORAGE_KEY = 'flexmodel-apps.recent-uses'
const MAX_ENTRIES = 20

function read(): RecentUse[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) as RecentUse[] : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(entries: RecentUse[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // 本地存储不可用时最近使用自然失效。
  }
}

export function rememberRecentUse(entry: Omit<RecentUse, 'at'>): void {
  if (!entry.appId || !entry.name) return
  const rest = read().filter(item => !(item.appId === entry.appId && item.navId === entry.navId))
  write([{...entry, at: Date.now()}, ...rest].slice(0, MAX_ENTRIES))
}

export function getRecentUses(): RecentUse[] {
  return read().filter(item => Boolean(item.appId) && Boolean(item.name))
}

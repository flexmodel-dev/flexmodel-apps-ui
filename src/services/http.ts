import {getAuthToken} from '@/services/auth'

export async function requestResponse(path: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken()
  const headers = new Headers(init?.headers)
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(path, {
    ...init,
    headers,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as unknown
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? String((payload as { message?: unknown }).message ?? '')
      : ''
    throw new Error(message || `请求失败（${response.status}）`)
  }
  return response
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  return (await (await requestResponse(path, init)).json().catch(() => null)) as T
}

export interface PagedResult<T> {
  list: T[]
  total: number
}

/** 防御性归一分页结果：list 兜底空数组，total 兜底 0 */
export function normalizePage<T>(page: { list?: T[]; total?: number }): PagedResult<T> {
  return {
    list: Array.isArray(page.list) ? page.list : [],
    total: Number.isFinite(page.total) ? Number(page.total) : 0,
  }
}

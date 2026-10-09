import {getAuthToken} from '@/services/auth'

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
    },
  })
  const payload = await response.json().catch(() => null) as unknown
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? String((payload as { message?: unknown }).message ?? '')
      : ''
    throw new Error(message || `请求失败（${response.status}）`)
  }
  return payload as T
}

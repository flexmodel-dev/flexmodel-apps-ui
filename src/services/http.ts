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
    const body = await response.text().catch(() => '')
    throw new Error(errorMessage(response.status, body))
  }
  return response
}

/**
 * 错误响应优先取 JSON message；非 JSON（网关/开发服务器 HTML 页）至少给出状态码和页面标题，
 * 避免界面只剩一个没有上下文的“请求失败”。
 */
function errorMessage(status: number, body: string): string {
  try {
    const payload = JSON.parse(body) as { message?: unknown } | null
    const message = typeof payload?.message === 'string' ? payload.message.trim() : ''
    if (message) return message
  } catch {
    // 非 JSON 响应，继续走兜底
  }
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(body)?.[1]?.trim()
  return title ? `请求失败（HTTP ${status}）：${title}` : `请求失败（HTTP ${status}）`
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  return (await (await requestResponse(path, init)).json().catch(() => null)) as T
}

/**
 * 消费 SSE 流式响应，支持 UTF-8/CRLF 分片和多行 data；业务层判断是否收到终态事件。
 */
export async function requestSse(path: string, init: RequestInit, onEvent: (data: string) => void): Promise<void> {
  const token = getAuthToken()
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Accept', 'text/event-stream')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(path, {...init, headers})
  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '')
    throw new Error(errorMessage(response.status, body))
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (; ;) {
      const {done, value} = await reader.read()
      if (done) break
      buffer += decoder.decode(value, {stream: true})
      let boundary = /\r?\n\r?\n/.exec(buffer)
      while (boundary) {
        const chunk = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index + boundary[0].length)
        const data = chunk.split(/\r?\n/).filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart()).join('\n')
        if (data) onEvent(data)
        boundary = /\r?\n\r?\n/.exec(buffer)
      }
    }
  } finally {
    await reader.cancel().catch(() => {
    })
    reader.releaseLock()
  }
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

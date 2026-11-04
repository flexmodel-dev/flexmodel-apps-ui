import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {streamAiMessage} from './ai'
import {clearAppDataCache, getAppDataRevision} from './appDataCache'

vi.mock('./auth', () => ({getAuthToken: () => 'test-token'}))
const event = (value: object) => `data: ${JSON.stringify(value)}\r\n\r\n`
const change = {appId: 'new-app', resource: 'app'}
const handlers = () => ({onToken: vi.fn(), onDone: vi.fn(), onError: vi.fn()})

beforeEach(() => clearAppDataCache())
afterEach(() => {
  clearAppDataCache();
  vi.unstubAllGlobals()
})

describe('AI 流式变更同步', () => {
  it('正常完成同步变更并保留完整回复，支持 CRLF 与分片中文', async () => {
    const data = new TextEncoder().encode(event({type: 'change', change})
      + event({type: 'token', content: '创建完成'})
      + event({type: 'done', conversation: {id: 'conversation'}}))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        for (let i = 0; i < data.length; i += 7) controller.enqueue(data.slice(i, i + 7))
        controller.close()
      },
    }))))
    const callbacks = handlers()
    await streamAiMessage('conversation', '创建应用', callbacks)
    expect(getAppDataRevision({resources: ['app']})).toBeGreaterThan(0)
    expect(callbacks.onToken).toHaveBeenCalledWith('创建完成')
    expect(callbacks.onDone).toHaveBeenCalledWith({id: 'conversation'})
  })

  it('工具写入后模型失败，已知变更仍同步', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(event({type: 'change', change})
      + event({type: 'error', content: '模型失败'}))))
    const callbacks = handlers()
    await streamAiMessage('conversation', '创建应用', callbacks)
    expect(getAppDataRevision({resources: ['app']})).toBeGreaterThan(0)
    expect(callbacks.onError).toHaveBeenCalledWith('模型失败')
  })

  it('中止或断流后核对变更，断流不能被当作正常完成', async () => {
    const abort = new AbortController()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(event({type: 'change', change})))
        abort.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')))
      },
    }))))
    const request = streamAiMessage('conversation', '创建应用', handlers(), undefined, abort.signal)
    await new Promise(resolve => setTimeout(resolve, 0))
    abort.abort()
    await expect(request).rejects.toThrow('Aborted')
    expect(getAppDataRevision({resources: ['app']})).toBeGreaterThan(0)
    clearAppDataCache()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(event({type: 'change', change}))))
    await expect(streamAiMessage('conversation', '创建应用', handlers())).rejects.toThrow('连接已中断')
    expect(getAppDataRevision({resources: ['app']})).toBeGreaterThan(0)
  })

  it('只读回复不会刷新应用数据', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(event({type: 'tool', content: 'list_apps'})
      + event({type: 'done', conversation: {id: 'conversation'}}))))
    await streamAiMessage('conversation', '列出应用', handlers())
    expect(getAppDataRevision({resources: ['app', 'form', 'record']})).toBe(0)
  })
})

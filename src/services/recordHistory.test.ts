import {beforeEach, describe, expect, it, vi} from 'vitest'
import {getRecordHistory, listRecordHistories} from './recordHistory'

const transport = vi.hoisted(() => vi.fn())
vi.mock('./http', () => ({requestJson: transport}))
beforeEach(() => {
  transport.mockReset()
})

describe('记录历史服务契约', () => {
  it('列表携带分页参数，空结果直接透传，不生成模拟事件', async () => {
    const empty = {supported: true, list: [], nextCursor: null, hasMore: false}
    transport.mockResolvedValueOnce(empty)
    await expect(listRecordHistories('app-a', 'orders', 'r1')).resolves.toEqual(empty)
    expect(transport.mock.calls[0][0]).toBe('/api/apps/app-a/forms/orders/records/r1/histories')
    transport.mockResolvedValueOnce({...empty, supported: false})
    const unsupported = await listRecordHistories('app-a', 'orders', 'r1')
    expect(unsupported.supported).toBe(false)
    expect(unsupported.list).toEqual([])
  })
  it('游标与每页数量转换为查询参数', async () => {
    transport.mockResolvedValueOnce({supported: true, list: [], nextCursor: null, hasMore: false})
    await listRecordHistories('app-a', 'orders', 'r1', {size: 50, cursor: 'abc'})
    expect(transport.mock.calls[0][0]).toContain('size=50')
    expect(transport.mock.calls[0][0]).toContain('cursor=abc')
  })
  it('特殊字符与应用标识正确编码，接口错误直接反馈', async () => {
    transport.mockResolvedValueOnce({supported: true, list: [], nextCursor: null, hasMore: false})
    await listRecordHistories('app a', '订单', 'r/1')
    expect(transport.mock.calls[0][0]).toBe(
      '/api/apps/app%20a/forms/%E8%AE%A2%E5%8D%95/records/r%2F1/histories')
    transport.mockRejectedValueOnce(new Error('网络失败'))
    await expect(listRecordHistories('app-a', 'orders', 'r1')).rejects.toThrow('网络失败')
  })
  it('详情按事件 ID 请求', async () => {
    const detail = {id: 'e1', eventType: 'RECORD_UPDATED', summary: '修改了 1 个字段', changes: []}
    transport.mockResolvedValueOnce(detail)
    await expect(getRecordHistory('app-a', 'orders', 'r1', 'e1')).resolves.toEqual(detail)
    expect(transport.mock.calls[0][0]).toBe('/api/apps/app-a/forms/orders/records/r1/histories/e1')
  })
})

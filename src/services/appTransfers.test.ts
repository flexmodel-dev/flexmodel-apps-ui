import {afterEach, describe, expect, it, vi} from 'vitest'
import {commitTransfer, uploadTransfer, type TransferPreview} from './appTransfers'
vi.mock('./auth', () => ({getAuthToken: () => 'test-token'}))
afterEach(() => vi.unstubAllGlobals())

describe('Excel transfer requests', () => {
  it('uploads multipart with authentication and lets the browser set its boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({uploadId: 'upload'})))
    vi.stubGlobal('fetch', fetchMock)
    await uploadTransfer('app', new File(['xlsx'], 'data.xlsx'))
    const [path, request] = fetchMock.mock.calls[0]
    expect(path).toBe('/api/apps/app/transfers/imports')
    expect(request.body).toBeInstanceOf(FormData)
    expect(request.headers.get('Authorization')).toBe('Bearer test-token')
    expect(request.headers.has('Content-Type')).toBe(false)
  })
  it('keeps the same import identifier and hash when retrying after a lost response', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('network failed'))
      .mockResolvedValue(new Response(JSON.stringify({status: 'COMMITTED', total: 2})))
    vi.stubGlobal('fetch', fetchMock)
    const preview = {importId: 'stable-id', planHash: 'stable-hash'} as TransferPreview
    await expect(commitTransfer('app', preview)).rejects.toThrow('network failed')
    await expect(commitTransfer('app', preview)).resolves.toMatchObject({total: 2})
    expect(fetchMock.mock.calls[0][0]).toBe(fetchMock.mock.calls[1][0])
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({planHash: 'stable-hash'}))
  })
  it('rejects unsupported and oversized input before uploading and preserves server errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({message: '导入预览已过期'}), {status: 410}))
    vi.stubGlobal('fetch', fetchMock)
    await expect(uploadTransfer('app', new File(['x'], 'data.csv'))).rejects.toThrow('.xlsx')
    await expect(uploadTransfer('app', new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'data.xlsx'))).rejects.toThrow('10 MB')
    expect(fetchMock).not.toHaveBeenCalled()
    await expect(commitTransfer('app', {importId: 'id', planHash: 'hash'} as TransferPreview)).rejects.toThrow('导入预览已过期')
  })
})

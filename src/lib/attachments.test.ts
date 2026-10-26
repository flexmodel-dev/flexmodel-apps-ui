import {describe, expect, it} from 'vitest'
import {attachmentName, attachmentPreviewType, attachmentUrls, isAttachmentUrl} from './attachments'

describe('附件值与文件名', () => {
  it('逗号分隔URL保留编码后的文件名，并去空与去重', () => {
    const url = '/api/projects/p/buckets/default/objects/a/f/12345678-1234-1234-1234-123456789abc_%E5%9B%BE%2C%E7%89%87.png'
    expect(attachmentUrls(` ${url},,${url},/b.pdf `)).toEqual([url, '/b.pdf'])
    expect(attachmentName(url)).toBe('图,片.png')
    expect(attachmentPreviewType(url)).toBe('image/png')
    expect(attachmentName('/a/%broken.txt')).toBe('%broken.txt')
    expect(attachmentUrls(null)).toEqual([])
  })
  it('只识别常见媒体/PDF预览，不内嵌HTML或未知文件', () => {
    expect(attachmentPreviewType('/a/file.PDF?v=1')).toBe('application/pdf')
    expect(attachmentPreviewType('/a/file.mp4')).toBe('video/mp4')
    expect(attachmentPreviewType('/a/file.mp3')).toBe('audio/mpeg')
    expect(attachmentPreviewType('/a/file.html')).toBeUndefined()
    expect(attachmentPreviewType('/a/file.zip')).toBeUndefined()
    for (const url of ['javascript:alert(1)', 'data:text/html,test', '//example.com/a']) expect(isAttachmentUrl(url)).toBe(false)
    expect(isAttachmentUrl('/api/projects/p/buckets/default/objects/a.pdf')).toBe(true)
    expect(isAttachmentUrl('https://example.com/a.pdf')).toBe(true)
  })
})

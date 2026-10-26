import {getAppById} from '@/services/apps'
import {getAuthToken} from '@/services/auth'
import {requestJson} from '@/services/http'
import {cachedFetch, createAppDataCache} from '@/services/appDataCache'
import {attachmentPreviewType, isAttachmentUrl} from '@/lib/attachments'

interface Bucket {name: string; maxFileSize?: number}
interface UploadedObject {url: string; path: string; name: string}
const bucketCache = createAppDataCache<Bucket>()

function bucketBase(projectId: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/buckets`
}

function ensureBucket(projectId: string) {
  return cachedFetch(bucketCache, projectId, async () => {
    const base = bucketBase(projectId)
    const buckets = await requestJson<Bucket[]>(base)
    const existing = buckets.find(bucket => bucket.name === 'default')
    if (existing) return existing
    try {
      return await requestJson<Bucket>(base, {method: 'POST', body: JSON.stringify({
        name: 'default', description: '应用附件', visibility: 'PRIVATE',
      })})
    } catch (error) {
      // 多个表单同时首次上传时，复用另一请求刚创建的桶。
      const created = await requestJson<Bucket | null>(`${base}/default`).catch(() => null)
      if (created) return created
      throw error
    }
  })
}

async function fileRequest(url: string, init?: RequestInit) {
  if (!isAttachmentUrl(url)) throw new Error('附件地址无效')
  const target = new URL(url, window.location.origin)
  const token = target.origin === window.location.origin ? getAuthToken() : null
  const response = await fetch(target.href, {
    ...init,
    headers: {...init?.headers, ...(token ? {Authorization: `Bearer ${token}`} : {})},
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.message || `文件请求失败（${response.status}）`)
  }
  return response
}

export async function uploadAttachment(appId: string, formId: string, file: File, signal: AbortSignal): Promise<string> {
  const app = await getAppById(appId)
  const bucket = await ensureBucket(app.projectId)
  signal.throwIfAborted()
  if (bucket.maxFileSize && file.size > bucket.maxFileSize) throw new Error('文件大小超过存储桶允许的上限')
  const filename = `${crypto.randomUUID()}_${file.name.replace(/[\\/\u0000-\u001f\u007f]/g, '_')}`
  const path = [appId, formId, filename].map(encodeURIComponent).join('/')
  const url = `${bucketBase(app.projectId)}/${encodeURIComponent(bucket.name)}/objects/${path}`
  const response = await fileRequest(url, {method: 'PUT', headers: {'Content-Type': 'application/octet-stream'}, body: file, signal})
  const uploaded = await response.json() as UploadedObject
  if (!uploaded.url || !isAttachmentUrl(uploaded.url)) throw new Error('上传接口未返回有效文件地址')
  return uploaded.url.replace(/,/g, '%2C')
}

export async function loadAttachment(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fileRequest(url, {signal})
  const blob = await response.blob()
  // Bucket下载端点返回octet-stream；根据文件扩展名赋予浏览器可预览的类型。
  return new Blob([blob], {type: attachmentPreviewType(url) ?? 'application/octet-stream'})
}

export function attachmentUrls(value: unknown): string[] {
  return typeof value === 'string' ? [...new Set(value.split(',').map(url => url.trim()).filter(Boolean))] : []
}

export function isAttachmentUrl(url: string) {
  return /^(https?:\/\/|\/(?!\/))/i.test(url)
}

export function attachmentName(url: string) {
  const name = url.split(/[?#]/)[0].split('/').pop() ?? ''
  let decoded = name
  try { decoded = decodeURIComponent(name) } catch { /* 保留无法解码的文件名 */ }
  return decoded.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, '') || '附件'
}

export function attachmentPreviewType(url: string) {
  const extension = attachmentName(url).split('.').pop()?.toLowerCase() ?? ''
  const types: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon',
    pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  }
  return types[extension]
}

export function isAttachmentField(type: string) {
  return type === 'FILE' || type === 'IMAGE' || type === 'AVATAR'
}

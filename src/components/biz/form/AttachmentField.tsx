import * as React from 'react'
import {Download, FileIcon, Loader2, Paperclip, X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {BizDialog} from '@/components/ui/dialog'
import {attachmentName, attachmentPreviewType, attachmentUrls, isAttachmentUrl} from '@/lib/attachments'
import {toErrorMessage} from '@/lib/utils'
import {loadAttachment, uploadAttachment} from '@/services/attachments'

function useFilePreview(url: string, enabled: boolean) {
  const [source, setSource] = React.useState('')
  const [error, setError] = React.useState('')
  React.useEffect(() => {
    setSource('')
    setError('')
    if (!enabled) return
    const controller = new AbortController()
    let objectUrl = ''
    void loadAttachment(url, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setSource(objectUrl)
    }).catch(error => {
      if (!controller.signal.aborted) setError(toErrorMessage(error, '预览加载失败'))
    })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, enabled])
  return {source, error}
}

function AttachmentThumbnail({url}: {url: string}) {
  const image = attachmentPreviewType(url)?.startsWith('image/') && isAttachmentUrl(url)
  const {source} = useFilePreview(url, !!image)
  return source ? <img src={source} alt="" className="h-10 w-10 shrink-0 rounded border object-cover"/>
    : <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground"/>
}

function AttachmentPreview({url, onClose}: {url: string; onClose: () => void}) {
  const {source, error} = useFilePreview(url, true)
  const type = attachmentPreviewType(url) ?? ''
  const name = attachmentName(url)
  return <BizDialog open onOpenChange={open => { if (!open) onClose() }} title={name} width={880}>
    {error ? <p role="alert" className="text-destructive">{error}</p>
      : !source ? <div role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>正在加载预览…</div>
        : type.startsWith('image/') ? <img src={source} alt={name} className="mx-auto max-h-[60vh] max-w-full object-contain"/>
          : type === 'application/pdf' ? <iframe src={source} title={name} className="h-[60vh] w-full rounded border"/>
            : type.startsWith('video/') ? <video src={source} controls className="max-h-[60vh] w-full"/>
              : <audio src={source} controls className="w-full"/>}
  </BizDialog>
}

export function AttachmentList({value, onRemove}: {value: unknown; onRemove?: (url: string) => void}) {
  const urls = attachmentUrls(value)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [downloading, setDownloading] = React.useState<string | null>(null)
  const [error, setError] = React.useState('')
  const download = async (url: string) => {
    setError('')
    setDownloading(url)
    try {
      const blob = await loadAttachment(url)
      const source = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = source
      anchor.download = attachmentName(url)
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(source), 1000)
    } catch (error) {
      setError(toErrorMessage(error, '下载失败'))
    } finally { setDownloading(null) }
  }
  return <div className="space-y-2 whitespace-normal text-sm font-normal">
    {urls.map(url => <div key={url} className="flex min-w-0 items-center gap-2 rounded-md border bg-background p-2">
      <AttachmentThumbnail url={url}/>
      <span className="min-w-0 flex-1 truncate" title={attachmentName(url)}>{attachmentName(url)}</span>
      {isAttachmentUrl(url) && <>
        {attachmentPreviewType(url) && <Button type="button" size="sm" variant="ghost" onClick={() => {setError(''); setPreview(url)}} aria-label={`预览 ${attachmentName(url)}`}>预览</Button>}
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={!!downloading}
                aria-label={`下载 ${attachmentName(url)}`} onClick={() => void download(url)}>
          {downloading === url ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
        </Button>
      </>}
      {onRemove && <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                           aria-label={`移除 ${attachmentName(url)}`} onClick={() => onRemove(url)}><X className="h-4 w-4"/></Button>}
    </div>)}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {preview && <AttachmentPreview url={preview} onClose={() => setPreview(null)}/>}
  </div>
}

export function AttachmentField({appId, formId, label, value, imageOnly, disabled, onChange, onUploadStart}: {
  appId: string; formId: string; label: string; value: unknown; imageOnly?: boolean; disabled?: boolean
  onChange: (value: string) => void; onUploadStart?: () => () => void
}) {
  const input = React.useRef<HTMLInputElement>(null)
  const controller = React.useRef<AbortController | null>(null)
  const finish = React.useRef<(() => void) | undefined>(undefined)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState('')
  React.useEffect(() => () => {controller.current?.abort(); finish.current?.()}, [])
  const upload = async (files: File[]) => {
    if (!files.length || disabled || uploading) return
    const abort = new AbortController()
    controller.current = abort
    setUploading(true)
    setError('')
    const complete = onUploadStart?.()
    finish.current = complete
    const urls = attachmentUrls(value)
    const failures: string[] = []
    try {
      for (const file of files) {
        try {
          if (imageOnly && !file.type.startsWith('image/')) throw new Error('请选择图片文件')
          const url = await uploadAttachment(appId, formId, file, abort.signal)
          if (abort.signal.aborted) return
          urls.push(url)
          onChange(urls.join(','))
        } catch (error) {
          if (abort.signal.aborted) return
          failures.push(`${file.name}：${toErrorMessage(error, '上传失败')}`)
        }
      }
      if (!abort.signal.aborted) setError(failures.join('；'))
    } finally {
      complete?.()
      finish.current = undefined
      if (!abort.signal.aborted) setUploading(false)
    }
  }
  return <div className="space-y-2">
    <AttachmentList value={value} onRemove={!disabled && !uploading ? url => onChange(attachmentUrls(value).filter(item => item !== url).join(',')) : undefined}/>
    {!disabled && <>
      <input ref={input} type="file" multiple accept={imageOnly ? 'image/*' : undefined} className="hidden" aria-label={`上传${label}`}
             disabled={uploading} onChange={event => {const files = Array.from(event.target.files ?? []); event.target.value = ''; void upload(files)}}/>
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Paperclip className="h-4 w-4"/>}{uploading ? '上传中…' : '上传文件'}
      </Button>
      <p className="text-xs text-muted-foreground">支持选择一个或多个{imageOnly ? '图片' : '文件'}，上传后可预览或移除。</p>
    </>}
    {disabled && !attachmentUrls(value).length && <span className="text-sm text-muted-foreground">暂无附件</span>}
    {error && <p role="alert" className="break-words text-xs text-destructive">{error}</p>}
  </div>
}

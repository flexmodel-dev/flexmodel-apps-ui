import * as React from 'react'

/** 每次上传独立计数，多个附件字段并行上传时也能阻止提前保存。 */
export function useAttachmentUploads() {
  const pending = React.useRef(new Set<symbol>())
  const [uploading, setUploading] = React.useState(false)
  const startUpload = React.useCallback(() => {
    const id = Symbol()
    pending.current.add(id)
    setUploading(true)
    return () => {
      pending.current.delete(id)
      setUploading(pending.current.size > 0)
    }
  }, [])
  return {uploading, startUpload}
}

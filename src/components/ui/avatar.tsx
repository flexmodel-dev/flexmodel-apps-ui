import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'
import {loadAttachment} from '@/services/attachments'

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
))
Avatar.displayName = 'Avatar'

/** 图片加载失败或未设置时回退到姓名首字。 */
export function UserAvatar({name, src, size = 36, className}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string
}) {
  const [preview, setPreview] = React.useState<{ source: string; url: string } | null>(null)
  React.useEffect(() => {
    setPreview(null)
    if (!src) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    loadAttachment(src, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setPreview({source: src, url: objectUrl})
    }).catch(() => {
    })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])
  return (
    <span
      className={cn('inline-flex shrink-0 overflow-hidden select-none items-center justify-center rounded-full border border-border bg-muted font-medium text-foreground', className)}
      style={{width: size, height: size, fontSize: size * 0.45}}
    >
      {preview && preview.source === src ? (
        <img src={preview.url} alt={`${name}的头像`} className="h-full w-full object-cover"
             onError={() => setPreview(null)}/>
      ) : (name || '?').slice(0, 1)}
    </span>
  )
}

export { Avatar }

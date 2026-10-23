import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {cn, isNotificationToastTarget} from '@/lib/utils'
import { X } from 'lucide-react'
import {Button} from '@/components/ui/button'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[1040] bg-black/30 backdrop-blur-[1px]" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-[1041] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg outline-none animate-in fade-in-0 zoom-in-95',
        className
      )}
      {...props}
      onPointerDownOutside={event => {
        props.onPointerDownOutside?.(event)
        // 点击全局通知浮层不算点击对话框外部，避免误关对话框
        if (isNotificationToastTarget(event.target)) event.preventDefault()
      }}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm text-muted-foreground transition-colors hover:text-foreground">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

/** 带标题和底部的对话框 */
export function BizDialog({
  open,
  onOpenChange,
  title,
  width,
                           height,
  children,
  footer,
  headerExtra,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: React.ReactNode
  width?: number
  height?: string
  children: React.ReactNode
  footer?: React.ReactNode
  headerExtra?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        style={{maxWidth: width ?? 520, height: height ?? undefined}}
        className={height ? 'flex flex-col' : undefined}
        hideClose
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
          <div className="flex items-center gap-1">
            {headerExtra}
            <DialogPrimitive.Close className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
        </div>
        <div
          className={
            height
              ? 'min-h-0 flex-1 overflow-y-auto px-1.5 py-4 text-sm text-muted-foreground'
              : 'max-h-[70vh] overflow-y-auto px-1.5 py-4 text-sm text-muted-foreground'
          }
        >
          {children}
        </div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border pt-4">{footer}</div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** 确认操作对话框：危险操作按钮与进行中状态 */
export function ConfirmDialog({open, onOpenChange, title, message, busy, confirmText = '确认', onConfirm}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: React.ReactNode
  message: React.ReactNode
  busy?: boolean
  confirmText?: string
  onConfirm: () => void
}) {
  return (
    <BizDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? confirmText + '中…' : confirmText}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted-foreground">{message}</div>
    </BizDialog>
  )
}

export { Dialog, DialogTrigger, DialogContent }

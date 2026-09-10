import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

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
        'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg outline-none animate-in fade-in-0 zoom-in-95',
        className
      )}
      {...props}
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
export function RbDialog({
  open,
  onOpenChange,
  title,
  width,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: React.ReactNode
  width?: number
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: width ?? 520 }} hideClose>
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h5 className="text-lg font-semibold">{title}</h5>
          <DialogPrimitive.Close className="text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="max-h-[70vh] overflow-y-auto py-4 text-sm text-muted-foreground">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border pt-4">{footer}</div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { Dialog, DialogTrigger, DialogContent }

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {cn, isNotificationToastTarget} from '@/lib/utils'
import {PanelRightClose, PanelRightOpen, X} from 'lucide-react'

const Drawer = DialogPrimitive.Root
const DrawerTrigger = DialogPrimitive.Trigger
const DrawerPortal = DialogPrimitive.Portal
const DrawerTitle = DialogPrimitive.Title
const DrawerDescription = DialogPrimitive.Description
const DrawerClose = DialogPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-[1040] bg-black/30 backdrop-blur-[1px]', className)}
    {...props}
  />
))
DrawerOverlay.displayName = 'DrawerOverlay'

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-y-0 right-0 z-[1040] flex w-[min(92vw,420px)] flex-col border-l bg-background shadow-2xl outline-none animate-in slide-in-from-right duration-300',
        className,
      )}
      {...props}
      onPointerDownOutside={event => {
        props.onPointerDownOutside?.(event)
        // 点击全局通知浮层不算点击抽屉外部，避免误关抽屉
        if (isNotificationToastTarget(event.target)) event.preventDefault()
      }}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm text-muted-foreground transition-colors hover:text-foreground">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = 'DrawerContent'

/** 带标题和底部的右侧抽屉，与详情页抽屉宽度保持一致；aside 提供时右侧内嵌面板，右上角按钮展开/折叠 */
export function BizDrawer({
                            open,
                            onOpenChange,
                            title,
                            width,
                            children,
                            footer,
                            moreMenu,
                            aside,
                            asideLabel = '流程进度',
                          }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: React.ReactNode
  width?: string
  children: React.ReactNode
  footer?: React.ReactNode
  moreMenu?: React.ReactNode
  aside?: React.ReactNode
  asideLabel?: string
}) {
  const [asideOpen, setAsideOpen] = React.useState(true)
  React.useEffect(() => {
    if (open) setAsideOpen(true)
  }, [open])
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        aria-describedby={undefined}
        hideClose
        className={cn('w-full md:w-[calc(100vw-16rem)]', width)}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <DrawerTitle className="text-lg font-semibold">{title}</DrawerTitle>
          <div className="flex items-center gap-1">
            {aside && (
              <button
                type="button"
                className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
                title={asideOpen ? `收起${asideLabel}` : `展开${asideLabel}`}
                aria-label={asideOpen ? `收起${asideLabel}` : `展开${asideLabel}`}
                onClick={() => setAsideOpen((value) => !value)}
              >
                {asideOpen ? <PanelRightClose className="h-4 w-4"/> : <PanelRightOpen className="h-4 w-4"/>}
              </button>
            )}
            {moreMenu}
            <DrawerClose className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-4 w-4"/>
            </DrawerClose>
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {children}
          </div>
          {aside && asideOpen && (
            <aside className="min-h-0 w-72 shrink-0 overflow-y-auto border-l border-border bg-muted/30 px-4 py-4">
              {aside}
            </aside>
          )}
        </div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
}

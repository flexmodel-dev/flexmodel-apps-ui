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

// 抽屉既可能嵌套渲染，也可能是兄弟节点，按打开后的 Portal 顺序统一管理。
let drawerStack: HTMLElement[] = []
const drawerStackListeners = new Set<() => void>()
const getDrawerStack = () => drawerStack
const subscribeDrawerStack = (listener: () => void) => {
  drawerStackListeners.add(listener)
  return () => { drawerStackListeners.delete(listener) }
}

function useDrawerMaxWidth(content: HTMLElement | null, stacked: boolean) {
  const stack = React.useSyncExternalStore(subscribeDrawerStack, getDrawerStack, getDrawerStack)
  const index = content ? stack.indexOf(content) : -1
  const previous = index > 0 ? stack[index - 1] : null
  const [parentWidth, setParentWidth] = React.useState<number | null>(null)

  React.useLayoutEffect(() => {
    if (!content || !stacked) return
    drawerStack = [...drawerStack, content].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )
    drawerStackListeners.forEach(listener => listener())
    return () => {
      drawerStack = drawerStack.filter(item => item !== content)
      drawerStackListeners.forEach(listener => listener())
    }
  }, [content, stacked])

  React.useLayoutEffect(() => {
    if (!previous) {
      setParentWidth(null)
      return
    }
    const measure = () => setParentWidth(previous.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(previous)
    return () => observer.disconnect()
  }, [previous])

  return previous && parentWidth !== null
    ? `max(0px, calc(${parentWidth}px - var(--drawer-stack-gap)))`
    : undefined
}

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
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean; stacked?: boolean }
>(({ className, children, hideClose, stacked = true, style, ...props }, ref) => {
  const [content, setContent] = React.useState<HTMLDivElement | null>(null)
  const maxWidth = useDrawerMaxWidth(content, stacked)
  const configuredMaxWidth = typeof style?.maxWidth === 'number' ? `${style.maxWidth}px` : style?.maxWidth
  const contentStyle = maxWidth
    ? {...style, maxWidth: configuredMaxWidth && configuredMaxWidth !== 'none'
      ? `min(${configuredMaxWidth}, ${maxWidth})` : maxWidth}
    : style
  const contentRef = React.useCallback((node: HTMLDivElement | null) => {
    setContent(node)
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }, [ref])

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        className={cn(
          'fixed inset-y-0 right-0 z-[1040] flex w-[min(92vw,420px)] flex-col border-l bg-background shadow-2xl outline-none animate-in slide-in-from-right duration-300 [--drawer-stack-gap:1rem] md:[--drawer-stack-gap:3rem]',
          className,
        )}
        {...props}
        style={contentStyle}
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
  )
})
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
                            asideCollapsedLabel,
                            asideDefaultOpen = true,
                            stacked = true,
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
  asideCollapsedLabel?: React.ReactNode
  asideDefaultOpen?: boolean
  stacked?: boolean
}) {
  const [asideOpen, setAsideOpen] = React.useState(asideDefaultOpen)
  const asideTouched = React.useRef(false)
  const defaultOpenRef = React.useRef(asideDefaultOpen)
  defaultOpenRef.current = asideDefaultOpen

  React.useEffect(() => {
    asideTouched.current = false
    if (open) setAsideOpen(defaultOpenRef.current)
  }, [open])

  // 审批实例异步到达后才可判断“进行中”，仅在用户未手动操作时自动展开
  React.useEffect(() => {
    if (!open || asideTouched.current || !asideDefaultOpen) return
    setAsideOpen(true)
  }, [open, asideDefaultOpen])
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        aria-describedby={undefined}
        hideClose
        stacked={stacked}
        className={cn('w-full md:w-[calc(100vw-16rem)]', width)}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <DrawerTitle className="text-lg font-semibold">{title}</DrawerTitle>
          <div className="flex items-center gap-1">
            {aside && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-sm p-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                title={asideOpen ? `收起${asideLabel}` : `展开${asideLabel}`}
                aria-label={asideOpen ? `收起${asideLabel}` : `展开${asideLabel}`}
                onClick={() => {
                  asideTouched.current = true
                  setAsideOpen((value) => !value)
                }}
              >
                {asideOpen ? <PanelRightClose className="h-4 w-4"/> : <PanelRightOpen className="h-4 w-4"/>}
                {!asideOpen && asideCollapsedLabel}
              </button>
            )}
            {moreMenu}
            <DrawerClose className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-4 w-4"/>
            </DrawerClose>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto lg:flex lg:overflow-hidden">
          <div className="min-w-0 px-6 py-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {children}
          </div>
          {aside && asideOpen && (
            <aside aria-label={asideLabel}
                   className="min-w-0 border-t border-border bg-card px-4 py-5 lg:min-h-0 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0 xl:w-[360px] xl:px-5">
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

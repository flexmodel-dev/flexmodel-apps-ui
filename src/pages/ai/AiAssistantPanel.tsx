import * as React from 'react'
import {Loader2} from 'lucide-react'
import {Drawer, DrawerContent, DrawerTitle} from '@/components/ui/drawer'
import {AiChat} from './AiChat'
import {useAiAssistant, useAiRobots} from './AiProvider'
import {AI_ASSISTANT_ROBOT, AI_BUILDER_ROBOT} from '@/services/ai'
import {cn} from '@/lib/utils'

const panelWidthKey = 'flexmodel-apps.ai-panel-width'
const panelDefaultWidth = 420

// 面板贴右停靠，内容区只额外让出 1.5rem 间距，同时保留至少 320px 可用宽度。
function clampPanelWidth(value: number) {
  return Math.max(320, Math.min(Math.min(720, window.innerWidth - 344), value))
}

export function AiAssistantPanel() {
  const ai = useAiAssistant()
  const [desktop, setDesktop] = React.useState(() => window.matchMedia('(min-width: 1024px)').matches)
  const [width, setWidth] = React.useState(() => clampPanelWidth(Number(window.localStorage.getItem(panelWidthKey)) || panelDefaultWidth))
  const [resizing, setResizing] = React.useState<{ startX: number; startWidth: number } | null>(null)
  // 工作台组件可以指定机器人打开面板；未指定时使用内置助手（应用内外共用同一套助手会话）。
  const requestedRobotId = ai.request.robotId
  const {robots, loading: robotsLoading} = useAiRobots(
    ai.panelOpen && !ai.isAdmin && requestedRobotId && ai.appId ? ai.appId : undefined)
  const defaultRobot = ai.isAdmin ? AI_BUILDER_ROBOT : AI_ASSISTANT_ROBOT
  const robot = requestedRobotId ? robots.find(item => item.id === requestedRobotId) ?? defaultRobot : defaultRobot
  React.useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const update = () => setDesktop(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  React.useEffect(() => {
    if (!ai.panelOpen || !desktop) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !(event.target as HTMLElement).closest('[role="dialog"], [role="listbox"]')) ai.closeAssistant()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [ai.panelOpen, desktop, ai.closeAssistant])
  React.useEffect(() => {
    if (!resizing) return
    const move = (event: PointerEvent) => setWidth(clampPanelWidth(resizing.startWidth + resizing.startX - event.clientX))
    const stop = () => setResizing(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizing])
  React.useEffect(() => {
    if (desktop && !resizing) window.localStorage.setItem(panelWidthKey, String(width))
  }, [width, resizing, desktop])
  // 内容区通过该变量让位，拖动时同步收缩。
  React.useEffect(() => {
    document.documentElement.style.setProperty('--ai-panel-width', `${width}px`)
  }, [width])
  if (!ai.panelOpen) return null
  const content = <>
    {requestedRobotId && !ai.isAdmin && robotsLoading
      ? <div className="flex flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin"/></div>
      : <div className="min-h-0 flex-1"><AiChat robot={robot} compact receivePrompt title="AI 应用助手"
                                                onClose={ai.closeAssistant}/></div>}
  </>
  return desktop ? <aside aria-label="AI 助手" style={{width}}
                          className="fixed bottom-0 right-0 top-16 z-40 flex flex-col border-l bg-background shadow-sm">
      <div role="separator" aria-orientation="vertical" aria-label="调整 AI 助手面板宽度" title="拖动调整宽度"
           onPointerDown={event => {
             event.preventDefault();
             setResizing({startX: event.clientX, startWidth: width})
           }}
           className={cn('absolute inset-y-0 left-0 w-2 cursor-col-resize touch-none transition-colors hover:bg-primary/30', resizing && 'bg-primary/50')}/>
      {content}
    </aside> :
    <Drawer open onOpenChange={open => !open && ai.closeAssistant()}><DrawerContent hideClose stacked={false}
                                                                                    className="w-full sm:w-[420px]"><DrawerTitle
      className="sr-only">AI 助手</DrawerTitle>{content}</DrawerContent></Drawer>
}

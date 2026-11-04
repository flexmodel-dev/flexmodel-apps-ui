import * as React from 'react'
import {useParams} from 'react-router-dom'
import {Bot, PanelRightOpen, Settings2} from 'lucide-react'
import {AppLayout} from '@/components/layout/AppLayout'
import {Button} from '@/components/ui/button'
import {Empty} from '@/components/ui/empty'
import {AppLoading} from '@/components/biz/AppLoading'
import {AiChat} from '@/components/ai/AiChat'
import {AiRobotDialog} from '@/components/ai/AiRobotDialog'
import {useAiAssistant, useAiRobots} from '@/components/ai/AiProvider'

/**
 * AI 对话页面：由内置页面导航（BUILTIN:chatbot）或
 * /apps/:appId/ai/chat/:robotId 直接访问。与右侧 AI 助手共用同一份会话状态；
 * 菜单未指定机器人时默认使用第一个启用的机器人，机器人可在页面内直接配置。
 */
export default function AiChatPage({robotId}: { robotId?: string | null }) {
  const ai = useAiAssistant()
  const params = useParams<{ appId: string; robotId?: string }>()
  const appId = params.appId ?? ''
  const desiredId = robotId ?? params.robotId
  const {robots, loading, error, refresh} = useAiRobots(appId)
  const [robotDialogOpen, setRobotDialogOpen] = React.useState(false)
  const robot = robots.find(item => item.id === desiredId)
    ?? robots.find(item => item.enabled)
    ?? robots[0]

  if (loading) return <AppLayout noPadding noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
    <AppLoading center className="min-h-[320px]" label="正在加载机器人"/>
  </AppLayout>
  if (error) return <AppLayout>
    <div className="p-6 text-sm">
      <p role="alert" className="m-0 text-destructive">{error}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>重试</Button>
    </div>
  </AppLayout>
  if (!robot) return <AppLayout noPadding noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-xl border bg-card">
      <Empty description="当前应用还没有对话机器人，创建后即可开始 AI 对话">
        <Button size="sm" onClick={() => setRobotDialogOpen(true)}><Settings2 className="h-4 w-4"/>创建机器人</Button>
      </Empty>
    </div>
    <AiRobotDialog appId={appId} open={robotDialogOpen} onOpenChange={setRobotDialogOpen} startInCreate/>
  </AppLayout>

  return <AppLayout noPadding noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="h-5 w-5"/>
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-sm font-semibold">{robot.name}</h1>
          <p
            className="mb-0 mt-0.5 truncate text-xs text-muted-foreground">{robot.description || '围绕当前应用提问'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRobotDialogOpen(true)}>
          <Settings2 className="h-4 w-4"/>机器人
        </Button>
        <Button variant="outline" size="sm" onClick={() => ai.openAssistant({robotId: robot.id})}>
          <PanelRightOpen className="h-4 w-4"/>在侧栏继续
        </Button>
      </header>
      <div className="min-h-0 flex-1">
        <AiChat robot={robot}/>
      </div>
    </div>
    <AiRobotDialog appId={appId} open={robotDialogOpen} onOpenChange={setRobotDialogOpen}
                   startInCreate={robots.length === 0}/>
  </AppLayout>
}

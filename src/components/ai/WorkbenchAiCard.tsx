import * as React from 'react'
import {ArrowUp, Bot, Settings2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {AppLoading} from '@/components/biz/AppLoading'
import {AiChat} from './AiChat'
import {AiRobotDialog} from './AiRobotDialog'
import {useAiAssistant, useAiRobots} from './AiProvider'
import type {WorkbenchAiConfig} from '@/services/workbenches'

/**
 * 工作台 AI 对话组件。
 * - shortcut：展示机器人介绍、推荐问题与提问输入框，发送后打开右侧 AI 助手继续对话；
 * - embedded：内嵌完整对话，与助手面板共用同一会话状态。
 */
export function WorkbenchAiCard({appId, config}: { appId?: string; config: WorkbenchAiConfig }) {
  const ai = useAiAssistant()
  const {robots, loading, error} = useAiRobots(appId)
  const robot = robots.find(item => item.id === config.robotId)
    ?? robots.find(item => item.enabled)
    ?? robots[0]
  const [draft, setDraft] = React.useState('')
  const [robotDialogOpen, setRobotDialogOpen] = React.useState(false)
  const showSuggestions = config.showSuggestions !== false
  const ask = (content: string) => {
    const text = content.trim()
    if (!text || !robot) return
    ai.openAssistant({robotId: robot.id, prompt: text})
    setDraft('')
  }

  if (!appId) return <p className="text-sm text-muted-foreground">请先在应用内使用 AI 组件。</p>
  if (loading) return <AppLoading className="h-full" label="正在加载机器人"/>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!robot) return <div
    className="flex h-full flex-col items-start justify-center gap-2 text-sm text-muted-foreground">
    <p className="m-0">该组件还没有可用的对话机器人。</p>
    <Button variant="outline" size="sm" onClick={() => setRobotDialogOpen(true)}>
      <Settings2 className="h-4 w-4"/>创建机器人
    </Button>
    <AiRobotDialog appId={appId} open={robotDialogOpen} onOpenChange={setRobotDialogOpen} startInCreate/>
  </div>

  if (config.displayMode === 'embedded') {
    return <div className="flex h-full min-h-0 flex-col rounded-lg border">
      <AiChat robot={robot} compact showSuggestions={showSuggestions}/>
    </div>
  }

  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Bot className="h-5 w-5"/>
      </span>
      <div className="min-w-0">
        <p className="m-0 truncate text-sm font-medium">{robot.name}</p>
        <p className="mb-0 mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {robot.description || robot.greeting}
        </p>
      </div>
    </div>
    {showSuggestions && robot.suggestions.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
      {robot.suggestions.slice(0, 3).map(question => <Button key={question} variant="outline" size="sm"
                                                             className="h-auto max-w-full whitespace-normal py-1.5 text-left text-xs font-normal"
                                                             onClick={() => ask(question)}>{question}</Button>)}
    </div>}
    <form className="mt-auto flex items-center gap-2 pt-3" onSubmit={event => {
      event.preventDefault()
      ask(draft)
    }}>
      <Input value={draft} maxLength={4000} placeholder={`向「${robot.name}」提问`} aria-label="向 AI 助手提问"
             onChange={event => setDraft(event.target.value)} className="h-9"/>
      <Button type="submit" size="icon" className="h-9 w-9 shrink-0" aria-label="发送给 AI 助手"
              disabled={!draft.trim() || !robot.enabled}>
        <ArrowUp className="h-4 w-4"/>
      </Button>
    </form>
  </div>
}

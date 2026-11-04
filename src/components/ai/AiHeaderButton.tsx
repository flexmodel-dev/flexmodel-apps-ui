import {Sparkles} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'
import {useAiAssistant} from './AiProvider'

/** 顶部常驻 AI 入口：管理区展示应用搭建助手文案，业务页自动携带当前应用作为隐藏上下文。 */
export function AiHeaderButton({className}: { className?: string }) {
  const ai = useAiAssistant()
  return <Button
    variant="ghost"
    size="icon"
    title="AI 助手"
    aria-label="AI 助手"
    aria-expanded={ai.panelOpen}
    className={cn(className, ai.panelOpen && 'bg-white/20 text-white dark:bg-white/10 dark:text-white')}
    onClick={() => ai.panelOpen ? ai.closeAssistant() : ai.openAssistant()}
  >
    <Sparkles className="h-5 w-5"/>
  </Button>
}

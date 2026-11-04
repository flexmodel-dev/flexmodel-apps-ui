import * as React from 'react'
import {Bot, Pencil, Plus, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Checkbox} from '@/components/ui/checkbox'
import {Badge} from '@/components/ui/badge'
import {BizDialog} from '@/components/ui/dialog'
import {AppLoading} from '@/components/biz/AppLoading'
import {deleteAiRobot, getAiRobots, saveAiRobot, type AiRobot, type AiRobotInput} from '@/services/ai'
import {aiRobotDefaults} from '@/data/mock'
import {toErrorMessage} from '@/lib/utils'

const MAX_SUGGESTIONS = 6

interface RobotForm {
  name: string
  description: string
  greeting: string
  suggestions: string
  prompt: string
  enabled: boolean
}

function toForm(robot?: AiRobot): RobotForm {
  return {
    name: robot?.name ?? aiRobotDefaults.name,
    description: robot?.description ?? aiRobotDefaults.description,
    greeting: robot?.greeting ?? aiRobotDefaults.greeting,
    suggestions: (robot?.suggestions ?? aiRobotDefaults.suggestions).join('\n'),
    prompt: robot?.prompt ?? aiRobotDefaults.prompt,
    enabled: robot?.enabled ?? aiRobotDefaults.enabled,
  }
}

function toInput(form: RobotForm): AiRobotInput {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    greeting: form.greeting.trim(),
    suggestions: form.suggestions.split('\n').map(line => line.trim()).filter(Boolean).slice(0, MAX_SUGGESTIONS),
    prompt: form.prompt.trim(),
    enabled: form.enabled,
  }
}

/**
 * AI 对话机器人管理对话框：不再挂在应用设置里，由 AI 助手面板、工作台组件和
 * AI 对话页在需要时直接打开；没有机器人时可直接进入新建表单。
 */
export function AiRobotDialog({appId, open, onOpenChange, startInCreate = false}: {
  appId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  startInCreate?: boolean
}) {
  const [robots, setRobots] = React.useState<AiRobot[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<'new' | AiRobot | null>(null)
  const [form, setForm] = React.useState<RobotForm>(() => toForm())
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<AiRobot | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const load = React.useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      setRobots(await getAiRobots(appId))
    } catch (error) {
      setLoadError(toErrorMessage(error, '加载机器人失败，请稍后重试。'))
    } finally {
      setIsLoading(false)
    }
  }, [appId])

  React.useEffect(() => {
    if (!open) {
      setEditing(null)
      setDeleteTarget(null)
      setDeleteError(null)
      return
    }
    setEditing(startInCreate ? 'new' : null)
    setForm(toForm())
    setFormError(null)
    void load()
  }, [open, startInCreate, load])

  const startCreate = () => {
    setEditing('new')
    setForm(toForm())
    setFormError(null)
    setDeleteTarget(null)
  }

  const startEdit = (robot: AiRobot) => {
    setEditing(robot)
    setForm(toForm(robot))
    setFormError(null)
    setDeleteTarget(null)
  }

  const save = async () => {
    if (!form.name.trim()) {
      setFormError('请输入机器人名称')
      return
    }
    const input = toInput(form)
    if (input.suggestions.some(question => question.length > 100)) {
      setFormError('每条推荐问题不能超过 100 个字符')
      return
    }
    if (input.suggestions.length > MAX_SUGGESTIONS) {
      setFormError(`推荐问题最多 ${MAX_SUGGESTIONS} 条`)
      return
    }
    setIsSaving(true)
    setFormError(null)
    try {
      const editingId = editing === 'new' || editing === null ? undefined : editing.id
      const saved = await saveAiRobot(appId, input, editingId)
      setRobots(previous => editingId ? previous.map(robot => robot.id === saved.id ? saved : robot) : [...previous, saved])
      if (startInCreate && editing === 'new') onOpenChange(false)
      else setEditing(null)
    } catch (error) {
      setFormError(toErrorMessage(error, '保存机器人失败，请稍后重试。'))
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteAiRobot(appId, deleteTarget.id)
      setRobots(previous => previous.filter(robot => robot.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (error) {
      setDeleteError(toErrorMessage(error, '删除机器人失败，请稍后重试。'))
    } finally {
      setIsDeleting(false)
    }
  }

  const firstEnabledId = robots.find(robot => robot.enabled)?.id
  const content = editing !== null ? <div className="space-y-3">
    <div>
      <label htmlFor="ai-robot-name" className="mb-1 block text-sm font-medium">名称</label>
      <Input id="ai-robot-name" value={form.name} maxLength={50} placeholder="例如：数据查询助手"
             onChange={event => setForm({...form, name: event.target.value})}/>
    </div>
    <div>
      <label htmlFor="ai-robot-description" className="mb-1 block text-sm font-medium">描述</label>
      <Input id="ai-robot-description" value={form.description} maxLength={300} placeholder="一句话说明机器人能做什么"
             onChange={event => setForm({...form, description: event.target.value})}/>
    </div>
    <div>
      <label htmlFor="ai-robot-greeting" className="mb-1 block text-sm font-medium">欢迎语</label>
      <Textarea id="ai-robot-greeting" value={form.greeting} maxLength={1000} rows={3}
                onChange={event => setForm({...form, greeting: event.target.value})}/>
    </div>
    <div>
      <label htmlFor="ai-robot-suggestions" className="mb-1 block text-sm font-medium">推荐问题</label>
      <Textarea id="ai-robot-suggestions" value={form.suggestions} rows={4}
                placeholder={`每行一条，最多 ${MAX_SUGGESTIONS} 条`}
                onChange={event => setForm({...form, suggestions: event.target.value})}/>
      <p className="mb-0 mt-1 text-xs text-muted-foreground">每行一条，最多 {MAX_SUGGESTIONS} 条，每条不超过 100
        个字符。</p>
    </div>
    <div>
      <label htmlFor="ai-robot-prompt" className="mb-1 block text-sm font-medium">角色提示词</label>
      <Textarea id="ai-robot-prompt" value={form.prompt} maxLength={4000} rows={3}
                placeholder="描述机器人应如何回答当前应用的业务问题"
                onChange={event => setForm({...form, prompt: event.target.value})}/>
    </div>
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={form.enabled} onCheckedChange={checked => setForm({...form, enabled: Boolean(checked)})}/>
      启用该机器人
    </label>
    {formError ? <p role="alert" className="m-0 text-sm text-destructive">{formError}</p> : null}
  </div> : <div className="space-y-3">
    <div className="flex items-start justify-between gap-3">
      <p className="m-0 text-sm text-muted-foreground">
        机器人用于应用内的 AI 对话，可绑定到菜单页面或工作台组件，也会出现在顶部 AI 助手中。
      </p>
      <Button size="sm" onClick={startCreate}><Plus className="h-4 w-4"/>新建机器人</Button>
    </div>
    {isLoading ? <AppLoading center className="min-h-[160px]"/> : loadError ?
      <div className="rounded-lg border p-4 text-sm">
        <p role="alert" className="m-0 text-destructive">{loadError}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>重试</Button>
      </div> : robots.length === 0 ? <div className="rounded-lg border p-6 text-center">
        <Bot className="mx-auto h-8 w-8 text-muted-foreground"/>
        <p className="mb-1 mt-3 text-sm font-medium">还没有对话机器人</p>
        <p className="m-0 text-xs text-muted-foreground">创建后即可在 AI 助手、菜单页面和工作台组件中使用。</p>
        <Button size="sm" className="mt-4" onClick={startCreate}><Plus className="h-4 w-4"/>创建机器人</Button>
      </div> : <div className="space-y-2">
        {robots.map(robot => <div key={robot.id} className="rounded-lg border p-3">
          <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4 w-4"/>
          </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{robot.name}</span>
                {firstEnabledId === robot.id ? <Badge className="bg-primary/10 text-primary">默认</Badge> : null}
                <Badge className={robot.enabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'}>
                  {robot.enabled ? '已启用' : '已停用'}
                </Badge>
              </div>
              <p
                className="mb-0 mt-0.5 line-clamp-1 text-xs text-muted-foreground">{robot.description || '暂无描述'}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" title="编辑机器人"
                      onClick={() => startEdit(robot)}>
                <Pencil className="h-4 w-4"/>
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="删除机器人"
                      onClick={() => {
                        setDeleteTarget(robot);
                        setDeleteError(null)
                      }}>
                <Trash2 className="h-4 w-4"/>
              </Button>
            </div>
          </div>
          {deleteTarget?.id === robot.id ?
            <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
              <p className="m-0">确认删除机器人「{robot.name}」？该机器人的会话将一并删除。</p>
              {deleteError ? <p role="alert" className="m-0 mt-1 text-destructive">{deleteError}</p> : null}
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" disabled={isDeleting}
                        onClick={() => setDeleteTarget(null)}>取消</Button>
                <Button variant="danger" size="sm" disabled={isDeleting} onClick={() => void remove()}>
                  {isDeleting ? '删除中…' : '删除'}
                </Button>
              </div>
            </div> : null}
        </div>)}
      </div>}
  </div>

  return <BizDialog
    open={open}
    onOpenChange={next => {
      if (!isSaving && !isDeleting) onOpenChange(next)
    }}
    title={editing !== null ? (editing === 'new' ? '新建机器人' : '编辑机器人') : 'AI 对话机器人'}
    width={620}
    footer={editing !== null ? <>
      <Button variant="secondary" disabled={isSaving} onClick={() => {
        if (startInCreate && editing === 'new') onOpenChange(false)
        else setEditing(null)
      }}>取消</Button>
      <Button onClick={() => void save()} disabled={isSaving || !form.name.trim()}>
        {isSaving ? '保存中…' : '保存'}
      </Button>
    </> : <Button variant="secondary" onClick={() => onOpenChange(false)}>关闭</Button>}
  >
    {content}
  </BizDialog>
}

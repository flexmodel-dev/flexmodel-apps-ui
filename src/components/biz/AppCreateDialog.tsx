import * as React from 'react'
import {Check, Database, Loader2, RefreshCw, Sparkles} from 'lucide-react'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {BizDialog} from '@/components/ui/dialog'
import {AppPrimaryColorPicker} from '@/components/biz/AppPrimaryColorPicker'
import {IconPicker} from '@/components/biz/IconPicker'
import {type AppIconName, appIcons} from '@/data/appIcons'
import {type App, createApp} from '@/services/apps'
import type {AppPackagePreview} from '@/services/appPackages'
import {type AppTemplateSummary, instantiateAppTemplate, listAppTemplates} from '@/services/appTemplates'
import {type AppPrimaryColor} from '@/theme/appPrimaryColors'
import {AI_BUILDER_ROBOT} from '@/services/ai'
import {cn, toErrorMessage} from '@/lib/utils'

type CreateMode = 'blank' | 'template' | 'ai'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 模板目录为空时隐藏「从模板创建」方式。 */
  templateEnabled: boolean
  onCreated: (app: App) => void
  /** 模板已实例化为预导入计划，交由导入弹窗继续确认。 */
  onTemplateReady: (preview: AppPackagePreview, name: string) => void
  /** 选择 AI 创建后，把输入内容带入右侧 AI 助手面板继续生成方案。 */
  onAiCreate: (prompt: string) => void
}

export function AppCreateDialog({
                                  open,
                                  onOpenChange,
                                  templateEnabled,
                                  onCreated,
                                  onTemplateReady,
                                  onAiCreate,
                                }: Props) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [iconName, setIconName] = React.useState<AppIconName>('Boxes')
  const [primaryColor, setPrimaryColor] = React.useState<AppPrimaryColor>('blue')
  const [mode, setMode] = React.useState<CreateMode>('ai')
  const [aiPrompt, setAiPrompt] = React.useState('')
  const [templates, setTemplates] = React.useState<AppTemplateSummary[] | null>(null)
  const [templateId, setTemplateId] = React.useState('')
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)
  const [templateError, setTemplateError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setName('')
    setDescription('')
    setIconName('Boxes')
    setPrimaryColor('blue')
    setMode('ai')
    setAiPrompt('')
    setTemplates(null)
    setTemplateId('')
    setIsLoadingTemplates(false)
    setTemplateError('')
    setBusy(false)
    setError('')
  }, [open])

  const modes: Array<{ value: CreateMode; title: string; detail: string }> = [
    {value: 'ai', title: 'AI 创建应用', detail: '描述业务需求，由 AI 搭建应用'},
    {value: 'blank', title: '空白应用', detail: '从菜单与表单开始搭建'},
    ...(templateEnabled
      ? [{value: 'template' as const, title: '从模板创建', detail: '使用内置模板快速开始'}]
      : []),
  ]

  const loadTemplates = async () => {
    setIsLoadingTemplates(true)
    setTemplateError('')
    try {
      setTemplates(await listAppTemplates())
    } catch (caught) {
      setTemplates(null)
      setTemplateError(toErrorMessage(caught, '加载应用模板失败，请稍后重试。'))
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const selectMode = (next: CreateMode) => {
    if (busy) return
    setMode(next)
    setError('')
    if (next === 'template' && templates === null && !isLoadingTemplates) void loadTemplates()
  }

  const selectTemplate = (id: string) => {
    setTemplateId(id)
    const template = templates?.find(item => item.id === id)
    if (template) setName(current => (current.trim() ? current : template.name))
  }

  const canSubmit = mode === 'ai'
    ? Boolean(aiPrompt.trim()) && !busy
    : Boolean(name.trim()) && !busy && (mode === 'blank' || Boolean(templateId))

  const submit = async () => {
    if (!canSubmit) return
    if (mode === 'ai') {
      onAiCreate(aiPrompt.trim())
      onOpenChange(false)
      return
    }
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'blank') {
        const created = await createApp({
          name: trimmed,
          description: description.trim(),
          iconName,
          primaryColor,
        })
        onCreated(created)
      } else {
        const preview = await instantiateAppTemplate(templateId)
        onTemplateReady(preview, trimmed)
      }
      onOpenChange(false)
    } catch (caught) {
      setError(toErrorMessage(caught, mode === 'blank' ? '创建应用失败，请稍后重试。' : '模板预处理失败，请稍后重试。'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <BizDialog
      open={open}
      onOpenChange={next => {
        if (!busy) onOpenChange(next)
      }}
      title="新建应用"
      width={720}
      height={mode === 'ai' ? 'min(86vh, 720px)' : undefined}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : null}
            {busy ? '处理中…' : mode === 'ai' ? <><Sparkles className="h-4 w-4"/>打开 AI
              助手</> : mode === 'blank' ? '创建' : '预览并创建'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <span className="mb-1 block text-sm font-medium text-foreground">创建方式</span>
          <div className={cn('grid gap-3', modes.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
            {modes.map(item => (
              <button
                key={item.value}
                type="button"
                disabled={busy}
                aria-pressed={mode === item.value}
                onClick={() => selectMode(item.value)}
                className={cn(
                  'rounded-lg border p-4 text-left transition-colors',
                  mode === item.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60 hover:bg-accent/40',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {item.value === 'ai' ? <Sparkles className="h-4 w-4 text-primary"/> : null}
                  {item.title}
                </span>
                <span className="mt-2 block text-xs leading-5 text-muted-foreground">{item.detail}</span>
              </button>
            ))}
          </div>
        </div>

        {mode !== 'ai' ? (
          <div>
            <label htmlFor="create-app-name" className="mb-1 block text-sm font-medium text-foreground">应用名称</label>
            <Input
              id="create-app-name"
              value={name}
              maxLength={100}
              disabled={busy}
              autoFocus
              placeholder="例如：客户管理"
              onChange={event => setName(event.target.value)}
            />
          </div>
        ) : null}

        {mode === 'blank' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="create-app-icon"
                     className="mb-1 block text-sm font-medium text-foreground">应用图标</label>
              <div id="create-app-icon">
                <IconPicker value={iconName} onChange={setIconName}/>
              </div>
            </div>
            <div>
              <label htmlFor="create-app-description"
                     className="mb-1 block text-sm font-medium text-foreground">应用描述</label>
              <Input
                id="create-app-description"
                value={description}
                maxLength={500}
                disabled={busy}
                placeholder="请输入应用描述"
                onChange={event => setDescription(event.target.value)}
              />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-foreground">应用主色</span>
              <AppPrimaryColorPicker value={primaryColor} onChange={setPrimaryColor}/>
            </div>
          </div>
        ) : null}

        {mode === 'ai' ? (
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4"/>
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-sm font-medium">应用搭建助手</p>
                  <p className="mb-0 mt-1 text-sm leading-6 text-muted-foreground">
                    你好，描述你想管理的业务、需要记录的信息和希望完成的工作，我会帮你创建应用并完善表单、工作台与导航。
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col items-start gap-2">
                {AI_BUILDER_ROBOT.suggestions.map(question => (
                  <Button key={question} type="button" variant="outline" size="sm"
                          className="h-auto whitespace-normal py-2 text-left font-normal"
                          disabled={busy}
                          onClick={() => setAiPrompt(question)}>
                    {question}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="create-app-ai-prompt"
                     className="mb-1 block text-sm font-medium text-foreground">需求描述</label>
              <Textarea
                id="create-app-ai-prompt"
                value={aiPrompt}
                rows={4}
                maxLength={4000}
                autoFocus
                disabled={busy}
                placeholder="例如：帮我搭建一个客户跟进管理应用，记录客户联系人和跟进情况"
                onChange={event => setAiPrompt(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    if (canSubmit) void submit()
                  }
                }}
              />
              <p className="mb-0 mt-1 text-xs text-muted-foreground">按 Enter 打开右侧 AI 助手继续完善，Shift + Enter
                换行。</p>
            </div>
          </div>
        ) : null}

        {templateEnabled && mode === 'template' ? (
          <div>
            <span className="mb-1 block text-sm font-medium text-foreground">选择模板</span>
            {isLoadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin"/> 正在加载模板…
              </div>
            ) : templateError ? (
              <div role="alert"
                   className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <span>{templateError}</span>
                <Button variant="secondary" size="sm" onClick={() => void loadTemplates()}>
                  <RefreshCw className="h-4 w-4"/> 重试
                </Button>
              </div>
            ) : templates && templates.length === 0 ? (
              <p className="mb-0 text-sm text-muted-foreground">暂无内置模板。</p>
            ) : (
              <div className="space-y-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(templates ?? []).map(template => {
                    const Icon = appIcons[(template.iconName ?? '') as AppIconName] ?? appIcons.Boxes
                    const selected = templateId === template.id
                    return (
                      <button
                        key={template.id}
                        type="button"
                        disabled={busy}
                        aria-pressed={selected}
                        onClick={() => selectTemplate(template.id)}
                        className={cn(
                          'flex min-w-0 flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                          selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60 hover:bg-accent/40',
                        )}
                      >
                        <span className="flex w-full min-w-0 items-start gap-3">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Icon className="h-5 w-5"/>
                          </span>
                          <span className="min-w-0 flex-1 space-y-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{template.name}</span>
                              {template.category
                                ? <Badge className="bg-muted text-muted-foreground">{template.category}</Badge>
                                : null}
                            </span>
                            <span className="line-clamp-2 block break-words text-xs leading-5 text-muted-foreground">
                              {template.description || '暂无描述'}
                            </span>
                          </span>
                          {selected ? <Check className="h-4 w-4 shrink-0 text-primary"/> : null}
                        </span>
                        <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{template.formCount} 个表单</span>
                          {template.includesData ? (
                            <span className="inline-flex items-center gap-1">
                              <Database className="h-3.5 w-3.5"/>含示例数据
                            </span>
                          ) : null}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="mb-0 text-xs text-muted-foreground">模板用于快速生成初始内容，之后与应用解耦。</p>
              </div>
            )}
          </div>
        ) : null}

        {error ? (
          <div className="text-sm text-destructive" role="alert">{error}</div>
        ) : null}
      </div>
    </BizDialog>
  )
}

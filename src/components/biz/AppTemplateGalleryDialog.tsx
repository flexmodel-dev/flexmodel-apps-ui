import * as React from 'react'
import {Database, Loader2, RefreshCw} from 'lucide-react'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {BizDialog} from '@/components/ui/dialog'
import {Empty} from '@/components/ui/empty'
import {AppLoading} from '@/components/biz/AppLoading'
import {type AppIconName, appIcons} from '@/data/appIcons'
import {cn, toErrorMessage} from '@/lib/utils'
import type {AppPackagePreview} from '@/services/appPackages'
import {type AppTemplateSummary, instantiateAppTemplate, listAppTemplates} from '@/services/appTemplates'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 模板预览已就绪，交由导入弹窗继续确认与提交。 */
  onReady: (preview: AppPackagePreview) => void
}

export function AppTemplateGalleryDialog({open, onOpenChange, onReady}: Props) {
  const [templates, setTemplates] = React.useState<AppTemplateSummary[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [error, setError] = React.useState('')

  const load = React.useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setTemplates(await listAppTemplates())
    } catch (caught) {
      setTemplates([])
      setError(toErrorMessage(caught, '加载应用模板失败，请稍后重试。'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) void load()
  }, [open, load])

  const select = async (template: AppTemplateSummary) => {
    if (busyId) return
    setError('')
    setBusyId(template.id)
    try {
      onReady(await instantiateAppTemplate(template.id))
    } catch (caught) {
      setError(toErrorMessage(caught, '模板预处理失败，请稍后重试。'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <BizDialog
      open={open}
      onOpenChange={next => {
        if (!busyId) onOpenChange(next)
      }}
      title="从模板创建应用"
      width={900}
      height="min(84vh, 760px)"
      footer={<Button variant="secondary" disabled={Boolean(busyId)} onClick={() => onOpenChange(false)}>取消</Button>}
    >
      <div className="space-y-4">
        {error ? (
          <div role="alert"
               className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4"/> 重试
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <AppLoading center className="min-h-[240px]"/>
        ) : templates.length === 0 && !error ? (
          <Empty description="暂无内置模板"/>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map(template => {
              const Icon = appIcons[(template.iconName ?? '') as AppIconName] ?? appIcons.Boxes
              const busy = busyId === template.id
              return (
                <button
                  key={template.id}
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={() => void select(template)}
                  className={cn(
                    'flex h-full min-w-0 flex-col items-start gap-3 rounded-lg border bg-background p-4 text-left transition-colors',
                    busyId ? 'opacity-60' : 'hover:border-primary/60 hover:bg-accent/40',
                    busyId && !busy ? 'cursor-not-allowed' : 'cursor-pointer',
                  )}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {busy ? <Loader2 className="h-5 w-5 animate-spin"/> : <Icon className="h-6 w-6"/>}
                  </span>
                  <span className="min-w-0 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-medium text-foreground">{template.name}</span>
                      {template.category
                        ? <Badge className="bg-muted text-muted-foreground">{template.category}</Badge>
                        : null}
                    </span>
                    <span className="line-clamp-3 block break-words text-sm leading-5 text-muted-foreground">
                      {template.description || '暂无描述'}
                    </span>
                  </span>
                  <span className="mt-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
        )}

        <p className="mb-0 text-xs text-muted-foreground">
          选择模板后进入预览确认，可修改应用名称后再创建；模板是一次性脚手架，不会随模板更新而变化。
        </p>
      </div>
    </BizDialog>
  )
}

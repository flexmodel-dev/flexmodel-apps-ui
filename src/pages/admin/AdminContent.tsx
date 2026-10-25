import * as React from 'react'
import { Link } from 'react-router-dom'
import {ChevronRight, Plus, Table2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {BizDialog} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {AppLoading} from '@/components/biz/AppLoading'
import {Empty} from '@/components/ui/empty'
import {createAppForm, getAppForms, type AppForm} from '@/services/appForms'
import {toErrorMessage} from '@/lib/utils'
import {Checkbox} from '@/components/ui/checkbox'

interface FormCreateDraft {
  label: string
  name: string
  description: string
  createDisplayField: boolean
}

const emptyFormDraft: FormCreateDraft = {
  label: '',
  name: '',
  description: '',
  createDisplayField: true,
}

export function FormManagementContent({appId}: { appId?: string }) {
  const [forms, setForms] = React.useState<AppForm[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createDraft, setCreateDraft] = React.useState(emptyFormDraft)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const loadForms = React.useCallback(() => {
    if (!appId) {
      setForms([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getAppForms(appId)
      .then((loadedForms) => !cancelled && setForms(loadedForms))
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(toErrorMessage(caught, '加载表单失败'))
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId])

  React.useEffect(() => loadForms(), [loadForms])

  const submitCreate = async () => {
    if (!appId || !createDraft.label.trim() || !createDraft.name.trim()) return
    setIsSubmitting(true)
    try {
      await createAppForm(appId, {
        label: createDraft.label.trim(),
        name: createDraft.name.trim(),
        description: createDraft.description.trim(),
        createDisplayField: createDraft.createDisplayField,
      })
      setCreateOpen(false)
      setCreateDraft(emptyFormDraft)
      loadForms()
    } catch (caught) {
      setError(toErrorMessage(caught, '创建表单失败'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4" id="businessObjectList">
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="mb-0 text-xs text-muted-foreground">{isLoading ? '正在加载表单…' : `共 ${forms.length} 个表单`}</p>
          <Button onClick={() => { setError(null); setCreateOpen(true) }}><Plus className="h-4 w-4"/>新建表单</Button>
        </div>
        {isLoading ? (
          <AppLoading className="min-h-[160px]"/>
        ) : error ? (
          <Empty description={error}/>
        ) : (
          forms.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {forms.map((form) => (
              <Link
                key={form.name}
                to={`/admin/apps/${appId}/forms/${encodeURIComponent(form.name)}/${form.builtin ? 'form-design' : 'base'}`}
                aria-label={form.label}
                className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2 text-muted-foreground"><Table2 className="h-5 w-5"/></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{form.label}</span>
                      {form.builtin && <Badge className="bg-muted text-muted-foreground">内置</Badge>}
                    </div>
                    <p className="mb-0 mt-1 truncate font-mono text-xs text-muted-foreground">{form.name}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"/>
                </div>
                <p className="mb-0 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">{form.description || '暂无描述'}</p>
                <div className="mt-auto border-t pt-3 text-xs text-muted-foreground">{form.fields.length} 个字段</div>
              </Link>
            ))}
          </div> : <Empty description="暂无表单，点击新建表单开始配置。"/>
        )}
      </div>
      <BizDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建表单"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>取消</Button>
            <Button onClick={submitCreate}
                    disabled={!createDraft.label.trim() || !createDraft.name.trim() || isSubmitting}>
              {isSubmitting ? '创建中...' : '创建'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="form-label" className="mb-1 block text-sm font-medium text-foreground">表单名称</label>
            <Input
              id="form-label"
              value={createDraft.label}
              maxLength={100}
              onChange={(event) => setCreateDraft({...createDraft, label: event.target.value})}
            />
          </div>
          <div>
            <label htmlFor="form-name" className="mb-1 block text-sm font-medium text-foreground">内部标识</label>
            <Input
              id="form-name"
              value={createDraft.name}
              maxLength={64}
              placeholder="例如 customer"
              onChange={(event) => setCreateDraft({...createDraft, name: event.target.value})}
            />
          </div>
          <div>
            <label htmlFor="form-description" className="mb-1 block text-sm font-medium text-foreground">描述</label>
            <Input
              id="form-description"
              value={createDraft.description}
              maxLength={500}
              onChange={(event) => setCreateDraft({...createDraft, description: event.target.value})}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={createDraft.createDisplayField}
              onCheckedChange={checked => setCreateDraft({...createDraft, createDisplayField: checked === true})}
            />
            创建主显字段
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
      </BizDialog>
    </div>
  )
}

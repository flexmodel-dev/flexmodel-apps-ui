import * as React from 'react'
import { Link } from 'react-router-dom'
import { CirclePlus } from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {BizDialog} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {AppLoading} from '@/components/biz/AppLoading'
import {Empty} from '@/components/ui/empty'
import {createAppForm, getAppForms, type AppForm} from '@/services/appForms'
import {toErrorMessage} from '@/lib/utils'

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
    <div className="row -mx-2.5" id="businessObjectList">
      <div className="new-business-object mb-5 w-full px-2.5">
        <h3 className="mb-4 text-base font-normal text-muted-foreground">表单管理</h3>
        {isLoading ? (
          <AppLoading className="min-h-[160px]"/>
        ) : error ? (
          <Empty description={error}/>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4 xl:grid-cols-6">
            {forms.map((form) => (
              <Link
                key={form.name}
                to={`/admin/apps/${appId}/forms/${encodeURIComponent(form.name)}/${form.builtin ? 'form-design' : 'base'}`}
                className="block rounded-md border bg-card transition-colors hover:bg-accent"
              >
                <div className="card-body p-3">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{form.label}</span>
                    {form.builtin && <Badge className="bg-muted text-muted-foreground">内置</Badge>}
                  </div>
                  <p className="mb-0 mt-0.5 truncate text-xs text-muted-foreground">
                    {form.description || form.name}
                  </p>
                </div>
              </Link>
            ))}
            <a
              className="block cursor-pointer rounded-md border border-dashed border-input transition-colors hover:border-primary"
              onClick={() => setCreateOpen(true)}
            >
              <div className="card-body p-3 pt-1 text-center">
                <CirclePlus className="h-6 w-6 text-primary"/>
                <span className="mt-1 block text-xs text-muted-foreground">新建表单</span>
              </div>
            </a>
          </div>
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
            <input
              type="checkbox"
              checked={createDraft.createDisplayField}
              onChange={(event) => setCreateDraft({...createDraft, createDisplayField: event.target.checked})}
            />
            创建主显字段
          </label>
        </div>
      </BizDialog>
    </div>
  )
}

import * as React from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {Pencil, Trash2} from 'lucide-react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {BizDialog, ConfirmDialog} from '@/components/ui/dialog'
import {Empty} from '@/components/ui/empty'
import {AppLoading} from '@/components/biz/AppLoading'
import {Badge} from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  deleteAppForm,
  getAppForm,
  updateAppForm,
  type AppForm,
} from '@/services/appForms'
import {toErrorMessage} from '@/lib/utils'
import {SettingsPageHeader} from '@/components/biz/SettingsPageHeader'
import {FormSettingsNav, formSettingsBackPath} from '@/components/biz/FormSettingsNav'

import ApprovalList from './Approvals/ApprovalList'

const sections = {
  base: '基本信息',
  flows: '工作流',
} as const

export type FormSettingsSection = keyof typeof sections

export default function FormSettings({section}: { section: FormSettingsSection }) {
  const {appId = '', formName = ''} = useParams<{ appId: string; formName: string }>()
  const navigate = useNavigate()
  const backPath = formSettingsBackPath(appId, formName)
  const backLabel = appId === 'system' ? '返回系统管理' : '返回表单列表'
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [baseDraft, setBaseDraft] = React.useState({label: '', description: '', displayField: ''})
  const [baseOpen, setBaseOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const loadForm = React.useCallback(() => {
    if (!appId || !formName) {
      setForm(null)
      setIsLoading(false)
      setError('缺少应用或表单标识。')
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getAppForm(appId, formName)
      .then((loadedForm) => {
        if (cancelled) return
        setForm(loadedForm)
        setBaseDraft({
          label: loadedForm.label,
          description: loadedForm.description,
          displayField: loadedForm.displayField ?? '',
        })
      })
      .catch((caught) => {
        if (cancelled) return
        setForm(null)
        setError(toErrorMessage(caught, '加载表单失败'))
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, formName])

  React.useEffect(() => loadForm(), [loadForm])

  if (isLoading || !form) {
    return (
      <AdminLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
          <SettingsPageHeader title={sections[section]} onBack={() => navigate(backPath)} backLabel={backLabel}>
            <FormSettingsNav appId={appId} formName={formName} mobile/>
          </SettingsPageHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? <AppLoading center className="min-h-[240px]"/> : <Empty description={error ?? '表单不存在。'}/>}
          </div>
        </div>
      </AdminLayout>
    )
  }

  const displayFieldOptions = form.fields.filter((field) => !field.builtin)

  const saveBase = async () => {
    if (!baseDraft.label.trim()) return
    setIsSubmitting(true)
    try {
      const updatedForm = await updateAppForm(appId, form.name, {
        label: baseDraft.label.trim(),
        description: baseDraft.description.trim(),
        displayField: baseDraft.displayField || null,
      })
      setForm(updatedForm)
      setBaseOpen(false)
    } catch (caught) {
      setError(toErrorMessage(caught, '保存表单失败'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeForm = async () => {
    setIsSubmitting(true)
    try {
      await deleteAppForm(appId, form.name)
      setDeleteOpen(false)
      navigate(backPath)
    } catch (caught) {
      setError(toErrorMessage(caught, '删除表单失败'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <SettingsPageHeader title={`${sections[section]}`}
                            description={section === 'base' ? '管理表单信息与主显字段。' : '管理绑定本表单的手动和数据事件工作流。定时流程在应用设置中管理。'}
          onBack={() => navigate(backPath)} backLabel={backLabel}
          badge={form.builtin && <Badge className="bg-muted text-muted-foreground">内置</Badge>}
          actions={<>
            {section === 'base' && (
              <Button onClick={() => { setError(null); setBaseOpen(true) }}>
                <Pencil className="h-4 w-4"/> 编辑信息
              </Button>
            )}
          </>}>
          <FormSettingsNav appId={appId} formName={formName} mobile/>
        </SettingsPageHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {section === 'base' ? (
            <div className="space-y-8 p-4 sm:p-6">
              <section>
                <h2 className="mb-5 text-sm font-semibold">表单信息</h2>
                <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">表单名称</dt><dd className="mt-2 break-words text-sm font-medium">{form.label}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">内部标识</dt><dd className="mt-2 break-all font-mono text-sm">{form.name}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">主显字段</dt><dd className="mt-2 text-sm">{form.fields.find(field => field.name === form.displayField)?.label ?? form.displayField ?? '未设置'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">字段数量</dt><dd className="mt-2 text-sm">{form.fields.length} 个</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">描述</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{form.description || '暂无描述'}</dd></div>
                </dl>
              </section>
              <section className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
                <div><h2 className="text-sm font-medium">删除表单</h2><p className="mb-0 mt-1 text-xs text-muted-foreground">删除后，表单及其字段和记录将无法恢复。</p></div>
                <Button variant="outline" className="text-destructive dark:text-destructive-foreground" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4"/>删除表单</Button>
              </section>
            </div>
          ) : (
            <div className="h-full p-4 sm:p-6"><ApprovalList appId={appId} boundFormName={formName}/></div>
          )}
        </div>
      </div>

      <BizDialog
        open={baseOpen}
        onOpenChange={setBaseOpen}
        title="编辑表单"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBaseOpen(false)} disabled={isSubmitting}>取消</Button>
            <Button onClick={saveBase} disabled={!baseDraft.label.trim() || isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">表单名称</label>
            <Input
              value={baseDraft.label}
              maxLength={100}
              onChange={(event) => setBaseDraft({...baseDraft, label: event.target.value})}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">内部标识</label>
            <Input value={form.name} disabled/>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">主显字段</label>
            <Select
              value={baseDraft.displayField}
              onValueChange={(displayField) => setBaseDraft({...baseDraft, displayField})}
              disabled={!displayFieldOptions.length}
            >
              <SelectTrigger>
                <SelectValue placeholder={displayFieldOptions.length ? '请选择主显字段' : '暂无可选字段'}/>
              </SelectTrigger>
              <SelectContent>
                {displayFieldOptions.map((field) => (
                  <SelectItem key={field.name} value={field.name}>{field.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">描述</label>
            <Input
              value={baseDraft.description}
              maxLength={500}
              onChange={(event) => setBaseDraft({...baseDraft, description: event.target.value})}
            />
          </div>
        </div>
      </BizDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除表单"
        message={`确认删除表单「${form.label}」吗？`}
        busy={isSubmitting}
        confirmText="删除"
        onConfirm={removeForm}
      />
    </AdminLayout>
  )
}

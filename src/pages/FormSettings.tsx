import * as React from 'react'
import {useAppDataRevision} from '@/lib/useAppDataRevision'
import {useNavigate, useParams} from 'react-router-dom'
import {Pencil, Plus, Trash2} from 'lucide-react'
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
  createAppFormField,
  deleteAppForm,
  deleteAppFormField,
  getAppForm,
  getAppForms,
  updateAppForm,
  updateAppFormField,
  type AppFormField,
  type AppFormFieldType,
  type AppForm,
} from '@/services/appForms'
import {toErrorMessage} from '@/lib/utils'
import {FieldConfigEditor} from '@/components/biz/FieldConfigEditor'
import type {AppFieldConfig, AppFormFieldOption} from '@/services/appForms'
import {SettingsPageHeader} from '@/components/biz/SettingsPageHeader'
import {FormSettingsNav, formSettingsBackPath} from '@/components/biz/FormSettingsNav'
import {Checkbox} from '@/components/ui/checkbox'

const sections = {
  base: '基本信息',
  fields: '字段管理',
} as const

const fieldTypes: Array<{ type: AppFormFieldType; label: string }> = [
  {type: 'TEXT', label: '单行文本'},
  {type: 'NTEXT', label: '多行文本'},
  {type: 'PHONE', label: '电话'},
  {type: 'EMAIL', label: '邮箱'},
  {type: 'URL', label: '链接'},
  {type: 'SERIES', label: '自动编号'},
  {type: 'PICKLIST', label: '下拉列表'},
  {type: 'SELECT', label: '列表'},
  {type: 'NUMBER', label: '整数'},
  {type: 'DECIMAL', label: '小数'},
  {type: 'DATE', label: '日期'},
  {type: 'DATETIME', label: '日期时间'},
  {type: 'TIME', label: '时间'},
  {type: 'CLASSIFICATION', label: '分类'},
  {type: 'MULTISELECT', label: '多选'},
  {type: 'TAG', label: '标签'},
  {type: 'REFERENCE', label: '引用'},
  {type: 'FILE', label: '附件'},
  {type: 'IMAGE', label: '图片'},
  {type: 'AVATAR', label: '头像'},
  {type: 'BARCODE', label: '二维码'},
  {type: 'LOCATION', label: '位置'},
  {type: 'SIGN', label: '签名'},
  {type: 'BOOL', label: '布尔'},
  {type: 'STATE', label: '状态'},
]

const fieldTypeLabels = Object.fromEntries(fieldTypes.map((field) => [field.type, field.label]))

interface FieldDraft {
  name?: string
  label: string
  type: AppFormFieldType
  required: boolean
  referenceForm?: string
  config?: AppFieldConfig
  options?: AppFormFieldOption[]
}

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
  const [fieldDraft, setFieldDraft] = React.useState<FieldDraft | null>(null)
  const [fieldDelete, setFieldDelete] = React.useState<AppFormField | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [availableForms, setAvailableForms] = React.useState<AppForm[]>([])
  const formRevision = useAppDataRevision(appId, ['form'], formName)
  const formsRevision = useAppDataRevision(appId, ['form'])
  const editing = baseOpen || fieldDraft !== null || fieldDelete !== null || isSubmitting

  React.useEffect(() => {
    setForm(null)
    setIsLoading(true)
    setBaseOpen(false)
    setFieldDraft(null)
    setFieldDelete(null)
  }, [appId, formName])

  const loadForm = React.useCallback((background = false) => {
    if (!appId || !formName) {
      setForm(null)
      setIsLoading(false)
      setError('缺少应用或表单标识。')
      return
    }
    let cancelled = false
    if (!background) setIsLoading(true)
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

  React.useEffect(() => {
    if (!editing) return loadForm(true)
  }, [loadForm, formRevision, editing])

  React.useEffect(() => {
    if (!appId) {
      setAvailableForms([])
      return
    }
    let cancelled = false
    getAppForms(appId)
      .then((forms) => {
        if (!cancelled) setAvailableForms(forms)
      })
      .catch(() => {
        if (!cancelled) setAvailableForms([])
      })
    return () => {
      cancelled = true
    }
  }, [appId, formsRevision])

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

  const saveField = async () => {
    if (!fieldDraft || !fieldDraft.label.trim()) return
    if (fieldDraft.type === 'REFERENCE' && !fieldDraft.referenceForm) return
    setError(null)
    setIsSubmitting(true)
    try {
      if (fieldDraft.name) {
        const updatedField = await updateAppFormField(appId, form.name, fieldDraft.name, {
          label: fieldDraft.label.trim(),
          required: fieldDraft.required,
          referenceForm: fieldDraft.referenceForm,
          config: fieldDraft.config ?? {},
          options: fieldDraft.options,
        })
        setForm({
          ...form,
          fields: form.fields.map((field) => field.name === updatedField.name ? updatedField : field),
        })
      } else {
        const createdField = await createAppFormField(appId, form.name, {
          label: fieldDraft.label.trim(),
          type: fieldDraft.type,
          required: fieldDraft.required,
          referenceForm: fieldDraft.referenceForm,
          config: fieldDraft.config ?? {},
          options: fieldDraft.options,
        })
        setForm({...form, fields: [...form.fields, createdField]})
      }
      setFieldDraft(null)
    } catch (caught) {
      setError(toErrorMessage(caught, '保存字段失败'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeField = async () => {
    if (!fieldDelete) return
    setIsSubmitting(true)
    try {
      await deleteAppFormField(appId, form.name, fieldDelete.name)
      const isNameField = fieldDelete.name === form.displayField
      setForm({
        ...form,
        fields: form.fields.filter((field) => field.name !== fieldDelete.name),
        displayField: isNameField ? null : form.displayField,
        searchField: isNameField ? null : form.searchField,
      })
      setFieldDelete(null)
    } catch (caught) {
      setError(toErrorMessage(caught, '删除字段失败'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <SettingsPageHeader title={`${sections[section]}`}
          description={section === 'base' ? '管理表单信息与主显字段。' : '管理字段类型、默认值与校验规则。'}
          onBack={() => navigate(backPath)} backLabel={backLabel}
          badge={form.builtin && <Badge className="bg-muted text-muted-foreground">内置</Badge>}
          actions={<>
            {section === 'base' && (
              <Button onClick={() => { setError(null); setBaseOpen(true) }}>
                <Pencil className="h-4 w-4"/> 编辑信息
              </Button>
            )}
            {section === 'fields' && (
              <Button onClick={() => { setError(null); setFieldDraft({label: '', type: 'TEXT', required: false}) }}>
                <Plus className="h-4 w-4"/> 新建字段
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
          ) : section === 'fields' ? (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-b bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:px-6">
                <span>{form.fields.length} 个字段</span><span>{form.fields.filter(field => !field.builtin).length} 个业务字段</span><span>{form.fields.filter(field => field.builtin).length} 个内置字段</span>
              </div>
              {form.fields.length ? <ul aria-label="字段列表" className="divide-y">
                {[...form.fields].reverse().map((field) => (
                  <li key={field.name} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{field.label}</span>
                        {field.builtin && <Badge className="shrink-0 whitespace-nowrap bg-muted text-muted-foreground">内置</Badge>}
                        {field.name === form.displayField && <Badge className="shrink-0 whitespace-nowrap bg-primary/10 text-primary">名称</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {field.name} · {fieldTypeLabels[field.type] ?? field.type}
                        {field.referenceForm ? ` · 引用表单：${field.referenceForm}` : ''}
                      </div>
                    </div>
                    <Badge className="shrink-0 whitespace-nowrap bg-muted text-muted-foreground">{field.required ? '必填' : '选填'}</Badge>
                    {!field.builtin && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setError(null); setFieldDraft({
                            name: field.name,
                            label: field.label,
                            type: field.type,
                            required: field.required,
                            referenceForm: field.referenceForm ?? undefined,
                            config: field.config ?? {},
                            options: field.options ?? undefined,
                          }) }}
                        >
                          <Pencil className="h-3.5 w-3.5"/><span className="sr-only sm:not-sr-only">编辑</span>
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive dark:text-destructive-foreground" onClick={() => setFieldDelete(field)}>
                          <Trash2 className="h-3.5 w-3.5"/><span className="sr-only sm:not-sr-only">删除</span>
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul> : <Empty description="暂无字段，点击右上角新建字段开始配置。"/>}
            </>
          ) : (
            <Empty description={`${sections[section]}功能开发中`}/>
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

      <BizDialog
        open={Boolean(fieldDraft)}
        onOpenChange={(open) => !open && setFieldDraft(null)}
        title={fieldDraft?.name ? '编辑字段' : '新建字段'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFieldDraft(null)} disabled={isSubmitting}>取消</Button>
            <Button
              onClick={saveField}
              disabled={!fieldDraft?.label.trim()
                || (fieldDraft?.type === 'REFERENCE' && !fieldDraft.referenceForm)
                || isSubmitting}
            >
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </>
        }
      >
        {fieldDraft && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">字段名称</label>
              <Input
                value={fieldDraft.label}
                maxLength={100}
                onChange={(event) => setFieldDraft({...fieldDraft, label: event.target.value})}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">字段类型</label>
              <Select
                value={fieldDraft.type}
                onValueChange={(type) => setFieldDraft({
                  ...fieldDraft,
                  type: type as AppFormFieldType,
                  referenceForm: type === 'REFERENCE' ? fieldDraft.referenceForm : undefined,
                  config: {},
                  options: undefined,
                })}
                disabled={Boolean(fieldDraft.name)}
              >
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {fieldTypes.map((fieldType) => (
                    <SelectItem key={fieldType.type} value={fieldType.type}>{fieldType.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {fieldDraft.type === 'REFERENCE' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">引用表单</label>
                <Select
                  value={fieldDraft.referenceForm}
                  onValueChange={(referenceForm) => setFieldDraft({...fieldDraft, referenceForm})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择引用表单"/>
                  </SelectTrigger>
                  <SelectContent>
                    {availableForms.map((item) => (
                      <SelectItem key={item.name} value={item.name}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {fieldDraft.name && (
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">内部标识</label>
                <Input value={fieldDraft.name} disabled/>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={fieldDraft.required}
                onCheckedChange={checked => setFieldDraft({...fieldDraft, required: checked === true})}
              />
              必填
            </label>
            <FieldConfigEditor type={fieldDraft.type} config={fieldDraft.config} options={fieldDraft.options}
              onChange={config => setFieldDraft({...fieldDraft, config})}
              onOptionsChange={options => setFieldDraft({...fieldDraft, options})}/>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </BizDialog>

      <ConfirmDialog
        open={Boolean(fieldDelete)}
        onOpenChange={(open) => !open && setFieldDelete(null)}
        title="删除字段"
        message={`确认删除字段「${fieldDelete?.label}」吗？`}
        busy={isSubmitting}
        confirmText="删除"
        onConfirm={removeField}
      />

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

import * as React from 'react'
import {Link, useNavigate, useParams} from 'react-router-dom'
import {Pencil, Plus, Trash2} from 'lucide-react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {BizDialog} from '@/components/ui/dialog'
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

const sections = {
  base: '基本信息',
  fields: '字段管理',
  'easy-action': '自定义操作',
  'record-alerts': '记录锁定',
  advanced: '高级配置',
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
}

export type FormSettingsSection = keyof typeof sections

export default function FormSettings({section}: { section: FormSettingsSection }) {
  const {appId = '', formName = ''} = useParams<{ appId: string; formName: string }>()
  const navigate = useNavigate()
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
        setError(caught instanceof Error ? caught.message : '加载表单失败')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, formName])

  React.useEffect(() => loadForm(), [loadForm])

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
  }, [appId])

  if (isLoading) {
    return <AdminLayout><AppLoading center className="min-h-[400px]"/></AdminLayout>
  }

  if (!form) {
    return (
      <AdminLayout>
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          {error ?? '表单不存在。'}
          <Link className="ml-1 text-primary hover:underline"
                to={`/admin/apps/${appId}/settings/forms`}>返回表单管理</Link>
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
      setError(caught instanceof Error ? caught.message : '保存表单失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeForm = async () => {
    setIsSubmitting(true)
    try {
      await deleteAppForm(appId, form.name)
      setDeleteOpen(false)
      navigate(`/admin/apps/${appId}/settings/forms`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除表单失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const saveField = async () => {
    if (!fieldDraft || !fieldDraft.label.trim()) return
    if (fieldDraft.type === 'REFERENCE' && !fieldDraft.referenceForm) return
    setIsSubmitting(true)
    try {
      if (fieldDraft.name) {
        const updatedField = await updateAppFormField(appId, form.name, fieldDraft.name, {
          label: fieldDraft.label.trim(),
          required: fieldDraft.required,
          referenceForm: fieldDraft.referenceForm,
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
        })
        setForm({...form, fields: [...form.fields, createdField]})
      }
      setFieldDraft(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存字段失败')
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
      setError(caught instanceof Error ? caught.message : '删除字段失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formPath = (childSection: FormSettingsSection) =>
    `/admin/apps/${appId}/forms/${encodeURIComponent(form.name)}/${childSection}`

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="m-0 text-xl font-semibold text-foreground">{form.label}</h1>
              {form.builtin && <Badge className="bg-muted text-muted-foreground">内置</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{sections[section]}</p>
          </div>
          <div className="flex gap-2">
            {section === 'base' && (
              <>
                <Button variant="secondary" onClick={() => setBaseOpen(true)}>
                  <Pencil className="h-4 w-4"/> 编辑
                </Button>
                <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4"/> 删除
                </Button>
              </>
            )}
            {section === 'fields' && (
              <Button onClick={() => setFieldDraft({label: '', type: 'TEXT', required: false})}>
                <Plus className="h-4 w-4"/> 新建字段
              </Button>
            )}
          </div>
        </div>
        <div className="mt-6 rounded-xl border bg-card">
          {section === 'base' ? (
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">表单名称</div>
                <div className="mt-1 text-sm font-medium">{form.label}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">内部标识</div>
                <div className="mt-1 text-sm font-medium">{form.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">主显字段</div>
                <div className="mt-1 text-sm font-medium">{form.displayField ?? '未设置'}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground">描述</div>
                <div className="mt-1 text-sm">{form.description || '暂无描述'}</div>
              </div>
            </div>
          ) : section === 'fields' ? (
            form.fields.length ? (
              <div className="divide-y">
                {[...form.fields].reverse().map((field) => (
                  <div key={field.name} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{field.label}</span>
                        {field.builtin && <Badge className="bg-muted text-muted-foreground">内置</Badge>}
                        {field.name === form.displayField && <Badge className="bg-primary/10 text-primary">名称</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {field.name} · {fieldTypeLabels[field.type] ?? field.type}
                        {field.referenceForm ? ` · 引用表单：${field.referenceForm}` : ''}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{field.required ? '必填' : '选填'}</span>
                    {!field.builtin && (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setFieldDraft({
                            name: field.name,
                            label: field.label,
                            type: field.type,
                            required: field.required,
                            referenceForm: field.referenceForm ?? undefined,
                          })}
                        >
                          编辑
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setFieldDelete(field)}>
                          删除
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无字段"/>
            )
          ) : (
            <Empty description={`${sections[section]}功能开发中`}/>
          )}
        </div>
        <div className="mt-4 flex gap-2 text-sm">
          {(Object.keys(sections) as FormSettingsSection[]).map((childSection) => (
            <Link
              key={childSection}
              to={formPath(childSection)}
              className={childSection === section
                ? 'font-medium text-primary'
                : 'text-muted-foreground hover:text-primary'}
            >
              {sections[childSection]}
            </Link>
          ))}
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
              <input
                type="checkbox"
                checked={fieldDraft.required}
                onChange={(event) => setFieldDraft({...fieldDraft, required: event.target.checked})}
              />
              必填
            </label>
          </div>
        )}
      </BizDialog>

      <BizDialog
        open={Boolean(fieldDelete)}
        onOpenChange={(open) => !open && setFieldDelete(null)}
        title="删除字段"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFieldDelete(null)} disabled={isSubmitting}>取消</Button>
            <Button variant="danger" onClick={removeField} disabled={isSubmitting}>
              {isSubmitting ? '删除中...' : '删除'}
            </Button>
          </>
        }
      >
        <div className="pt-1">确认删除字段「{fieldDelete?.label}」吗？</div>
      </BizDialog>

      <BizDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除表单"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={isSubmitting}>取消</Button>
            <Button variant="danger" onClick={removeForm} disabled={isSubmitting}>
              {isSubmitting ? '删除中...' : '删除'}
            </Button>
          </>
        }
      >
        <div className="pt-1">确认删除表单「{form.label}」吗？</div>
      </BizDialog>
    </AdminLayout>
  )
}

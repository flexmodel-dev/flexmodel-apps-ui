import * as React from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {Pencil, Plus, Trash2} from 'lucide-react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {SettingsPageHeader} from '@/components/biz/SettingsPageHeader'
import {FormSettingsNav, formSettingsBackPath} from '@/components/biz/FormSettingsNav'
import {DirectoryMemberPicker} from '@/components/rb/DirectoryMemberPicker'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {ConfirmDialog} from '@/components/ui/dialog'
import {BizDrawer} from '@/components/ui/drawer'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {getAppForm, getAppForms, type AppForm, type AppFormField} from '@/services/appForms'
import {
  deleteDataAuthorization,
  emptyControl,
  fromDirectorySelections,
  listDataAuthorizations,
  saveDataAuthorization,
  toDirectorySelections,
  type DataAuthorization,
  type DataAuthorizationInput,
  type FormPermissionControl,
  type PermissionCondition,
  type ScopeType,
} from '@/services/dataAuthorization'
import {toErrorMessage} from '@/lib/utils'

const dynamics: Array<{ type: ScopeType; label: string }> = [
  {type: 'SELF', label: '本人'}, {type: 'DIRECT_REPORTS', label: '直接下级'}, {
    type: 'ALL_REPORTS',
    label: '所有下级'
  }, {type: 'ALL', label: '全部数据'},
]
const operators = {
  EQ: '等于',
  NE: '不等于',
  GT: '大于',
  GE: '大于等于',
  LT: '小于',
  LE: '小于等于',
  IN: '属于',
  NOT_IN: '不属于',
  IS_NULL: '为空',
  IS_NOT_NULL: '不为空'
}
const selectClass = 'h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm'

function ConditionEditor({fields, value, onChange}: {
  fields: AppFormField[];
  value?: PermissionCondition | null;
  onChange: (value: PermissionCondition | null) => void
}) {
  if (!value) return <Button type="button" variant="secondary" size="sm" onClick={() => onChange({
    field: fields[0]?.name ?? '',
    operator: 'EQ',
    value: ''
  })}>添加条件</Button>
  if (value.logic) return <div className="space-y-2 rounded-md border p-3">
    <div className="flex items-center gap-2"><select className={selectClass} aria-label="条件组合方式"
                                                     value={value.logic} onChange={e => onChange({
      ...value,
      logic: e.target.value as 'AND' | 'OR'
    })}>
      <option value="AND">全部满足</option>
      <option value="OR">任一满足</option>
    </select>
      <Button type="button" variant="secondary" size="sm" onClick={() => onChange({
        ...value,
        children: [...(value.children ?? []), {field: fields[0]?.name ?? '', operator: 'EQ', value: ''}]
      })}>添加条件</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>清除</Button></div>
    {value.children?.map((child, index) => <ConditionEditor key={index} fields={fields} value={child}
                                                            onChange={next => {
                                                              const children = next ? value.children!.map((item, i) => i === index ? next : item) : value.children!.filter((_, i) => i !== index)
                                                              onChange(children.length ? {...value, children} : null)
                                                            }}/>)}</div>
  const field = fields.find(item => item.name === value.field)
  const numeric = field?.type === 'NUMBER' || field?.type === 'DECIMAL'
  const isSet = value.operator === 'IN' || value.operator === 'NOT_IN'
  const isNull = value.operator === 'IS_NULL' || value.operator === 'IS_NOT_NULL'
  const choices = numeric || ['DATE', 'DATETIME', 'TIME'].includes(field?.type ?? '') ? Object.entries(operators) : Object.entries(operators).filter(([key]) => !['GT', 'GE', 'LT', 'LE'].includes(key))
  const text = Array.isArray(value.value) ? value.value.join(',') : value.value == null ? '' : String(value.value)
  const convert = (input: string) => field?.type === 'BOOL' ? input === 'true' : numeric && input !== '' ? Number(input) : input
  return <div className="flex flex-wrap items-center gap-2">
    <select aria-label="条件字段" className={selectClass} value={value.field}
            onChange={e => onChange({field: e.target.value, operator: 'EQ', value: ''})}>
      {fields.map(item => <option key={item.name} value={item.name}>{item.label}</option>)}</select>
    <select aria-label="比较方式" className={selectClass} value={value.operator} onChange={e => {
      const operator = e.target.value
      onChange({
        field: value.field,
        operator, ...(!operator.startsWith('IS_') ? {value: operator.endsWith('IN') ? [] : ''} : {})
      })
    }}>{choices.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    {!isNull && (field?.type === 'BOOL' && !isSet ? <select aria-label="比较值" className={selectClass} value={text}
                                                            onChange={e => onChange({
                                                              ...value,
                                                              value: e.target.value === 'true'
                                                            })}>
        <option value="">请选择</option>
        <option value="true">是</option>
        <option value="false">否</option>
      </select>
      : <Input aria-label="比较值" className="w-40" placeholder={isSet ? '多个值用逗号分隔' : '比较值'} value={text}
               onChange={e => onChange({
                 ...value,
                 value: isSet ? e.target.value.split(',').map(item => convert(item.trim())) : convert(e.target.value)
               })}/>)}
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange({
      logic: 'AND',
      children: [value, {field: fields[0]?.name ?? '', operator: 'EQ', value: ''}]
    })}>组合条件</Button>
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>移除</Button>
  </div>
}

export default function FormDataPermissions() {
  const {appId = '', formName = ''} = useParams()
  const navigate = useNavigate()
  const [forms, setForms] = React.useState<AppForm[]>([])
  const [root, setRoot] = React.useState<AppForm>()
  const [rules, setRules] = React.useState<DataAuthorization[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [draft, setDraft] = React.useState<DataAuthorizationInput>()
  const [editingId, setEditingId] = React.useState<string>()
  const [deleteId, setDeleteId] = React.useState<string>()
  const [draftError, setDraftError] = React.useState('')
  const load = React.useCallback(async () => {
    const [form, all, authorizations] = await Promise.all([getAppForm(appId, formName), getAppForms(appId), listDataAuthorizations(appId, formName)])
    setRoot(form);
    setForms(all);
    setRules(authorizations);
  }, [appId, formName])
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError('')
    Promise.all([getAppForm(appId, formName), getAppForms(appId), listDataAuthorizations(appId, formName)])
      .then(([form, all, authorizations]) => {
        if (active) {
          setRoot(form);
          setForms(all);
          setRules(authorizations);
        }
      })
      .catch(caught => {
        if (active) setError(toErrorMessage(caught, '加载数据权限失败'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [appId, formName])
  const targets = root ? [root, ...[...new Set(root.layout.items.filter(item => item.type === 'SUBFORM').map(item => item.formName))]
    .map(name => forms.find(form => form.name === name)).filter((form): form is AppForm => !!form && !form.builtin)] : []
  const edit = (rule?: DataAuthorization) => {
    setEditingId(rule?.id);
    setDraftError('')
    setDraft(rule ? {
        name: rule.name, enabled: rule.enabled, subjects: rule.subjects, dataScope: rule.dataScope,
        controls: targets.map(form => rule.controls.find(control => control.formName === form.name) ?? emptyControl(form.name))
      }
      : {name: '', enabled: true, subjects: [], dataScope: [], controls: targets.map(form => emptyControl(form.name))})
  }
  const patchControl = (form: string, patch: Partial<FormPermissionControl>) => setDraft(current => current && ({
    ...current,
    controls: current.controls.map(control => control.formName === form ? {...control, ...patch} : control)
  }))
  const save = async () => {
    if (!draft) return
    setBusy(true);
    setDraftError('')
    try {
      await saveDataAuthorization(appId, formName, draft, editingId);
      await load();
      setDraft(undefined)
    } catch (caught) {
      setDraftError(toErrorMessage(caught, '保存权限失败'))
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!deleteId) return
    setBusy(true)
    try {
      await deleteDataAuthorization(appId, formName, deleteId);
      await load();
      setDeleteId(undefined)
    } catch (caught) {
      setError(toErrorMessage(caught, '删除规则失败'))
    } finally {
      setBusy(false)
    }
  }
  return <AdminLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <SettingsPageHeader title={`${root?.label ?? formName} · 数据权限`}
                          onBack={() => navigate(formSettingsBackPath(appId, formName))} backLabel="返回表单列表"
                          actions={<Button disabled={loading || !root || busy} onClick={() => edit()}><Plus
                            className="h-4 w-4"/>新增规则</Button>}>
        <FormSettingsNav appId={appId} formName={formName} mobile/>
      </SettingsPageHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {loading ? <p role="status" className="text-sm text-muted-foreground">加载中…</p> : root && <>
          <p className="rounded-md border p-4 text-sm text-muted-foreground">当前仅保存权限配置，尚未参与运行时数据访问控制。</p>
          {!rules.length && <p className="py-6 text-center text-sm text-muted-foreground">暂无授权规则</p>}
          {rules.map(rule => <div key={rule.id}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
            <div><p className="text-sm font-medium">{rule.name}<span
              className="ml-2 text-xs text-muted-foreground">{rule.enabled ? '已启用' : '已停用'}</span></p>
              <p
                className="mt-1 text-xs text-muted-foreground">{rule.subjects.reduce((sum, item) => sum + (item.ids?.length ?? 0), 0)} 项授权成员
                · {rule.controls.length} 张表单</p></div>
            <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => edit(rule)}><Pencil
              className="h-4 w-4"/>编辑</Button>
              <Button variant="ghost" size="sm" aria-label={`删除${rule.name}`}
                      onClick={() => setDeleteId(rule.id)}><Trash2 className="h-4 w-4"/></Button></div>
          </div>)}
        </>}
      </div>
    </div>
    <BizDrawer open={!!draft} onOpenChange={open => {
      if (!busy && !open) setDraft(undefined)
    }} title={editingId ? '编辑授权规则' : '新增授权规则'}
               width="md:w-[min(92vw,720px)]"
               footer={<><Button variant="secondary" disabled={busy}
                                 onClick={() => setDraft(undefined)}>取消</Button><Button
                 disabled={busy || !draft?.name.trim()} onClick={save}>{busy ? '保存中…' : '保存'}</Button></>}>
      {draft && <div className="space-y-5">
        {draftError && <p role="alert" className="text-sm text-destructive">{draftError}</p>}
        <label className="block space-y-2 text-sm"><span>规则名称</span><Input value={draft.name} maxLength={255}
                                                                               onChange={e => setDraft({
                                                                                 ...draft,
                                                                                 name: e.target.value
                                                                               })}/></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled}
                                                                  onChange={e => setDraft({
                                                                    ...draft,
                                                                    enabled: e.target.checked
                                                                  })}/>启用规则</label>
        <section className="space-y-2"><h3 className="text-sm font-medium">授权成员</h3><DirectoryMemberPicker
          appId={appId} value={toDirectorySelections(draft.subjects)}
          onChange={items => setDraft({...draft, subjects: fromDirectorySelections(items)})}/></section>
        <section className="space-y-3"><h3 className="text-sm font-medium">数据范围</h3><p
          className="text-xs text-muted-foreground">按所有者计算，多个范围取并集；下级相对于当前访问用户。</p>
          <div className="flex flex-wrap gap-3">{dynamics.map(item => <label key={item.type}
                                                                             className="flex items-center gap-2 text-sm">
            <input type="checkbox" disabled={item.type !== 'ALL' && draft.dataScope.some(s => s.type === 'ALL')}
                   checked={draft.dataScope.some(s => s.type === item.type)} onChange={e => setDraft({
              ...draft,
              dataScope: item.type === 'ALL' ? e.target.checked ? [{type: 'ALL'}] : [] : e.target.checked ? [...draft.dataScope, {type: item.type}] : draft.dataScope.filter(s => s.type !== item.type)
            })}/>{item.label}</label>)}</div>
          <DirectoryMemberPicker appId={appId} disabled={draft.dataScope.some(s => s.type === 'ALL')}
                                 value={toDirectorySelections(draft.dataScope)} label="选择指定用户、角色或组织"
                                 onChange={items => setDraft({
                                   ...draft,
                                   dataScope: [...draft.dataScope.filter(s => !['USER', 'ROLE', 'ORGANIZATION'].includes(s.type)), ...fromDirectorySelections(items)]
                                 })}/>
        </section>
        <Tabs defaultValue={formName}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto">
            {targets.map(form => <TabsTrigger key={form.name}
                                              value={form.name}>{form.label} · {form.name === formName ? '主表单' : '子表单'}</TabsTrigger>)}
          </TabsList>
          {targets.map(form => {
            const control = draft.controls.find(item => item.formName === form.name)
            if (!control) return null
            return <TabsContent key={form.name} value={form.name} className="space-y-3 rounded-md border p-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-medium">字段</th>
                    <th className="py-2"><label className="flex items-center gap-1"><input type="checkbox"
                                                                                           aria-label="查看全部字段"
                                                                                           checked={control.readAll}
                                                                                           onChange={e => patchControl(form.name, {readAll: e.target.checked})}/>查看</label>
                    </th>
                    <th className="py-2"><label className="flex items-center gap-1"><input type="checkbox"
                                                                                           aria-label="修改全部业务字段"
                                                                                           checked={control.writeAll}
                                                                                           onChange={e => patchControl(form.name, {writeAll: e.target.checked})}/>修改</label>
                    </th>
                    <th className="py-2"><label className="flex items-center gap-1"><input type="checkbox"
                                                                                           aria-label="允许删除"
                                                                                           checked={control.allowDelete}
                                                                                           onChange={e => patchControl(form.name, {allowDelete: e.target.checked})}/>删除</label>
                    </th>
                  </tr>
                  </thead>
                  <tbody>{form.fields.map(field => <tr key={field.name} className="border-b last:border-b-0">
                    <td className="py-2">{field.label}</td>
                    <td><input type="checkbox" aria-label={`${form.label}${field.label}查看`}
                               checked={control.readAll || !!control.fieldControls[field.name]?.read}
                               disabled={control.readAll} onChange={e => patchControl(form.name, {
                      fieldControls: {
                        ...control.fieldControls,
                        [field.name]: {read: e.target.checked, write: control.fieldControls[field.name]?.write ?? false}
                      }
                    })}/></td>
                    <td><input type="checkbox" aria-label={`${form.label}${field.label}修改`}
                               checked={!field.builtin && (control.writeAll || !!control.fieldControls[field.name]?.write)}
                               disabled={field.builtin || control.writeAll} onChange={e => patchControl(form.name, {
                      fieldControls: {
                        ...control.fieldControls,
                        [field.name]: {read: control.fieldControls[field.name]?.read ?? false, write: e.target.checked}
                      }
                    })}/></td>
                    <td><input type="checkbox" aria-label={`${form.label}${field.label}删除`}
                               checked={control.allowDelete} disabled/></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="space-y-2"><p
                className="text-xs text-muted-foreground">记录条件（查看、修改、删除共用）</p>
                <ConditionEditor fields={form.fields} value={control.condition}
                                 onChange={condition => patchControl(form.name, {condition})}/></div>
            </TabsContent>
          })}
        </Tabs>
      </div>}
    </BizDrawer>
    <ConfirmDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(undefined)} title="删除授权规则"
                   message="删除后将移除此规则及其表单配置。" confirmText="删除" onConfirm={remove} busy={busy}/>
  </AdminLayout>
}

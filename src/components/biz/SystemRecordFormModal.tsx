import * as React from 'react'
import {CirclePlus, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Checkbox} from '@/components/ui/checkbox'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {AppRecordFormModal, type ReferenceOption} from '@/components/biz/AppRecordFormModal'
import type {AppForm, AppFormItem} from '@/services/appForms'
import {
  createSystemRecord,
  getSystemForm,
  getSystemRecord,
  updateSystemRecord,
  type SystemForm,
  type SystemOption,
  type SystemPermissionResource,
  type SystemRecord,
} from '@/services/systemForms'

interface UserDepartmentRelation {
  departmentId: string
  isMain: boolean
  jobTitle: string
}

function flattenResources(
  resources: SystemPermissionResource[],
  depth = 0,
): Array<SystemPermissionResource & { depth: number }> {
  return resources.flatMap(resource => [
    {...resource, depth},
    ...flattenResources(resource.children ?? [], depth + 1),
  ])
}

function toAppForm(form: SystemForm): AppForm {
  return {
    name: form.name,
    label: form.label,
    description: form.description,
    displayField: form.displayField,
    searchField: form.searchField,
    managed: true,
    builtin: true,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
    fields: form.fields.map(field => ({
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required,
      builtin: false,
      options: field.options?.map(option => ({
        id: option.id,
        text: option.text,
        color: option.color ?? undefined,
        defaultSelected: option.defaultSelected,
      })) ?? null,
      referenceForm: field.referenceForm,
      locked: field.locked,
      extension: field.extension,
    })),
    layout: {items: form.layout.items as AppForm['layout']['items']},
    viewTabs: [],
  }
}

export function SystemRecordFormModal({
                                        open,
                                        onOpenChange,
                                        formName,
                                        recordId,
                                        departments = [],
                                        roles = [],
                                        users = [],
                                        resources = [],
                                        onSaved,
                                      }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  formName: 'f_user' | 'f_department' | 'f_role'
  recordId?: string | null
  departments?: SystemOption[]
  roles?: SystemOption[]
  users?: SystemRecord[]
  resources?: SystemPermissionResource[]
  onSaved?: (id: string) => void
}) {
  const [form, setForm] = React.useState<SystemForm | null>(null)
  const [departmentRelations, setDepartmentRelations] = React.useState<UserDepartmentRelation[]>([])
  const appForm = React.useMemo(() => form ? toAppForm(form) : null, [form])

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    getSystemForm(formName)
      .then(loadedForm => {
        if (!cancelled) setForm(loadedForm)
      })
      .catch(() => {
        if (!cancelled) setForm(null)
      })
    return () => {
      cancelled = true
    }
  }, [formName, open])

  React.useEffect(() => {
    if (open && !recordId) setDepartmentRelations([])
  }, [open, recordId])

  const loadRecord = React.useCallback(async (id: string) => {
    const record = await getSystemRecord(formName, id)
    if (formName === 'f_user') {
      setDepartmentRelations(Array.isArray(record.departments)
        ? (record.departments as UserDepartmentRelation[]).map(relation => ({
          departmentId: relation.departmentId,
          isMain: relation.isMain,
          jobTitle: relation.jobTitle ?? '',
        }))
        : [])
    }
    return record
  }, [formName])

  const saveRecord = React.useCallback(async (
    values: Record<string, unknown>,
    id?: string | null,
  ) => {
    const payload = {...values}
    if (formName === 'f_user') {
      payload.roleIds = Array.isArray(payload.roleIds) ? payload.roleIds.map(String) : []
      payload.departments = departmentRelations
    }
    if (formName === 'f_role') {
      payload.resourceIds = Array.isArray(payload.resourceIds)
        ? payload.resourceIds.map(value => Number(value))
        : []
    }
    return id
      ? updateSystemRecord(formName, id, payload)
      : createSystemRecord(formName, payload)
  }, [departmentRelations, formName])

  const referenceOptions = React.useMemo(() => {
    const options: Record<string, ReferenceOption[]> = {}
    if (formName === 'f_user') {
      options.manager_user_id = users
        .filter(user => user.id !== recordId)
        .map(user => ({value: user.id, label: String(user.name ?? user.id)}))
      options.roleIds = roles.map(role => ({value: role.id, label: String(role.name ?? role.id)}))
    }
    if (formName === 'f_role') {
      options.resourceIds = flattenResources(resources).map(resource => ({
        value: String(resource.id),
        label: `${'　'.repeat(resource.depth)}${resource.name}`,
      }))
    }
    return options
  }, [formName, recordId, resources, roles, users])

  const addDepartmentRelation = () => {
    const used = new Set(departmentRelations.map(relation => relation.departmentId))
    const department = departments.find(item => !used.has(item.id))
    if (!department) return
    setDepartmentRelations(current => [...current, {
      departmentId: department.id,
      isMain: current.length === 0,
      jobTitle: '',
    }])
  }

  const renderSubform = (item: AppFormItem) => {
    if (formName !== 'f_user' || item.formName !== 'f_user_department') return null
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{item.label ?? '任职'}</span>
          <Button variant="secondary" size="sm" className="!h-8 !px-3" onClick={addDepartmentRelation}>
            <CirclePlus className="h-3.5 w-3.5"/>添加
          </Button>
        </div>
        {departmentRelations.map((relation, index) => (
          <div key={`${relation.departmentId}-${index}`}
               className="grid gap-2 rounded-md border p-3 lg:grid-cols-[1fr_.6fr_1fr_auto]">
            <Select
              value={relation.departmentId}
              onValueChange={value => setDepartmentRelations(current => current.map((item, itemIndex) =>
                itemIndex === index ? {...item, departmentId: value} : item))}
            >
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                {departments.map(department => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name ?? department.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 rounded-md border px-3 text-sm">
              <Checkbox
                checked={relation.isMain}
                onCheckedChange={checked => setDepartmentRelations(current => current.map((item, itemIndex) => ({
                  ...item,
                  isMain: itemIndex === index ? checked === true : checked === true ? false : item.isMain,
                })))}
              />
              主职
            </label>
            <Input
              value={relation.jobTitle}
              onChange={event => setDepartmentRelations(current => current.map((item, itemIndex) =>
                itemIndex === index ? {...item, jobTitle: event.target.value} : item))}
              placeholder="职位"
            />
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10"
              onClick={() => setDepartmentRelations(current => current.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 className="h-4 w-4"/>
            </Button>
          </div>
        ))}
      </div>
    )
  }

  if (!appForm) return null

  return (
    <AppRecordFormModal
      open={open}
      onOpenChange={onOpenChange}
      appId="system"
      form={appForm}
      recordId={recordId}
      loadRecord={loadRecord}
      saveRecord={saveRecord}
      referenceOptions={referenceOptions}
      renderSubform={renderSubform}
      designPath={`/admin/apps/system/forms/${encodeURIComponent(formName)}/form-design`}
      onSaved={onSaved}
    />
  )
}

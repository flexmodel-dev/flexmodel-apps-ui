import * as React from 'react'
import {Pencil, Trash2} from 'lucide-react'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppRecordFormModal} from '@/components/biz/AppRecordFormModal'
import {Empty} from '@/components/ui/empty'
import {isFormDividerField} from '@/lib/form-layout'
import {getAppForm, type AppForm, type AppFormField} from '@/services/appForms'
import {deleteAppRecord, getAppRecord, type AppRecord} from '@/services/appRecords'

function renderValue(field: AppFormField, value: unknown) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-muted-foreground">-</span>
  }
  if (field.type === 'BOOL') return value === true ? '是' : '否'
  if (field.type === 'NUMBER' || field.type === 'DECIMAL') {
    return Number(value).toLocaleString()
  }
  return String(value)
}

export function AppRecordDetail({
                                  appId,
                                  formName,
                                  recordId,
                                  onDeleted,
                                }: {
  appId: string
  formName: string
  recordId: string
  onDeleted?: () => void
}) {
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [record, setRecord] = React.useState<AppRecord | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const load = React.useCallback(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    Promise.all([getAppForm(appId, formName), getAppRecord(appId, formName, recordId)])
      .then(([loadedForm, loadedRecord]) => {
        if (cancelled) return
        setForm(loadedForm)
        setRecord(loadedRecord)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : '加载记录失败')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, formName, recordId])

  React.useEffect(() => load(), [load])

  const removeRecord = async () => {
    setIsDeleting(true)
    try {
      await deleteAppRecord(appId, formName, recordId)
      setDeleteOpen(false)
      onDeleted?.()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '删除记录失败')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) return <AppLoading center className="min-h-[240px]"/>
  if (error) {
    return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">{error}</div>
  }
  if (!form || !record) return <Empty description="记录不存在"/>

  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const layoutNames = form.layout?.fields?.length
    ? form.layout.fields
    : form.fields.filter((field) => !field.builtin).map((field) => field.name)
  const sections: Array<{ key: string; label: string; fields: AppFormField[] }> = [
    {key: 'default', label: form.label, fields: []},
  ]
  layoutNames.forEach((name) => {
    if (isFormDividerField(name)) {
      sections.push({
        key: name,
        label: form.layout?.properties?.[name]?.label?.trim() || '分栏',
        fields: [],
      })
      return
    }
    const field = fieldMap.get(name)
    if (field && !field.builtin && !form.layout?.properties?.[name]?.hidden) {
      sections[sections.length - 1].fields.push(field)
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{String(record[form.displayField ?? 'id'] ?? record.id)}</div>
          <div className="text-xs text-muted-foreground">{form.label}</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4"/> 编辑
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4"/> 删除
          </Button>
        </div>
      </div>

      {sections.filter((section) => section.fields.length).map((section) => (
        <div key={section.key} className="rounded-xl border bg-card p-4">
          {sections.length > 1 && (
            <div className="mb-3 border-b pb-2 text-sm font-medium">{section.label}</div>
          )}
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            {section.fields.map((field) => {
              const label = form.layout?.properties?.[field.name]?.label?.trim() || field.label
              return (
                <div key={field.name} className="min-w-0">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 truncate text-sm font-medium text-foreground">
                    {renderValue(field, record[field.name])}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <AppRecordFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        appId={appId}
        form={form}
        recordId={recordId}
        onSaved={() => load()}
      />

      <BizDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除记录"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
              取消
            </Button>
            <Button variant="danger" onClick={removeRecord} disabled={isDeleting}>
              {isDeleting ? '删除中' : '删除'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-muted-foreground">
          确认删除这条「{form.label}」记录吗？删除后不可恢复。
        </div>
      </BizDialog>
    </div>
  )
}

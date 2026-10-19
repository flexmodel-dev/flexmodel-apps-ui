import * as React from 'react'
import {ChevronDown, Pencil, Trash2} from 'lucide-react'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppRecordFormModal} from '@/components/biz/AppRecordFormModal'
import {AppFormSectionTitle} from '@/components/biz/AppFormSectionTitle'
import {AppSubformRecords} from '@/components/biz/AppSubformRecords'
import {AppReferenceValue} from '@/components/biz/AppReferenceValue'
import {Empty} from '@/components/ui/empty'
import {cn} from '@/lib/utils'
import {formItemWidthTypeClasses} from '@/lib/form-items'
import {getAppForm, type AppForm, type AppFormField, type AppFormItem} from '@/services/appForms'
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

function recordTitle(value: unknown, recordId: string) {
  if (Array.isArray(value) && value.length > 0) {
    return recordTitle(value[0], recordId)
  }
  if (value && typeof value === 'object' && 'displayValue' in value) {
    const reference = value as { displayValue?: unknown }
    return String(reference.displayValue ?? recordId)
  }
  return String(value ?? recordId)
}

export function AppRecordDetail({
                                  appId,
                                  formName,
                                  recordId,
                                  onDeleted,
                                  onOpenRecord,
                                }: {
  appId: string
  formName: string
  recordId: string
  onDeleted?: () => void
  onOpenRecord?: (formName: string, recordId: string) => void
}) {
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [record, setRecord] = React.useState<AppRecord | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [collapsedSections, setCollapsedSections] = React.useState<string[]>([])

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
  const layoutItems: AppFormItem[] = form.layout.items.length
    ? form.layout.items
    : form.fields.filter((field) => !field.builtin).map((field) => ({type: 'FIELD' as const, name: field.name}))
  const sections: Array<{
    key: string
    label: string
    fields: Array<{ field: AppFormField; item?: AppFormItem }>
  }> = [
    {key: 'default', label: form.label, fields: []},
  ]
  const subformItems: Array<{ key: string; item: AppFormItem }> = []
  layoutItems.forEach((item, index) => {
    if (item.type === 'SECTION') {
      sections.push({
        key: `section-${index}`,
        label: item.label?.trim() || '分栏',
        fields: [],
      })
      return
    }
    if (item.type === 'SUBFORM') {
      subformItems.push({key: `subform-${index}`, item})
      return
    }
    const field = item.name ? fieldMap.get(item.name) : undefined
    if (field && !item.hidden) {
      sections[sections.length - 1].fields.push({field, item})
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">
            {recordTitle(record[form.displayField ?? 'id'], String(record.id))}
          </div>
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

      <div className="space-y-5 rounded-xl border bg-card p-4 shadow-sm">
        {sections.filter((section) => section.fields.length).map((section) => {
          const collapsed = section.key !== 'default' && collapsedSections.includes(section.key)
          return (
            <section key={section.key} className="space-y-3">
              {sections.length > 1 && section.key !== 'default' && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left text-sm text-foreground"
                  onClick={() => setCollapsedSections((previous) => previous.includes(section.key)
                    ? previous.filter((item) => item !== section.key)
                    : [...previous, section.key])}
                >
                  <AppFormSectionTitle label={section.label}/>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      collapsed && '-rotate-90',
                    )}
                  />
                </button>
              )}
              {!collapsed && (
                <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-12">
                  {section.fields.map(({field, item}) => {
                    const layoutItem = layoutItems.find((layoutEntry) => layoutEntry.type === 'FIELD' && layoutEntry.name === field.name)
                    const width = item?.width ?? layoutItem?.width ?? 'HALF'
                    const label = layoutItem?.label?.trim() || field.label
                    return (
                      <div key={field.name} className={cn('min-w-0', formItemWidthTypeClasses[width])}>
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="mt-1 truncate text-sm font-medium text-foreground">
                          {field.type === 'REFERENCE' ? (
                            <AppReferenceValue
                              appId={appId}
                              field={field}
                              value={record[field.name]}
                              onOpenRecord={onOpenRecord}
                            />
                          ) : renderValue(field, record[field.name])}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {subformItems.map((item) => (
        <AppSubformRecords
          key={item.key}
          appId={appId}
          mainFormName={form.name}
          mainRecordId={recordId}
          subform={{
            formName: item.item.formName!,
            referenceField: item.item.referenceField!,
          }}
        />
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

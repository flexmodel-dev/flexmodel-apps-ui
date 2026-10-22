import * as React from 'react'
import {RecordApprovalPanel} from '@/pages/Approvals/RecordApprovalPanel'
import {ChevronDown, Pencil, Trash2} from 'lucide-react'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppRecordFormModal} from '@/components/biz/AppRecordFormModal'
import {AppFormSectionTitle} from '@/components/biz/AppFormSectionTitle'
import {AppSubformRecords} from '@/components/biz/AppSubformRecords'
import {AppReferenceValue} from '@/components/biz/AppReferenceValue'
import {parseFormLayout} from '@/components/biz/form/parseFormLayout'
import {renderFormValue} from '@/components/biz/form/FormReadonlyValue'
import {Empty} from '@/components/ui/empty'
import {cn} from '@/lib/utils'
import {formItemWidthTypeClasses} from '@/lib/form-items'
import {getAppForm, type AppForm} from '@/services/appForms'
import {deleteAppRecord, getAppRecord, type AppRecord} from '@/services/appRecords'

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
  const [approvalLocked, setApprovalLocked] = React.useState(false)
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

  const {sections, subformItems} = parseFormLayout(form)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">
            {recordTitle(record[form.displayField ?? 'id'], String(record.id))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={approvalLocked} onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4"/> 编辑
          </Button>
          <Button size="sm" variant="danger" disabled={approvalLocked} onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4"/> 删除
          </Button>
        </div>
      </div>

      {!form.builtin &&
        <RecordApprovalPanel appId={appId} formName={formName} recordId={recordId} onLocked={setApprovalLocked}/>}
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
                    const width = item.width ?? 'HALF'
                    const label = item.label?.trim() || field.label
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
                          ) : renderFormValue(field, record[field.name])}
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

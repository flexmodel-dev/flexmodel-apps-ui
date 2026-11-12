import * as React from 'react'
import {Check, Info, LockKeyhole, Pencil, Trash2, X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {ConfirmDialog} from '@/components/ui/dialog'
import {message} from '@/components/ui/message'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppFormSectionTitle} from '@/components/biz/AppFormSectionTitle'
import {AppReferenceValue} from '@/components/biz/AppReferenceValue'
import {AppSubformRecords} from '@/components/biz/AppSubformRecords'
import {FormMoreMenu} from '@/components/biz/FormMoreMenu'
import {ApprovalDecisionDialog, useApprovalDecision} from '@/components/biz/approvalDecision'
import {useRecordApproval} from '@/components/biz/useRecordApproval'
import {FieldControl} from '@/components/biz/form/FormFieldControl'
import {
  groupFormLayoutFields,
  parseFormLayout,
  type FormLayoutEntry,
} from '@/components/biz/form/parseFormLayout'
import {buildRecordPayload, toEditValues} from '@/components/biz/form/recordPayload'
import {useReferenceOptions} from '@/components/biz/form/useReferenceOptions'
import {renderFormValue} from '@/components/biz/form/FormReadonlyValue'
import {useAttachmentUploads} from '@/components/biz/form/useAttachmentUploads'
import {displayRecordText, recordTitle} from '@/lib/recordValue'
import {printRecord} from '@/lib/printRecord'
import {isFieldWritable} from '@/lib/fieldConfig'
import {cn, toErrorMessage} from '@/lib/utils'
import {formItemWidthTypeClasses} from '@/lib/form-items'
import type {AppForm, AppFormItem} from '@/services/appForms'
import {type AppRecord, deleteAppRecord, getAppRecord, updateAppRecord} from '@/services/appRecords'

function renderViewValue(field: AppForm['fields'][number], value: unknown) {
  if (field.type === 'MULTIREFERENCE') return displayRecordText(value)
  return renderFormValue(field, value)
}

/**
 * 可内嵌的记录面板：详情视图与记录抽屉共用的查看/编辑面板。
 * 仅处理已有记录，不支持新建；删除、编辑、审批能力与抽屉保持一致。
 */
export function AppRecordPanel({
                                 appId,
                                 form,
                                 recordId,
                                 onSaved,
                                 onDeleted,
                                 onOpenRecord,
                                 compact,
                               }: {
  appId: string
  form: AppForm
  recordId: string
  onSaved?: (id: string) => void
  onDeleted?: () => void
  onOpenRecord?: (formName: string, recordId: string) => void
  compact?: boolean
}) {
  const [mode, setMode] = React.useState<'view' | 'edit'>('view')
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [record, setRecord] = React.useState<AppRecord | null>(null)
  const [values, setValues] = React.useState<AppRecord>({})
  const [dirty, setDirty] = React.useState(false)
  const [error, setError] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSavingSubform, setIsSavingSubform] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const {uploading, startUpload} = useAttachmentUploads()

  const approval = useRecordApproval({
    appId,
    formName: form.name,
    recordId,
    enabled: !form.builtin,
  })
  const decision = useApprovalDecision(appId, () => {
    approval.refresh()
    onSaved?.(recordId)
  })
  const approvalLocked = approval.locked
  const referenceOptionsMap = useReferenceOptions({appId, form, open: true})
  const controlValues = mode === 'view' && record
    ? toEditValues(form, record)
    : {...record, ...values}
  const {entries, renderableFieldNames, requiredFieldNames} = parseFormLayout(form, {
    scene: 'UPDATE',
    values: controlValues,
  })
  const mainEntries = entries.filter(
    (entry): entry is Exclude<FormLayoutEntry, { kind: 'SUBFORM' }> => entry.kind !== 'SUBFORM',
  )
  const mainGroups = groupFormLayoutFields(mainEntries)
  const subformEntries = entries.filter(
    (entry): entry is Extract<FormLayoutEntry, { kind: 'SUBFORM' }> => entry.kind === 'SUBFORM',
  )

  React.useEffect(() => {
    setMode('view')
    setDirty(false)
    setError('')
  }, [recordId])

  React.useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getAppRecord(appId, form.name, recordId)
      .then((loaded) => {
        if (!cancelled) setRecord(loaded)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(toErrorMessage(caught, '加载记录失败'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appId, form.name, recordId])

  React.useEffect(() => {
    if (mode !== 'edit' || !record || dirty) return
    setValues(toEditValues(form, record))
  }, [mode, form, record, dirty])

  const buildPayload = (): AppRecord | null => {
    if (uploading) {
      setError('请等待附件上传完成')
      return null
    }
    return buildRecordPayload(form, renderableFieldNames, values, setError, false, requiredFieldNames)
  }

  const save = async () => {
    const payload = buildPayload()
    if (!payload) return
    setIsSubmitting(true)
    setError('')
    try {
      const saved = await updateAppRecord(appId, form.name, recordId, payload)
      setRecord(saved)
      setDirty(false)
      setMode('view')
      message.success('保存成功')
      onSaved?.(recordId)
    } catch (caught: unknown) {
      setError(toErrorMessage(caught, '保存记录失败'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const persistForSubform = async (): Promise<string | null> => {
    if (isSubmitting || isSavingSubform) return null
    const payload = buildPayload()
    if (!payload) return null
    setIsSavingSubform(true)
    try {
      await updateAppRecord(appId, form.name, recordId, payload)
      setDirty(false)
      return recordId
    } catch (caught: unknown) {
      setError(toErrorMessage(caught, '保存记录失败'))
      return null
    } finally {
      setIsSavingSubform(false)
    }
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteAppRecord(appId, form.name, recordId)
      setDeleteOpen(false)
      message.success('记录已删除')
      onDeleted?.()
    } catch (caught: unknown) {
      message.error(toErrorMessage(caught, '删除记录失败'))
    } finally {
      setIsDeleting(false)
    }
  }

  const renderSubform = (item: AppFormItem) => {
    if (!item.formName || !item.referenceField) return null
    const interactive = mode !== 'view'
    return (
      <AppSubformRecords
        appId={appId}
        mainFormName={form.name}
        mainRecordId={recordId}
        subform={{formName: item.formName, referenceField: item.referenceField}}
        readOnly={!interactive}
        onBeforeCreate={interactive ? persistForSubform : undefined}
      />
    )
  }

  const renderActions = () => {
    if (mode === 'view') {
      return (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!isLoading && record && !error && (
            <FormMoreMenu onPrint={() => printRecord(contentRef.current, form.displayField
              ? recordTitle(record[form.displayField], recordId)
              : `查看${form.label}`)}/>
          )}
          {approvalLocked && (
            <span className="mr-auto inline-flex items-center gap-1 text-xs font-medium text-destructive">
              <LockKeyhole className="h-3.5 w-3.5"/>审批中，记录已锁定
            </span>
          )}
          {approval.myTask && (
            <>
              <Button variant="secondary" size="sm" disabled={decision.busy}
                      onClick={() => decision.openDecision('reject')}>
                <X className="h-4 w-4"/>不同意
              </Button>
              <Button size="sm" disabled={decision.busy} onClick={() => decision.openDecision('approve')}>
                <Check className="h-4 w-4"/>同意
              </Button>
            </>
          )}
          {!approvalLocked && (
            <span className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4"/>删除
              </Button>
              <Button size="sm" disabled={!record} onClick={() => setMode('edit')}>
                <Pencil className="h-4 w-4"/>编辑
              </Button>
            </span>
          )}
        </div>
      )
    }
    return (
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={isSubmitting} onClick={() => setMode('view')}>
          取消
        </Button>
        <Button size="sm" onClick={() => void save()}
                disabled={isSubmitting || uploading || approvalLocked || !record}>
          {isSubmitting ? '保存中…' : '保存'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && <AppLoading center className="min-h-[240px]"/>}
        {!isLoading && (
          <div ref={contentRef} className={cn('space-y-4', !compact && 'pb-4')}>
            {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            {mainEntries.length > 0 && (
              <div className="space-y-5 rounded-xl border bg-card p-4 shadow-sm">
                {mainGroups.map((group) => (
                  <div key={group.key} className="space-y-4">
                    {group.section && <AppFormSectionTitle label={group.section.label}/>}
                    {group.fields.length > 0 && (
                      <div className={cn(
                        'grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-12',
                        group.section && 'pl-4',
                      )}>
                        {group.fields.map((entry) => {
                          const {field, item} = entry
                          const widthClass = formItemWidthTypeClasses[item.width ?? 'HALF']
                          if (mode === 'view') {
                            return (
                              <div key={entry.key} className={cn('min-w-0', widthClass)}>
                                <div className="text-xs text-muted-foreground">
                                  {item.label?.trim() || field.label}
                                </div>
                                <div className="mt-1 truncate text-sm font-medium text-foreground">
                                  {field.type === 'REFERENCE'
                                    ? (
                                      <AppReferenceValue
                                        appId={appId}
                                        field={field}
                                        value={record?.[field.name]}
                                        onOpenRecord={onOpenRecord}
                                      />
                                    )
                                    : renderViewValue(field, record?.[field.name])}
                                </div>
                              </div>
                            )
                          }
                          return (
                            <div key={entry.key} className={cn('space-y-1.5', widthClass)}>
                              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                {item.label?.trim() || field.label}
                                {entry.required && <span className="text-destructive">*</span>}
                                {item.tip && <Info className="h-3.5 w-3.5 text-muted-foreground"/>}
                              </label>
                              <FieldControl
                                key={`${appId}/${form.name}/${recordId}/${field.name}`}
                                appId={appId}
                                formId={form.name}
                                field={field}
                                value={values[field.name]}
                                options={field.options ?? []}
                                referenceOptions={referenceOptionsMap[field.name]}
                                disabled={entry.readonly || !isFieldWritable(field, false) || isSubmitting}
                                onUploadStart={startUpload}
                                onChange={(value) => {
                                  setValues((previous) => ({...previous, [field.name]: value}))
                                  setDirty(true)
                                }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {subformEntries.map((entry) => {
              const content = renderSubform(entry.item)
              if (!content) return null
              return <div key={entry.key}>{content}</div>
            })}
          </div>
        )}
      </div>
      <div className="mt-2 shrink-0 border-t pt-2">{renderActions()}</div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除记录"
        message="确认删除这条记录吗？删除后不可恢复。"
        busy={isDeleting}
        confirmText="删除"
        onConfirm={() => void confirmDelete()}
      />

      <ApprovalDecisionDialog
        pending={decision.pending}
        comment={decision.comment}
        busy={decision.busy}
        onCommentChange={decision.setComment}
        onClose={decision.closeDecision}
        onConfirm={() => void decision.confirmDecision(approval.myTask)}
      />
    </div>
  )
}

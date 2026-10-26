import * as React from 'react'
import {isFieldWritable} from '@/lib/fieldConfig'
import {useNavigate} from 'react-router-dom'
import {Info} from 'lucide-react'
import {BizDrawer} from '@/components/ui/drawer'
import {Button} from '@/components/ui/button'
import {message} from '@/components/ui/message'
import {cn, toErrorMessage} from '@/lib/utils'
import {AppFormSectionTitle} from '@/components/biz/AppFormSectionTitle'
import {
  formItemWidthTypeClasses,
} from '@/lib/form-items'
import {
  FieldControl,
  type ReferenceOption,
} from '@/components/biz/form/FormFieldControl'
import {parseFormLayout, type FormLayoutEntry} from '@/components/biz/form/parseFormLayout'
import {
  buildRecordPayload,
  initialCreateValues,
  toEditValues,
} from '@/components/biz/form/recordPayload'
import {useReferenceOptions} from '@/components/biz/form/useReferenceOptions'
import {useAttachmentUploads} from '@/components/biz/form/useAttachmentUploads'
import {FlowStartDialog, useFormApprovalFlows} from '@/components/biz/form/flowLaunch'
import {AppSubformRecords} from '@/components/biz/AppSubformRecords'
import {FormMoreMenu} from '@/components/biz/FormMoreMenu'
import {
  type AppForm,
  type AppFormItem,
} from '@/services/appForms'
import {
  createAppRecord,
  getAppRecord,
  updateAppRecord,
  type AppRecord,
  type AppRecordContext,
} from '@/services/appRecords'
import {submitApproval} from '@/services/approvals'

export type {ReferenceOption}

export function AppRecordFormModal({
                                     open,
                                     onOpenChange,
                                     appId,
                                     form,
                                     recordId,
                                     recordContext,
                                     loadRecord,
                                     saveRecord,
                                     referenceOptions,
                                     renderSubform,
                                     designPath,
                                     onSaved,
                                   }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appId: string
  form: AppForm
  recordId?: string | null
  recordContext?: AppRecordContext
  loadRecord?: (recordId: string) => Promise<AppRecord>
  saveRecord?: (values: AppRecord, recordId?: string | null) => Promise<AppRecord>
  referenceOptions?: Record<string, ReferenceOption[]>
  renderSubform?: (item: AppFormItem) => React.ReactNode
  designPath?: string
  onSaved?: (id: string) => void
}) {
  const navigate = useNavigate()
  const [values, setValues] = React.useState<AppRecord>({})
  const [error, setError] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [savedRecordId, setSavedRecordId] = React.useState<string | null>(null)
  const [flowOpen, setFlowOpen] = React.useState(false)
  const [flowId, setFlowId] = React.useState('')
  const [isStarting, setIsStarting] = React.useState(false)
  const {uploading, startUpload} = useAttachmentUploads()
  const requestKey = React.useRef(crypto.randomUUID())

  const effectiveRecordId = savedRecordId ?? recordId ?? null
  const flows = useFormApprovalFlows({
    appId,
    formName: form.name,
    enabled: open && !recordId && !form.builtin,
  })
  const {entries, renderableFieldNames} = parseFormLayout(form, {
    excludeField: recordContext?.referenceField,
  })
  const mainEntries = entries.filter(
    (entry): entry is Exclude<FormLayoutEntry, { kind: 'SUBFORM' }> => entry.kind !== 'SUBFORM',
  )
  const subformEntries = entries.filter(
    (entry): entry is Extract<FormLayoutEntry, { kind: 'SUBFORM' }> => entry.kind === 'SUBFORM',
  )
  const referenceOptionsMap = useReferenceOptions({
    appId,
    form,
    open,
    excludeField: recordContext?.referenceField,
    overrides: referenceOptions,
  })

  React.useEffect(() => {
    if (!open) setSavedRecordId(null)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setError('')
    if (!recordId) {
      if (!cancelled) setValues(initialCreateValues(form, recordContext?.referenceField))
      return () => {
        cancelled = true
      }
    }
    const recordPromise = loadRecord
      ? loadRecord(recordId)
      : getAppRecord(appId, form.name, recordId, recordContext)
    recordPromise
      .then((loadedRecord) => {
        if (cancelled) return
        setValues(toEditValues(form, loadedRecord, recordContext?.referenceField))
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(toErrorMessage(caught, '加载记录失败'))
      })
    return () => {
      cancelled = true
    }
  }, [appId, form, open, recordContext, recordId, loadRecord])

  React.useEffect(() => {
    if (!open) setFlowOpen(false)
  }, [open])

  const buildPayload = (): AppRecord | null => {
    if (uploading) {
      setError('请等待附件上传完成')
      return null
    }
    return buildRecordPayload(form, renderableFieldNames, values, setError, !recordId)
  }

  const persistRecord = (payload: AppRecord) =>
    saveRecord
      ? saveRecord(payload, recordId)
      : effectiveRecordId
        ? updateAppRecord(appId, form.name, effectiveRecordId, payload, recordContext)
        : createAppRecord(appId, form.name, payload, recordContext)

  const submit = async () => {
    const payload = buildPayload()
    if (!payload) return
    setIsSubmitting(true)
    setError('')
    try {
      const saved = await persistRecord(payload)
      onOpenChange(false)
      onSaved?.(String(saved.id ?? ''))
    } catch (caught: unknown) {
      setError(toErrorMessage(caught, '保存记录失败'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const persistForSubform = async (): Promise<string | null> => {
    if (isSubmitting || isStarting) return null
    const payload = buildPayload()
    if (!payload) return null
    setIsSubmitting(true)
    try {
      const saved = await persistRecord(payload)
      const id = String(saved.id ?? '')
      if (!effectiveRecordId && id) {
        setSavedRecordId(id)
        message.success('主表单已自动保存')
      }
      return id || null
    } catch (caught: unknown) {
      setError(toErrorMessage(caught, '保存记录失败'))
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderDefaultSubform = (item: AppFormItem) => {
    if (recordContext || saveRecord) return null
    if (!item.formName || !item.referenceField) return null
    return (
      <AppSubformRecords
        appId={appId}
        mainFormName={form.name}
        mainRecordId={effectiveRecordId}
        subform={{formName: item.formName, referenceField: item.referenceField}}
        onBeforeCreate={persistForSubform}
      />
    )
  }

  const openFlowDialog = () => {
    const payload = buildPayload()
    if (!payload) return
    setFlowId(flows[0]?.id ?? '')
    setFlowOpen(true)
  }

  const startFlow = async () => {
    const payload = buildPayload()
    if (!payload) return
    setIsStarting(true)
    setError('')
    try {
      const saved = await persistRecord(payload)
      await submitApproval(appId, form.name, String(saved.id ?? ''), flowId, requestKey.current)
      requestKey.current = crypto.randomUUID()
      setFlowOpen(false)
      onOpenChange(false)
      onSaved?.(String(saved.id ?? ''))
      message.success('已提交，流程正在启动')
    } catch (caught: unknown) {
      setFlowOpen(false)
      setError(toErrorMessage(caught, '发起流程失败'))
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <>
      <BizDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={effectiveRecordId ? `编辑${form.label}` : `新建${form.label}`}
      moreMenu={
        <FormMoreMenu
          onOpenDesign={() => {
            onOpenChange(false)
            navigate(designPath ?? `/admin/apps/${appId}/forms/${encodeURIComponent(form.name)}/form-design`)
          }}
        />
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting || isStarting}>
            取消
          </Button>
          <Button onClick={submit} disabled={isSubmitting || isStarting || uploading}>保存</Button>
          {!effectiveRecordId && flows.length > 0 && (
            <Button variant="outline" onClick={openFlowDialog} disabled={isSubmitting || isStarting || uploading}>
              发起流程
            </Button>
          )}
        </>
      }
    >
        <div className="space-y-4">
        {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          {mainEntries.length > 0 && (
            <div className="space-y-5 rounded-xl border bg-card p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-12">
                {mainEntries.map((entry) => {
                  if (entry.kind === 'SECTION') {
                    return (
                      <div key={entry.key} className="md:col-span-12">
                        <AppFormSectionTitle label={entry.label}/>
                      </div>
                    )
                  }
                  const {field, item} = entry
                  return (
                    <div
                      key={entry.key}
                      className={cn('space-y-1.5', formItemWidthTypeClasses[item.width ?? 'HALF'])}
                    >
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        {item.label?.trim() || field.label}
                        {field.required && <span className="text-destructive">*</span>}
                        {item.tip && <Info className="h-3.5 w-3.5 text-muted-foreground"/>}
                      </label>
                      <FieldControl
                        key={`${appId}/${form.name}/${recordId ?? 'new'}/${field.name}`}
                        appId={appId}
                        formId={form.name}
                        field={field}
                        value={values[field.name]}
                        options={field.options ?? []}
                        referenceOptions={referenceOptionsMap[field.name] ?? []}
                        disabled={item.readonly || !isFieldWritable(field, !recordId) || isSubmitting || isStarting}
                        onUploadStart={startUpload}
                        onChange={(value) => setValues((previous) => ({...previous, [field.name]: value}))}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {subformEntries.map((entry) => {
            const content = renderSubform?.(entry.item) ?? renderDefaultSubform(entry.item)
            if (!content) return null
            return (
              <div key={entry.key}>
                {content}
              </div>
            )
          })}
        </div>
      </BizDrawer>
      <FlowStartDialog
        open={flowOpen}
        onOpenChange={setFlowOpen}
        flows={flows}
        flowId={flowId}
        onFlowIdChange={setFlowId}
        isStarting={isStarting}
        onConfirm={() => void startFlow()}
      />
    </>
  )
}

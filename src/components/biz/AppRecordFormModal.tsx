import * as React from 'react'
import {isFieldWritable} from '@/lib/fieldConfig'
import {useNavigate} from 'react-router-dom'
import {Info} from 'lucide-react'
import {BizDrawer} from '@/components/ui/drawer'
import {Button} from '@/components/ui/button'
import {message} from '@/components/ui/message'
import {cn, toErrorMessage} from '@/lib/utils'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppFormSectionTitle} from '@/components/biz/AppFormSectionTitle'
import {
  formItemWidthTypeClasses,
} from '@/lib/form-items'
import {
  FieldControl,
  type ReferenceOption,
} from '@/components/biz/form/FormFieldControl'
import {
  groupFormLayoutFields,
  parseFormLayout,
  type FormLayoutEntry,
} from '@/components/biz/form/parseFormLayout'
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
import type {ApprovalFlow} from '@/types/workflow'

export type {ReferenceOption}

const EMPTY_ENTRIES: FormLayoutEntry[] = []
const EMPTY_FIELD_NAMES: Set<string> = new Set()

export function AppRecordFormModal({
                                     open,
                                     onOpenChange,
                                     appId,
                                     form,
                                     formError,
                                     launchFlow,
                                     recordId,
                                     recordContext: context,
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
  /** 表单定义可能尚未加载（例如右上角新增记录先展开抽屉再取表单） */
  form: AppForm | null
  formError?: string | null
  launchFlow?: ApprovalFlow
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
  // 父列表刷新会重新创建上下文对象，只有实际关联变化时才重新初始化表单。
  const recordContext = React.useMemo<AppRecordContext | undefined>(() => context ? {
    mainFormName: context.mainFormName,
    mainRecordId: context.mainRecordId,
    referenceField: context.referenceField,
  } : undefined, [context?.mainFormName, context?.mainRecordId, context?.referenceField])
  const formName = form?.name ?? ''
  const [values, setValues] = React.useState<AppRecord>({})
  const [error, setError] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [savedRecordId, setSavedRecordId] = React.useState<string | null>(null)
  const [flowOpen, setFlowOpen] = React.useState(false)
  const [flowId, setFlowId] = React.useState('')
  const [isStarting, setIsStarting] = React.useState(false)
  const {uploading, startUpload} = useAttachmentUploads()
  const requestKey = React.useRef(crypto.randomUUID())
  const flowSave = React.useRef<{ payload: string; recordId: string } | null>(null)

  const effectiveRecordId = savedRecordId ?? recordId ?? null
  const flows = useFormApprovalFlows({
    appId,
    formName,
    enabled: open && !!form && !recordId && !form?.builtin && !launchFlow,
  })
  const layout = form ? parseFormLayout(form, {
    excludeField: recordContext?.referenceField,
    scene: recordId ? 'UPDATE' : 'CREATE',
    values,
  }) : null
  const entries = layout?.entries ?? EMPTY_ENTRIES
  const renderableFieldNames = layout?.renderableFieldNames ?? EMPTY_FIELD_NAMES
  const requiredFieldNames = layout?.requiredFieldNames ?? EMPTY_FIELD_NAMES
  const mainEntries = entries.filter(
    (entry): entry is Exclude<FormLayoutEntry, { kind: 'SUBFORM' }> => entry.kind !== 'SUBFORM',
  )
  const mainGroups = groupFormLayoutFields(mainEntries)
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
    if (!open) {
      setSavedRecordId(null)
      flowSave.current = null
    }
  }, [open])

  React.useEffect(() => {
    if (!open || !form) return
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
    if (!form || !layout) return null
    if (uploading) {
      setError('请等待附件上传完成')
      return null
    }
    return buildRecordPayload(form, renderableFieldNames, values, setError, !recordId, requiredFieldNames)
  }

  const persistRecord = (payload: AppRecord) =>
    saveRecord
      ? saveRecord(payload, recordId)
      : effectiveRecordId
        ? updateAppRecord(appId, formName, effectiveRecordId, payload, recordContext)
        : createAppRecord(appId, formName, payload, recordContext)

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
        mainFormName={formName}
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
      const serialized = JSON.stringify(payload)
      // 发起响应丢失时复用已保存记录，避免重建记录或先更新已被流程锁定的记录。
      if (flowSave.current?.payload !== serialized) {
        const saved = await persistRecord(payload)
        const id = String(saved.id ?? '')
        setSavedRecordId(id)
        flowSave.current = {payload: serialized, recordId: id}
      }
      const id = flowSave.current.recordId
      await submitApproval(appId, formName, id, launchFlow?.id ?? flowId, requestKey.current)
      requestKey.current = crypto.randomUUID()
      setFlowOpen(false)
      onOpenChange(false)
      onSaved?.(id)
      message.success('已提交，流程正在启动')
    } catch (caught: unknown) {
      setFlowOpen(false)
      const reason = toErrorMessage(caught, '发起流程失败')
      setError(flowSave.current ? `记录已保存，${reason}` : reason)
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <>
      <BizDrawer
      open={open}
      onOpenChange={value => {
        if (!isSubmitting && !isStarting) onOpenChange(value)
      }}
      title={launchFlow ? `发起流程：${launchFlow.name}` : form ? (effectiveRecordId ? `编辑${form.label}` : `新建${form.label}`) : '新建记录'}
      moreMenu={form ? (
        <FormMoreMenu
          onOpenDesign={() => {
            onOpenChange(false)
            navigate(designPath ?? `/admin/apps/${appId}/forms/${encodeURIComponent(formName)}/form-design`)
          }}
        />
      ) : undefined}
      footer={form ? (
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting || isStarting}>
            取消
          </Button>
          {launchFlow ? (
            <Button onClick={() => void startFlow()} disabled={isSubmitting || isStarting || uploading}>
              {isStarting ? '提交中…' : '提交并发起'}
            </Button>
          ) : <Button onClick={submit} disabled={isSubmitting || isStarting || uploading}>保存</Button>}
          {!launchFlow && !recordId && flows.length > 0 && (
            <Button variant="outline" onClick={openFlowDialog} disabled={isSubmitting || isStarting || uploading}>
              发起流程
            </Button>
          )}
        </>
      ) : undefined}
    >
        <div className="space-y-4">
          {formError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
          {!form && !formError && <AppLoading center className="min-h-[240px]"/>}
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
                        return (
                          <div
                            key={entry.key}
                            className={cn('space-y-1.5', formItemWidthTypeClasses[item.width ?? 'HALF'])}
                          >
                            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                              {item.label?.trim() || field.label}
                              {entry.required && <span className="text-destructive">*</span>}
                              {item.tip && <Info className="h-3.5 w-3.5 text-muted-foreground"/>}
                            </label>
                            <FieldControl
                              key={`${appId}/${formName}/${recordId ?? 'new'}/${field.name}`}
                              appId={appId}
                              formId={formName}
                              field={field}
                              value={values[field.name]}
                              options={field.options ?? []}
                              referenceOptions={referenceOptionsMap[field.name]}
                              disabled={entry.readonly || !isFieldWritable(field, !recordId) || isSubmitting || isStarting}
                              onUploadStart={startUpload}
                              onChange={(value) => setValues((previous) => ({...previous, [field.name]: value}))}
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

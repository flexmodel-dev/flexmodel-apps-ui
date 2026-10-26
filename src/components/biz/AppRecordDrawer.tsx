import * as React from 'react'
import {isFieldWritable} from '@/lib/fieldConfig'
import {useNavigate} from 'react-router-dom'
import {Check, Info, LockKeyhole, Pencil, Send, Trash2, X} from 'lucide-react'
import {BizDrawer} from '@/components/ui/drawer'
import {BizDialog, ConfirmDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {message} from '@/components/ui/message'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppFormSectionTitle} from '@/components/biz/AppFormSectionTitle'
import {AppReferenceValue} from '@/components/biz/AppReferenceValue'
import {AppSubformRecords} from '@/components/biz/AppSubformRecords'
import {FormMoreMenu} from '@/components/biz/FormMoreMenu'
import {ApprovalProgressPanel} from '@/pages/Approvals/ApprovalProgress'
import {useRecordApproval} from '@/components/biz/useRecordApproval'
import {ApprovalDecisionDialog, useApprovalDecision} from '@/components/biz/approvalDecision'
import {FlowStartDialog, useFormApprovalFlows} from '@/components/biz/form/flowLaunch'
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
import {renderFormValue} from '@/components/biz/form/FormReadonlyValue'
import {useAttachmentUploads} from '@/components/biz/form/useAttachmentUploads'
import {displayRecordText, recordTitle} from '@/lib/recordValue'
import {cn, toErrorMessage} from '@/lib/utils'
import {formItemWidthTypeClasses} from '@/lib/form-items'
import {getAppForm, type AppForm, type AppFormField, type AppFormItem} from '@/services/appForms'
import {
  createAppRecord,
  deleteAppRecord,
  getAppRecord,
  updateAppRecord,
  type AppRecord,
} from '@/services/appRecords'
import {submitApproval} from '@/services/approvals'

export type AppRecordDrawerMode = 'view' | 'edit' | 'create'

function renderViewValue(field: AppFormField, value: unknown) {
  if (field.type === 'MULTIREFERENCE') return displayRecordText(value)
  return renderFormValue(field, value)
}

/**
 * 记录统一抽屉：查看 / 编辑 / 新建在同一抽屉内原地切换。
 * 查看态展示文本与审批进度；编辑/新建态切换为输入控件，同一布局保持字段位置连续。
 */
export function AppRecordDrawer({
                                  open,
                                  onOpenChange,
                                  appId,
                                  formName,
                                  recordId,
                                  initialMode,
                                  approvalInstanceId,
                                  onSaved,
                                  onDeleted,
                                  onOpenRecord,
                                }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appId: string
  formName: string
  recordId?: string | null
  initialMode?: 'view' | 'edit'
  approvalInstanceId?: string | null
  onSaved?: (id: string) => void
  onDeleted?: () => void
  onOpenRecord?: (formName: string, recordId: string) => void
}) {
  const navigate = useNavigate()
  const [mode, setMode] = React.useState<AppRecordDrawerMode>('view')
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [formError, setFormError] = React.useState('')
  const [isFormLoading, setIsFormLoading] = React.useState(true)
  const [record, setRecord] = React.useState<AppRecord | null>(null)
  const [values, setValues] = React.useState<AppRecord>({})
  const [dirty, setDirty] = React.useState(false)
  const [activeRecordId, setActiveRecordId] = React.useState<string | null>(recordId ?? null)
  const [error, setError] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSavingSubform, setIsSavingSubform] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [discardKind, setDiscardKind] = React.useState<'close' | 'edit' | null>(null)
  const [flowOpen, setFlowOpen] = React.useState(false)
  const [flowId, setFlowId] = React.useState('')
  const [isStarting, setIsStarting] = React.useState(false)
  const {uploading, startUpload} = useAttachmentUploads()
  const requestKey = React.useRef(crypto.randomUUID())
  const initialModeRef = React.useRef(initialMode)
  initialModeRef.current = initialMode

  const isCreate = mode === 'create'
  const recordPending = !!activeRecordId && !record
  const approval = useRecordApproval({
    appId,
    formName,
    recordId: activeRecordId,
    instanceId: approvalInstanceId,
    enabled: open && !isCreate && !!form && !form.builtin,
  })
  const decision = useApprovalDecision(appId, () => {
    approval.refresh()
    onSaved?.(activeRecordId ?? '')
  })
  const approvalLocked = approval.locked
  const flows = useFormApprovalFlows({
    appId,
    formName: form?.name ?? '',
    enabled: open && isCreate && !!form && !form.builtin,
  })
  const referenceOptionsMap = useReferenceOptions({appId, form, open})
  const {entries} = form ? parseFormLayout(form) : {entries: [] as FormLayoutEntry[]}
  const mainEntries = entries.filter(
    (entry): entry is Exclude<FormLayoutEntry, { kind: 'SUBFORM' }> => entry.kind !== 'SUBFORM',
  )
  const subformEntries = entries.filter(
    (entry): entry is Extract<FormLayoutEntry, { kind: 'SUBFORM' }> => entry.kind === 'SUBFORM',
  )

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setIsFormLoading(true)
    setFormError('')
    getAppForm(appId, formName)
      .then((loaded) => {
        if (!cancelled) setForm(loaded)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setFormError(toErrorMessage(caught, '加载表单失败'))
      })
      .finally(() => {
        if (!cancelled) setIsFormLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, appId, formName])

  React.useEffect(() => {
    if (!open) return
    const nextMode: AppRecordDrawerMode = recordId ? (initialModeRef.current ?? 'view') : 'create'
    setMode(nextMode)
    setActiveRecordId(recordId ?? null)
    setRecord(null)
    setValues({})
    setDirty(false)
    setError('')
    setDeleteOpen(false)
    setFlowOpen(false)
    setDiscardKind(null)
  }, [open, appId, formName, recordId])

  React.useEffect(() => {
    if (!open || !form || !isCreate || dirty) return
    setValues(initialCreateValues(form))
  }, [open, form, isCreate, dirty])

  const loadRecord = React.useCallback(() => {
    if (!open || !activeRecordId) return
    let cancelled = false
    getAppRecord(appId, formName, activeRecordId)
      .then((loaded) => {
        if (!cancelled) setRecord(loaded)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(toErrorMessage(caught, '加载记录失败'))
      })
    return () => {
      cancelled = true
    }
  }, [open, appId, formName, activeRecordId])

  React.useEffect(() => {
    if (!open || !activeRecordId) return
    return loadRecord()
  }, [open, activeRecordId, loadRecord])

  React.useEffect(() => {
    if (!open || mode !== 'edit' || !form || !record || dirty) return
    setValues(toEditValues(form, record))
  }, [open, mode, form, record, dirty])

  const buildPayload = (): AppRecord | null => {
    if (uploading) {
      setError('请等待附件上传完成')
      return null
    }
    return form && !recordPending
      ? buildRecordPayload(form, parseFormLayout(form).renderableFieldNames, values, setError, !activeRecordId)
      : null
  }

  const persistRecord = (payload: AppRecord) =>
    activeRecordId
      ? updateAppRecord(appId, formName, activeRecordId, payload)
      : createAppRecord(appId, formName, payload)

  const startEdit = () => {
    if (!form || !record) return
    setValues(toEditValues(form, record))
    setDirty(false)
    setError('')
    setMode('edit')
  }

  const requestClose = () => {
    if (isCreate) {
      if (dirty || activeRecordId) {
        setDiscardKind('close')
        return
      }
      onOpenChange(false)
      return
    }
    if (mode === 'edit' && dirty) {
      setDiscardKind('close')
      return
    }
    onOpenChange(false)
  }

  const confirmDiscard = () => {
    const kind = discardKind
    setDiscardKind(null)
    if (kind === 'close') {
      onOpenChange(false)
    } else if (kind === 'edit') {
      setMode('view')
      setDirty(false)
    }
  }

  const save = async () => {
    const payload = buildPayload()
    if (!payload) return
    setIsSubmitting(true)
    setError('')
    try {
      const saved = await persistRecord(payload)
      const id = String(saved.id ?? '')
      if (!recordId && id) setActiveRecordId(id)
      setRecord(saved)
      setDirty(false)
      setMode('view')
      message.success('保存成功')
      onSaved?.(id)
    } catch (caught: unknown) {
      setError(toErrorMessage(caught, '保存记录失败'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const persistForSubform = async (): Promise<string | null> => {
    if (isSubmitting || isStarting || isSavingSubform) return null
    const payload = buildPayload()
    if (!payload) return null
    setIsSavingSubform(true)
    try {
      const saved = await persistRecord(payload)
      const id = String(saved.id ?? '')
      if (!activeRecordId && id) {
        setActiveRecordId(id)
        message.success('主表单已自动保存')
      }
      return id || null
    } catch (caught: unknown) {
      setError(toErrorMessage(caught, '保存记录失败'))
      return null
    } finally {
      setIsSavingSubform(false)
    }
  }

  const confirmDelete = async () => {
    if (!activeRecordId) return
    setIsDeleting(true)
    try {
      await deleteAppRecord(appId, formName, activeRecordId)
      setDeleteOpen(false)
      onOpenChange(false)
      onDeleted?.()
    } catch (caught: unknown) {
      message.error(toErrorMessage(caught, '删除记录失败'))
    } finally {
      setIsDeleting(false)
    }
  }

  const openFlowDialog = () => {
    if (isCreate) {
      const payload = buildPayload()
      if (!payload) return
    }
    setFlowId((isCreate ? flows : approval.flows)[0]?.id ?? '')
    setFlowOpen(true)
  }

  const startFlow = async () => {
    setIsStarting(true)
    setError('')
    try {
      let id = activeRecordId ?? ''
      if (isCreate) {
        const payload = buildPayload()
        if (!payload) return
        const saved = await persistRecord(payload)
        id = String(saved.id ?? '')
      }
      await submitApproval(appId, formName, id, flowId, requestKey.current)
      requestKey.current = crypto.randomUUID()
      setFlowOpen(false)
      if (isCreate) {
        onOpenChange(false)
        onSaved?.(id)
      } else {
        approval.refresh()
      }
      message.success('已提交，流程正在启动')
    } catch (caught: unknown) {
      setFlowOpen(false)
      setError(toErrorMessage(caught, '发起流程失败'))
    } finally {
      setIsStarting(false)
    }
  }

  const renderSubform = (item: AppFormItem) => {
    if (!form || !item.formName || !item.referenceField) return null
    const interactive = mode !== 'view' && !recordPending
    return (
      <AppSubformRecords
        appId={appId}
        mainFormName={formName}
        mainRecordId={activeRecordId}
        subform={{formName: item.formName, referenceField: item.referenceField}}
        readOnly={!interactive}
        onBeforeCreate={interactive ? persistForSubform : undefined}
      />
    )
  }

  const title = (() => {
    if (!form) return '记录'
    if (mode === 'view') {
      return recordTitle(record?.[form.displayField ?? 'id'], activeRecordId ?? '')
    }
    return isCreate ? `新建${form.label}` : `编辑${form.label}`
  })()

  const lockHint = approvalLocked && activeRecordId ? (
    <span className="mr-auto inline-flex items-center gap-1 text-xs font-medium text-destructive">
      <LockKeyhole className="h-3.5 w-3.5"/>审批中，记录已锁定
    </span>
  ) : null

  const footer = form ? (mode === 'view' ? (
    <>
      {lockHint}
      {!isCreate && !approvalLocked && approval.flows.length > 0 && (
        <Button variant="outline" onClick={openFlowDialog}>
          <Send className="h-4 w-4"/>提交审批
        </Button>
      )}
      <Button variant="secondary" disabled={approvalLocked} onClick={() => setDeleteOpen(true)}>
        <Trash2 className="h-4 w-4"/>删除
      </Button>
      <Button disabled={approvalLocked || recordPending} onClick={startEdit}>
        <Pencil className="h-4 w-4"/>编辑
      </Button>
      {approval.myTask && (
        <>
          <Button variant="secondary" disabled={decision.busy} onClick={() => decision.openDecision('reject')}>
            <X className="h-4 w-4"/>不同意
          </Button>
          <Button disabled={decision.busy} onClick={() => decision.openDecision('approve')}>
            <Check className="h-4 w-4"/>同意
          </Button>
        </>
      )}
    </>
  ) : (
    <>
      {lockHint ?? (
        <span className="mr-auto max-w-[50%] truncate text-xs text-muted-foreground"
              title="子表记录的增删改会即时保存；主表单字段需点击保存">
          子表记录即时保存，主表单字段点击「保存」生效
        </span>
      )}
      <Button
        variant="secondary"
        disabled={isSubmitting || isStarting}
        onClick={() => {
          if (mode === 'edit') {
            if (dirty) {
              setDiscardKind('edit')
              return
            }
            setMode('view')
            return
          }
          if (dirty || activeRecordId) {
            setDiscardKind('close')
            return
          }
          onOpenChange(false)
        }}
      >
        取消
      </Button>
      <Button onClick={save} disabled={isSubmitting || isStarting || uploading || approvalLocked || recordPending}>
        {isSubmitting ? '保存中…' : '保存'}
      </Button>
      {isCreate && flows.length > 0 && (
        <Button variant="outline" disabled={isSubmitting || isStarting || uploading} onClick={openFlowDialog}>
          <Send className="h-4 w-4"/>发起流程
        </Button>
      )}
    </>
  )) : undefined

  return (
    <>
      <BizDrawer
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose()
          else onOpenChange(next)
        }}
        title={title}
        moreMenu={form ? (
          <FormMoreMenu
            onOpenDesign={() => {
              onOpenChange(false)
              navigate(`/admin/apps/${appId}/forms/${encodeURIComponent(formName)}/form-design`)
            }}
          />
        ) : undefined}
        footer={footer}
        aside={mode === 'view' && !form?.builtin && approval.progressInstanceId ? (
          <ApprovalProgressPanel appId={appId} instanceId={approval.progressInstanceId}/>
        ) : undefined}
        asideLabel="审批"
      >
        {isFormLoading && <AppLoading center className="min-h-[240px]"/>}
        {!isFormLoading && formError && (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">{formError}</div>
        )}
        {form && !isFormLoading && (
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
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
                          {field.required && <span className="text-destructive">*</span>}
                          {item.tip && <Info className="h-3.5 w-3.5 text-muted-foreground"/>}
                        </label>
                        <FieldControl
                          key={`${appId}/${formName}/${recordId ?? 'new'}/${field.name}`}
                          appId={appId}
                          formId={formName}
                          field={field}
                          value={values[field.name]}
                          options={field.options ?? []}
                          referenceOptions={referenceOptionsMap[field.name] ?? ([] as ReferenceOption[])}
                          disabled={item.readonly || !isFieldWritable(field, !activeRecordId) || recordPending || isSubmitting || isStarting}
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
              </div>
            )}
            {subformEntries.map((entry) => {
              const content = renderSubform(entry.item)
              if (!content) return null
              return (
                <div key={entry.key}>
                  {content}
                </div>
              )
            })}
          </div>
        )}
      </BizDrawer>

      <BizDialog
        open={!!discardKind}
        onOpenChange={(next) => {
          if (!next) setDiscardKind(null)
        }}
        title="放弃未保存的修改"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDiscardKind(null)}>继续编辑</Button>
            <Button variant="danger" onClick={confirmDiscard}>放弃修改</Button>
          </>
        }
      >
        <div className="text-sm text-muted-foreground">
          {isCreate && activeRecordId
            ? '主表单已自动保存并保留；未保存的字段修改将丢弃。确定继续吗？'
            : '当前内容存在未保存的修改，放弃后将不可恢复。确定继续吗？'}
        </div>
      </BizDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除记录"
        message="确认删除这条记录吗？删除后不可恢复。"
        busy={isDeleting}
        confirmText="删除"
        onConfirm={() => void confirmDelete()}
      />

      <FlowStartDialog
        open={flowOpen}
        onOpenChange={setFlowOpen}
        flows={isCreate ? flows : approval.flows}
        flowId={flowId}
        onFlowIdChange={setFlowId}
        isStarting={isStarting}
        onConfirm={() => void startFlow()}
      />

      <ApprovalDecisionDialog
        pending={decision.pending}
        comment={decision.comment}
        busy={decision.busy}
        onCommentChange={decision.setComment}
        onClose={decision.closeDecision}
        onConfirm={() => void decision.confirmDecision(approval.myTask)}
      />
    </>
  )
}

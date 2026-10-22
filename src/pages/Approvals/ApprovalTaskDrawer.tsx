import * as React from 'react'
import {Check, X} from 'lucide-react'
import {Drawer, DrawerContent, DrawerTitle} from '@/components/ui/drawer'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'
import {message} from '@/components/ui/message'
import {AppRecordFormModal} from '@/components/biz/AppRecordFormModal'
import {getAppForm, type AppForm} from '@/services/appForms'
import {decideApproval, type ApprovalItem} from '@/services/approvals'
import {ApprovalProgressPanel} from './ApprovalProgress'

const FINISHED_STATUS = ['APPROVED', 'REJECTED', 'TERMINATED']

/**
 * 审批记录抽屉：统一用记录表单呈现审批关联的记录，右侧内嵌流程进度面板（右上角按钮展开/折叠）。
 * - 待我审批：只读表单 + 同意/不同意
 * - 流程进行中：只读表单
 * - 流程已结束：可编辑表单（编辑模式的表单，可保存）
 */
export function ApprovalTaskDrawer({item, onClose, onChanged}: {
  item: ApprovalItem | null
  onClose: () => void
  onChanged?: () => void
}) {
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [error, setError] = React.useState('')
  const [decision, setDecision] = React.useState<'approve' | 'reject' | null>(null)
  const [comment, setComment] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [revision, reload] = React.useReducer(value => value + 1, 0)
  const request = React.useRef<{
    taskId: string;
    decision: 'approve' | 'reject';
    comment: string;
    key: string
  } | null>(null)

  // 待我审批的任务：列表项带 taskId 且尚未决策（已处理条目也带 taskId，但有 decision）
  const hasTask = !!item?.taskId && !item?.decision
  const finished = item ? FINISHED_STATUS.includes(item.status) : false
  const readOnly = !item || hasTask || !finished

  React.useEffect(() => {
    if (!item) return
    let active = true
    setForm(null)
    setError('')
    getAppForm(item.appId, item.formName)
      .then((loaded) => {
        if (active) {
          setForm(loaded)
          setError('')
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : '读取表单失败')
      })
    return () => {
      active = false
    }
  }, [item?.appId, item?.formName, item?.recordId, revision])

  const openDecision = (next: 'approve' | 'reject') => {
    setComment('')
    setDecision(next)
  }

  const closeDecision = () => {
    if (busy) return
    setDecision(null)
    setComment('')
  }

  const confirm = async () => {
    if (!item?.taskId || !decision) return
    setBusy(true)
    try {
      if (!request.current
        || request.current.taskId !== item.taskId
        || request.current.decision !== decision
        || request.current.comment !== comment) {
        request.current = {
          taskId: item.taskId,
          decision,
          comment,
          key: crypto.randomUUID(),
        }
      }
      await decideApproval(item.appId, item.taskId, decision, comment, request.current.key)
      request.current = null
      setDecision(null)
      setComment('')
      message.success(decision === 'approve' ? '已同意，流程正在继续' : '已拒绝，流程正在结束')
      onChanged?.()
      onClose()
    } catch (caught: unknown) {
      message.error(caught instanceof Error ? caught.message : '签核失败，可重试')
    } finally {
      setBusy(false)
    }
  }

  const footer = hasTask ? (
    <>
      <Button variant="secondary" onClick={() => openDecision('reject')}>
        <X className="h-4 w-4"/>不同意
      </Button>
      <Button onClick={() => openDecision('approve')}>
        <Check className="h-4 w-4"/>同意
      </Button>
    </>
  ) : !finished ? (
    <Button variant="secondary" onClick={onClose}>关闭</Button>
  ) : undefined

  return (
    <>
      {item && !form && (
        <Drawer open onOpenChange={open => !open && onClose()}>
          <DrawerContent className="w-[min(96vw,720px)]">
            <div className="border-b px-6 py-5">
              <DrawerTitle
                className="text-base font-semibold">{hasTask ? `审批：${item.title}` : item.title}</DrawerTitle>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6 text-sm text-muted-foreground">
              {error
                ? (
                  <div role="alert" className="text-destructive">
                    {error}
                    <Button variant="link" onClick={reload}>重试</Button>
                  </div>
                )
                : '正在读取审批…'}
            </div>
          </DrawerContent>
        </Drawer>
      )}
      {item && form && (
        <AppRecordFormModal
          open
          onOpenChange={open => !open && onClose()}
          appId={item.appId}
          form={form}
          recordId={item.recordId}
          readOnly={readOnly}
          title={hasTask ? `审批：${item.title}` : item.title}
          footer={footer}
          aside={item ? <ApprovalProgressPanel appId={item.appId} instanceId={item.id}/> : undefined}
          onSaved={() => onChanged?.()}
        />
      )}
      <BizDialog
        open={!!decision}
        onOpenChange={open => !open && closeDecision()}
        title={decision === 'approve' ? '同意审批' : '不同意审批'}
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={closeDecision}>取消</Button>
            <Button disabled={busy} onClick={() => void confirm()}>
              {busy ? '提交中…' : decision === 'approve' ? '确认同意' : '确认不同意'}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">审批意见（选填）</label>
          <Textarea
            aria-label="审批意见"
            placeholder="填写审批意见"
            value={comment}
            maxLength={2000}
            onChange={event => setComment(event.target.value)}
          />
        </div>
      </BizDialog>
    </>
  )
}

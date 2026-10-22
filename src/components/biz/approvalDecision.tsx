import * as React from 'react'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'
import {message} from '@/components/ui/message'
import {decideApproval} from '@/services/approvals'
import {toErrorMessage} from '@/lib/utils'

export type ApprovalDecisionKind = 'approve' | 'reject'

interface DecisionRequest {
  taskId: string
  decision: ApprovalDecisionKind
  comment: string
  key: string
}

/**
 * 审批决策（同意/不同意）共享逻辑：
 * 弹窗状态、审批意见、幂等 key 去重与 decideApproval 调用。
 */
export function useApprovalDecision(appId: string, onDecided?: () => void | Promise<void>) {
  const [pending, setPending] = React.useState<ApprovalDecisionKind | null>(null)
  const [comment, setComment] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const request = React.useRef<DecisionRequest | null>(null)

  const decide = React.useCallback(async (taskId: string | null | undefined, kind: ApprovalDecisionKind) => {
    if (!taskId) return false
    setBusy(true)
    try {
      if (!request.current
        || request.current.taskId !== taskId
        || request.current.decision !== kind
        || request.current.comment !== comment) {
        request.current = {taskId, decision: kind, comment, key: crypto.randomUUID()}
      }
      await decideApproval(appId, taskId, kind, comment, request.current.key)
      request.current = null
      setComment('')
      message.success(kind === 'approve' ? '已同意，流程正在继续' : '已拒绝，流程正在结束')
      await onDecided?.()
      return true
    } catch (caught: unknown) {
      message.error(toErrorMessage(caught, '签核失败，可重试'))
      return false
    } finally {
      setBusy(false)
    }
  }, [appId, comment, onDecided])

  const openDecision = (kind: ApprovalDecisionKind) => {
    setComment('')
    setPending(kind)
  }

  const closeDecision = () => {
    if (busy) return
    setPending(null)
    setComment('')
  }

  const confirmDecision = (taskId: string | null | undefined) => {
    if (!pending) return
    return decide(taskId, pending).then((ok) => {
      if (ok) setPending(null)
    })
  }

  return {pending, comment, setComment, busy, decide, openDecision, closeDecision, confirmDecision}
}

/** 同意/不同意审批弹窗：填写意见并确认 */
export function ApprovalDecisionDialog({pending, comment, busy, onCommentChange, onClose, onConfirm}: {
  pending: 'approve' | 'reject' | null
  comment: string
  busy: boolean
  onCommentChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <BizDialog
      open={!!pending}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={pending === 'approve' ? '同意审批' : '不同意审批'}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>取消</Button>
          <Button disabled={busy} onClick={onConfirm}>
            {busy ? '提交中…' : pending === 'approve' ? '确认同意' : '确认不同意'}
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
          onChange={(event) => onCommentChange(event.target.value)}
        />
      </div>
    </BizDialog>
  )
}

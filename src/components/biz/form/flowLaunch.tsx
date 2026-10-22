import * as React from 'react'
import {Button} from '@/components/ui/button'
import {BizDialog} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {getApprovalFlows} from '@/services/approvals'
import type {ApprovalFlow} from '@/types/approval'

/** 加载指定表单已启用、可发起的审批流程列表 */
export function useFormApprovalFlows({appId, formName, enabled}: {
  appId: string
  formName: string
  enabled: boolean
}) {
  const [flows, setFlows] = React.useState<ApprovalFlow[]>([])
  React.useEffect(() => {
    if (!enabled) return
    let cancelled = false
    getApprovalFlows(appId)
      .then((definitions) => {
        if (!cancelled) setFlows(definitions.filter((flow) =>
          flow.status === 'enabled' && flow.form.kind === 'app' && flow.form.name === formName))
      })
      .catch(() => {
        if (!cancelled) setFlows([])
      })
    return () => {
      cancelled = true
    }
  }, [appId, formName, enabled])
  return flows
}

/** 发起流程弹窗：选择审批流程并确认 */
export function FlowStartDialog({open, onOpenChange, flows, flowId, onFlowIdChange, isStarting, onConfirm}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  flows: ApprovalFlow[]
  flowId: string
  onFlowIdChange: (value: string) => void
  isStarting: boolean
  onConfirm: () => void
}) {
  return (
    <BizDialog
      open={open}
      onOpenChange={onOpenChange}
      title="发起流程"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isStarting}>取消</Button>
          <Button onClick={onConfirm} disabled={isStarting || !flowId}>
            {isStarting ? '提交中…' : '确认发起'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">选择审批流程</label>
          <Select value={flowId} onValueChange={onFlowIdChange}>
            <SelectTrigger>
              <SelectValue placeholder="请选择审批流程"/>
            </SelectTrigger>
            <SelectContent>
              {flows.map((flow) => (
                <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          提交时会保存记录快照。审批结束前，人工编辑和删除将被锁定，流程配置的数据操作继续执行。
        </p>
      </div>
    </BizDialog>
  )
}

import * as React from 'react'
import {Check, LockKeyhole, Send, Workflow, X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {BizDialog} from '@/components/ui/dialog'
import {message} from '@/components/ui/message'
import {
  FINISHED_STATUS,
  getApprovalDetail,
  recordApprovals,
  submitApproval,
  approvalStatus,
  type ApprovalItem
} from '@/services/approvals'
import {getApprovalFlows} from '@/services/workflows'
import {getAuthSession} from '@/services/auth'
import type {ApprovalFlow} from '@/types/workflow'
import {InstanceDrawer} from './InstanceDrawer'
import {Choice} from '../Workflows/controls'
import {ApprovalDecisionDialog, useApprovalDecision} from '@/components/biz/approvalDecision'
import {toErrorMessage} from '@/lib/utils'

/** 记录审批面板：审批状态与历史、提交审批；进行中且待我审批时提供同意/不同意 */
export function RecordApprovalPanel({appId, formName, recordId, onLocked}: {
  appId: string;
  formName: string;
  recordId: string;
  onLocked: (value: boolean) => void
}) {
  const [flows, setFlows] = React.useState<ApprovalFlow[]>([])
  const [history, setHistory] = React.useState<ApprovalItem[]>([])
  const [error, setError] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [detail, setDetail] = React.useState<ApprovalItem | null>(null)
  const [myTask, setMyTask] = React.useState<{ instanceId: string; taskId: string } | null>(null)
  const key = React.useRef(crypto.randomUUID())
  const decision = useApprovalDecision(appId, () => load())
  const locked = history.some(item => !FINISHED_STATUS.includes(item.status))
  React.useEffect(() => {
    onLocked(locked)
  }, [locked, onLocked])
  const load = React.useCallback(async () => {
    try {
      const [definitions, runs] = await Promise.all([getApprovalFlows(appId), recordApprovals(appId, formName, recordId)]);
      setFlows(definitions.filter(flow => flow.status === 'enabled' && flow.form.kind === 'app' && flow.form.name === formName));
      setHistory(runs);
      setError('')
      const active = runs.find(item => !FINISHED_STATUS.includes(item.status))
      if (active) {
        try {
          const instance = await getApprovalDetail(appId, active.id)
          const actor = getAuthSession()?.user.id
          const task = instance.tasks.find(task => task.userId === actor && task.status === 'PENDING')
          setMyTask(task ? {instanceId: active.id, taskId: task.id} : null)
        } catch {
          setMyTask(null)
        }
      } else {
        setMyTask(null)
      }
    } catch (cause) {
      setError(toErrorMessage(cause, '读取审批状态失败'))
    }
  }, [appId, formName, recordId])
  React.useEffect(() => {
    void load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer)
  }, [load])
  const submit = async () => {
    setBusy(true)
    try {
      await submitApproval(appId, formName, recordId, selected, key.current);
      key.current = crypto.randomUUID();
      setOpen(false);
      await load();
      message.success('已提交，流程正在启动')
    } catch (cause) {
      message.error(toErrorMessage(cause, '提交失败，请重试'))
    } finally {
      setBusy(false)
    }
  }
  return <>
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Workflow
          className="h-4 w-4 text-primary"/>表单审批{locked &&
          <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground"><LockKeyhole
            className="h-3 w-3"/>记录已锁定</span>}</div>
        <Button size="sm" variant="outline" disabled={locked || busy || !flows.length || !!error} onClick={() => {
          setSelected(flows[0]?.id ?? '');
          setOpen(true)
        }}><Send className="h-3.5 w-3.5"/>提交审批</Button></div>
      {error ? <div role="alert" className="flex justify-between text-xs text-destructive">{error}
        <button onClick={() => void load()}>重试</button>
      </div> : myTask ? (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">当前流程待你审批</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" className="flex-1" disabled={decision.busy}
                    onClick={() => decision.openDecision('reject')}><X className="h-3.5 w-3.5"/>不同意</Button>
            <Button size="sm" className="flex-1" disabled={decision.busy}
                    onClick={() => decision.openDecision('approve')}><Check className="h-3.5 w-3.5"/>同意</Button>
          </div>
        </div>
      ) : !history.length ? <p
          className="text-xs text-muted-foreground">{flows.length ? '选择流程后提交，审批期间禁止人工编辑和删除。' : '当前表单暂无已启用的工作流。'}</p> :
        <div className="space-y-2">{history.map(item => <button key={item.id}
                                                                className="flex w-full justify-between gap-3 text-left text-xs"
                                                                onClick={() => setDetail(item)}>
          <span>{item.title}</span><span
          className="text-muted-foreground">{approvalStatus[item.status] ?? item.status} →</span></button>)}</div>}
    </div>
    <BizDialog open={open} onOpenChange={setOpen} title="提交记录审批"
               footer={<><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button
                 disabled={busy || !selected}
                 onClick={() => void submit()}>{busy ? '提交中…' : '确认提交'}</Button></>}>
      <div className="space-y-4"><Choice label="选择工作流" value={selected} onChange={setSelected}
                                         options={flows.map(flow => ({value: flow.id, label: flow.name}))}/><p
        className="text-sm text-muted-foreground">提交时会保存记录快照。审批结束前，人工编辑和删除将被锁定，流程配置的数据操作继续执行。</p>
      </div>
    </BizDialog>
    <ApprovalDecisionDialog
      pending={decision.pending}
      comment={decision.comment}
      busy={decision.busy}
      onCommentChange={decision.setComment}
      onClose={decision.closeDecision}
      onConfirm={() => void decision.confirmDecision(myTask?.taskId)}
    />
    <InstanceDrawer item={detail} onClose={() => setDetail(null)} onChanged={() => void load()}/>
  </>
}

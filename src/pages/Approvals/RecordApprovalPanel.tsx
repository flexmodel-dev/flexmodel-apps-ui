import * as React from 'react'
import {Check, LockKeyhole, Send, Workflow, X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {BizDialog} from '@/components/ui/dialog'
import {Textarea} from '@/components/ui/textarea'
import {message} from '@/components/ui/message'
import {
  decideApproval,
  getApprovalDetail,
  getApprovalFlows,
  recordApprovals,
  submitApproval,
  approvalStatus,
  type ApprovalItem
} from '@/services/approvals'
import {getAuthSession} from '@/services/auth'
import type {ApprovalFlow} from '@/types/approval'
import {InstanceDrawer} from './InstanceDrawer'
import {Choice} from './controls'

const FINISHED_STATUS = ['APPROVED', 'REJECTED', 'TERMINATED']

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
  const [decision, setDecision] = React.useState<'approve' | 'reject' | null>(null)
  const [comment, setComment] = React.useState('')
  const key = React.useRef(crypto.randomUUID())
  const request = React.useRef<{
    taskId: string;
    decision: 'approve' | 'reject';
    comment: string;
    key: string
  } | null>(null)
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
          const task = instance.tasks.find(task => task.user_id === actor && task.status === 'PENDING')
          setMyTask(task ? {instanceId: active.id, taskId: task.id} : null)
        } catch {
          setMyTask(null)
        }
      } else {
        setMyTask(null)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取审批状态失败')
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
      message.error(cause instanceof Error ? cause.message : '提交失败，请重试')
    } finally {
      setBusy(false)
    }
  }
  const openDecision = (next: 'approve' | 'reject') => {
    setComment('')
    setDecision(next)
  }
  const closeDecision = () => {
    if (busy) return
    setDecision(null)
    setComment('')
  }
  const confirmDecision = async () => {
    if (!myTask || !decision) return
    setBusy(true)
    try {
      if (!request.current
        || request.current.taskId !== myTask.taskId
        || request.current.decision !== decision
        || request.current.comment !== comment) {
        request.current = {
          taskId: myTask.taskId,
          decision,
          comment,
          key: crypto.randomUUID(),
        }
      }
      await decideApproval(appId, myTask.taskId, decision, comment, request.current.key)
      request.current = null
      setDecision(null)
      setComment('')
      message.success(decision === 'approve' ? '已同意，流程正在继续' : '已拒绝，流程正在结束')
      await load()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '签核失败，可重试')
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
            <Button size="sm" variant="secondary" className="flex-1" disabled={busy}
                    onClick={() => openDecision('reject')}><X className="h-3.5 w-3.5"/>不同意</Button>
            <Button size="sm" className="flex-1" disabled={busy}
                    onClick={() => openDecision('approve')}><Check className="h-3.5 w-3.5"/>同意</Button>
          </div>
        </div>
      ) : !history.length ? <p
          className="text-xs text-muted-foreground">{flows.length ? '选择流程后提交，审批期间禁止人工编辑和删除。' : '当前表单暂无已启用的审批流程。'}</p> :
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
      <div className="space-y-4"><Choice label="选择审批流程" value={selected} onChange={setSelected}
                                         options={flows.map(flow => ({value: flow.id, label: flow.name}))}/><p
        className="text-sm text-muted-foreground">提交时会保存记录快照。审批结束前，人工编辑和删除将被锁定，流程配置的数据操作继续执行。</p>
      </div>
    </BizDialog>
    <BizDialog open={!!decision} onOpenChange={next => !next && closeDecision()}
               title={decision === 'approve' ? '同意审批' : '不同意审批'}
               footer={<><Button variant="secondary" disabled={busy} onClick={closeDecision}>取消</Button><Button
                 disabled={busy} onClick={() => void confirmDecision()}>
                 {busy ? '提交中…' : decision === 'approve' ? '确认同意' : '确认不同意'}</Button></>}>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">审批意见（选填）</label>
        <Textarea aria-label="审批意见" placeholder="填写审批意见" value={comment} maxLength={2000}
                  onChange={event => setComment(event.target.value)}/>
      </div>
    </BizDialog>
    <InstanceDrawer item={detail} onClose={() => setDetail(null)} onChanged={() => void load()}/>
  </>
}

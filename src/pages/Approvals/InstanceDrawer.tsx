import * as React from 'react'
import {Check, X, RefreshCw, ShieldCheck} from 'lucide-react'
import {Drawer, DrawerContent, DrawerTitle, DrawerDescription} from '@/components/ui/drawer'
import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'
import {message} from '@/components/ui/message'
import {getAuthSession} from '@/services/auth'
import {
  approvalStatus,
  decideApproval,
  getApprovalDetail,
  getApprovalDirectory,
  manageApproval,
  retryApprovalNotifications,
  type ApprovalDetail,
  type ApprovalItem
} from '@/services/approvals'
import {ApprovalTimeline} from './ApprovalProgress'

export function InstanceDrawer({item, onClose, onChanged}: {
  item: ApprovalItem | null;
  onClose: () => void;
  onChanged?: () => void
}) {
  const [detail, setDetail] = React.useState<ApprovalDetail | null>(null)
  const [names, setNames] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState('')
  const [comment, setComment] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [child, setChild] = React.useState<ApprovalItem | null>(null)
  const request = React.useRef<{ task: string; decision: string; comment: string; key: string } | null>(null)
  const actor = getAuthSession()?.user.id
  React.useEffect(() => {
    if (!item) return
    let active = true
    setDetail(null);
    setError('');
    setComment('');
    request.current = null
    const load = async () => {
      try {
        const loaded = await getApprovalDetail(item.appId, item.id);
        if (active) {
          setDetail(loaded);
          setError('')
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '读取审批失败')
      }
    }
    void load()
    getApprovalDirectory(item.appId).then(value => {
      if (active) setNames(Object.fromEntries(value.members.map(member => [member.id, member.name])))
    }).catch(() => {
    })
    const timer = window.setInterval(load, 2500)
    return () => {
      active = false;
      window.clearInterval(timer)
    }
  }, [item?.appId, item?.id])
  const task = detail?.tasks.find(task => task.user_id === actor && task.status === 'PENDING')
  const act = async (decision: 'approve' | 'reject') => {
    if (!item || !task) return
    setBusy(true)
    try {
      if (!request.current || request.current.task !== task.id || request.current.decision !== decision || request.current.comment !== comment) request.current = {
        task: task.id,
        decision,
        comment,
        key: crypto.randomUUID()
      }
      await decideApproval(item.appId, task.id, decision, comment, request.current.key)
      setDetail(await getApprovalDetail(item.appId, item.id));
      setComment('');
      request.current = null
      message.success(decision === 'approve' ? '已同意，流程正在继续' : '已拒绝，流程正在结束');
      onChanged?.()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '签核失败，可重试')
    } finally {
      setBusy(false)
    }
  }
  const manage = async (action: 'retry' | 'terminate') => {
    if (!item) return
    if (action === 'terminate' && !window.confirm('确认终止该审批？已执行的数据操作会保留。')) return
    setBusy(true)
    try {
      await manageApproval(item.appId, item.id, action);
      message.success(action === 'retry' ? '已重新投递失败消息' : '已提交终止请求');
      onChanged?.()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }
  return <><Drawer open={!!item} onOpenChange={open => !open && onClose()}><DrawerContent
    className="w-[min(96vw,720px)]">
    <div className="border-b px-6 py-5 pr-12"><DrawerTitle
      className="flex items-center gap-2 text-base font-semibold"><ShieldCheck
      className="h-5 w-5 text-primary"/>{item?.title ?? '审批详情'}</DrawerTitle><DrawerDescription
      className="mt-2 text-xs text-muted-foreground">提交快照、签核进度与节点执行记录</DrawerDescription></div>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
      {error &&
        <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      {!detail && !error && <p className="text-sm text-muted-foreground">正在读取审批…</p>}
      {detail && <>
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div><p className="font-medium">{approvalStatus[detail.status] ?? detail.status}</p><p
            className="mt-1 text-xs text-muted-foreground">发起人 {names[detail.initiator] ?? detail.initiator} · {new Date(detail.createdAt).toLocaleString()}</p>
          </div>
          <span className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">{detail.formName}</span></div>
        {!!detail.delivery.some(item => item.error) &&
          <div className="space-y-2 rounded-lg border border-destructive/30 p-4"><p
            className="text-sm font-medium">流程等待恢复</p>{detail.delivery.filter(item => item.error).map(item => <p
            key={item.messageId} className="break-words text-xs text-destructive">{item.error} ·
            已尝试 {item.attempts} 次</p>)}{detail.canManage &&
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void manage('retry')}><RefreshCw
              className="h-3.5 w-3.5"/>重试失败消息</Button>}</div>}
        {!!detail.notificationDelivery?.some(item => item.error) &&
          <div className="space-y-2 rounded-lg border border-destructive/30 p-4"><p
            className="text-sm font-medium">通知投递失败，流程继续</p>{detail.notificationDelivery.filter(item => item.error).map(item =>
            <p key={item.messageId} className="text-xs text-destructive">{item.error} ·
              已尝试 {item.attempts} 次</p>)}{detail.canManage &&
            <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
              if (!item) return;
              setBusy(true);
              try {
                await retryApprovalNotifications(item.appId, item.id);
                setDetail(await getApprovalDetail(item.appId, item.id));
                message.success('已重新投递失败通知')
              } catch (error) {
                message.error(error instanceof Error ? error.message : '重试失败')
              } finally {
                setBusy(false)
              }
            }}>重试通知</Button>}</div>}
        <section className="space-y-3"><h3 className="text-sm font-medium">提交时的表单快照</h3>
          <div
            className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-4">{Object.entries(detail.snapshot).map(([key, value]) =>
            <div key={key} className="min-w-0"><p className="text-xs text-muted-foreground">{key}</p><p
              className="mt-1 break-words text-sm">{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</p>
            </div>)}</div>
        </section>
        <section className="space-y-3"><h3 className="text-sm font-medium">签核进度</h3>
          <ApprovalTimeline detail={detail} names={names}/>
        </section>
        {!!detail.children.length &&
          <section className="space-y-2"><h3 className="text-sm font-medium">子流程</h3>{detail.children.map(child =>
            <button key={child.id} onClick={() => setChild(child)}
                    className="flex w-full justify-between rounded-lg border bg-card p-3 text-left text-sm">
              <span>{child.title}</span><span
              className="text-xs text-muted-foreground">{approvalStatus[child.status] ?? child.status} →</span>
            </button>)}</section>}
        {!!detail.logs.length &&
          <section className="space-y-2"><h3 className="text-sm font-medium">节点执行记录</h3>{detail.logs.map(log =>
            <details key={log.id} className="rounded-lg border bg-card p-3">
              <summary className="cursor-pointer text-sm">{log.title}</summary>
              <p className="mt-3 text-xs text-muted-foreground">输入</p>
              <pre
                className="mt-1 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(log.input, null, 2)}</pre>
              <p className="mt-3 text-xs text-muted-foreground">输出</p>
              <pre
                className="mt-1 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(log.output, null, 2)}</pre>
            </details>)}</section>}
      </>}
    </div>
    {task ?
      <div className="space-y-3 border-t bg-card p-5"><Textarea aria-label="审批意见" placeholder="填写审批意见（选填）"
                                                                value={comment} maxLength={2000}
                                                                onChange={event => setComment(event.target.value)}/>
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy}
                                                        onClick={() => void act('reject')}><X className="h-4 w-4"/>拒绝</Button><Button
          disabled={busy} onClick={() => void act('approve')}><Check className="h-4 w-4"/>同意</Button></div>
      </div> : detail?.canManage && !['APPROVED', 'REJECTED', 'TERMINATED'].includes(detail.status) &&
      <div className="border-t p-4 text-right"><Button variant="outline" size="sm" disabled={busy}
                                                       onClick={() => void manage('terminate')}>终止审批</Button></div>}
  </DrawerContent></Drawer>{child && <InstanceDrawer item={child} onClose={() => setChild(null)}/>}</>
}

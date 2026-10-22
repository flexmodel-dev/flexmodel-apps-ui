import * as React from 'react'
import {approvalStatus, getApprovalDetail, getApprovalDirectory, type ApprovalDetail} from '@/services/approvals'

/** 签核进度时间线：InstanceDrawer 与抽屉右侧流程进度面板共用 */
export function ApprovalTimeline({detail, names}: {
  detail: ApprovalDetail
  names: Record<string, string>
}) {
  if (detail.waits.length === 0) {
    return <p className="text-xs text-muted-foreground">流程正在流转，暂未进入人工审批节点</p>
  }
  return (
    <div className="space-y-3">
      {detail.waits.map((wait) => (
        <div key={wait.id} className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex justify-between text-sm">
            <span>{wait.title}</span>
            <span className="text-xs text-muted-foreground">{{
              all: '会签',
              any: '或签',
              sequential: '依次审批',
            }[wait.sign_mode] ?? wait.sign_mode}</span>
          </div>
          <div className="space-y-2">
            {detail.tasks.filter((task) => task.wait_id === wait.id).sort((a, b) => a.position - b.position).map((task) => (
              <div key={task.id} className="flex justify-between gap-3 text-xs">
                <span>{names[task.user_id] ?? task.user_id}{task.comment &&
                  <span className="ml-2 text-muted-foreground">{task.comment}</span>}</span>
                <span className="shrink-0 text-muted-foreground">
                  {task.decision === 'approve' ? '已同意' : task.decision === 'reject' ? '已拒绝' : task.status === 'PENDING' ? '待处理' : task.status === 'WAITING' ? '等待前序审批' : '已关闭'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** 抽屉右侧流程进度面板：轮询刷新审批状态与签核进度 */
export function ApprovalProgressPanel({appId, instanceId}: {
  appId: string
  instanceId: string
}) {
  const [detail, setDetail] = React.useState<ApprovalDetail | null>(null)
  const [names, setNames] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let active = true
    setDetail(null)
    setError('')
    const load = async () => {
      try {
        const loaded = await getApprovalDetail(appId, instanceId)
        if (active) {
          setDetail(loaded)
          setError('')
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '读取审批失败')
      }
    }
    void load()
    getApprovalDirectory(appId).then((value) => {
      if (active) setNames(Object.fromEntries(value.members.map((member) => [member.id, member.name])))
    }).catch(() => {
    })
    const timer = window.setInterval(load, 3000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [appId, instanceId])

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">流程进度</h3>
      {error
        ? <p role="alert" className="rounded-md border border-destructive/30 p-3 text-xs text-destructive">{error}</p>
        : !detail
          ? <p className="text-xs text-muted-foreground">正在读取审批…</p>
          : <>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-sm font-medium">{approvalStatus[detail.status] ?? detail.status}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                发起人 {names[detail.initiator] ?? detail.initiator} · {new Date(detail.createdAt).toLocaleString()}
              </p>
            </div>
            <ApprovalTimeline detail={detail} names={names}/>
          </>}
    </div>
  )
}

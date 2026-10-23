import {Check, Clock3, Minus, X} from 'lucide-react'
import {approvalStatus, type ApprovalDetail, type ApprovalTask} from '@/services/approvals'
import {cn} from '@/lib/utils'
import {useApprovalDetail} from './useApprovalDetail'

const signModeLabel: Record<string, string> = {
  all: '会签',
  any: '或签',
  sequential: '依次审批',
}

const waitStatusLabel: Record<string, string> = {
  WAITING: '进行中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
}

const waitStatusClass: Record<string, string> = {
  WAITING: 'border-primary/30 bg-primary/5 text-primary',
  APPROVED: 'border-green-600/25 bg-green-600/5 text-green-600 dark:text-green-400',
  REJECTED: 'border-destructive/30 bg-destructive/5 text-destructive',
}

type TaskTone = 'success' | 'danger' | 'active' | 'muted'

const avatarClass: Record<TaskTone, string> = {
  success: 'bg-green-600/10 text-green-700 dark:text-green-400',
  danger: 'bg-destructive/10 text-destructive',
  active: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground',
}

const decisionTextClass: Record<TaskTone, string> = {
  success: 'text-green-600 dark:text-green-400',
  danger: 'text-destructive',
  active: 'text-primary',
  muted: 'text-muted-foreground',
}

const commentBorderClass: Record<TaskTone, string> = {
  success: 'border-green-600/40',
  danger: 'border-destructive/40',
  active: 'border-primary/40',
  muted: 'border-border',
}

function taskState(task: ApprovalTask): { label: string; tone: TaskTone } {
  if (task.decision === 'approve') return {label: '已同意', tone: 'success'}
  if (task.decision === 'reject') return {label: '已拒绝', tone: 'danger'}
  if (task.status === 'PENDING') return {label: '待处理', tone: 'active'}
  if (task.status === 'WAITING') return {label: '等待前序审批', tone: 'muted'}
  return {label: '已关闭', tone: 'muted'}
}

function taskIcon(task: ApprovalTask) {
  if (task.decision === 'approve') return <Check className="h-3 w-3"/>
  if (task.decision === 'reject') return <X className="h-3 w-3"/>
  if (task.status === 'PENDING' || task.status === 'WAITING') return <Clock3 className="h-3 w-3"/>
  return <Minus className="h-3 w-3"/>
}

function formatDecidedAt(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

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
      {detail.waits.map((wait) => {
        const tasks = detail.tasks
          .filter((task) => task.wait_id === wait.id)
          .sort((a, b) => a.position - b.position)
        return (
          <section key={wait.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">{wait.title}</span>
              <div className="flex shrink-0 items-center gap-1">
                {wait.sign_mode &&
                  <span
                    className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{signModeLabel[wait.sign_mode] ?? wait.sign_mode}</span>}
                <span className={cn('rounded border px-1.5 py-0.5 text-[10px]',
                  waitStatusClass[wait.status] ?? 'text-muted-foreground')}>
                  {waitStatusLabel[wait.status] ?? wait.status}
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {tasks.map((task) => {
                const state = taskState(task)
                const name = names[task.user_id] ?? task.user_id
                const comment = task.comment?.trim()
                const decidedAt = formatDecidedAt(task.decided_at)
                return (
                  <div key={task.id}>
                    <div className="flex items-start gap-2">
                      <span
                        className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium',
                          avatarClass[state.tone])}>
                        {name.trim().slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium">{name}</span>
                          <span className={cn('flex shrink-0 items-center gap-0.5 text-[11px]',
                            decisionTextClass[state.tone])}>
                            {taskIcon(task)}
                            {state.label}
                          </span>
                        </div>
                        {decidedAt &&
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{decidedAt}</p>}
                      </div>
                    </div>
                    {comment &&
                      <div className={cn('ml-8 mt-2 rounded-md border-l-2 bg-muted/40 px-2.5 py-2',
                        commentBorderClass[state.tone])}>
                        <p className="text-[10px] text-muted-foreground">审批意见</p>
                        <p
                          className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-5 text-foreground">{comment}</p>
                      </div>}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** 抽屉右侧流程进度面板：轮询刷新审批状态与签核进度 */
export function ApprovalProgressPanel({appId, instanceId}: {
  appId: string
  instanceId: string
}) {
  const {detail, names, error} = useApprovalDetail(appId, instanceId)

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

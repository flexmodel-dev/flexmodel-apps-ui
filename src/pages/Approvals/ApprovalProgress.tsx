import {AlertCircle, Check, CircleDashed, Clock3, GitBranch, Loader2, Minus, X} from 'lucide-react'
import type {ReactNode} from 'react'
import {
  approvalStatus,
  type ApprovalDetail,
  type ApprovalEndingNode,
  type ApprovalTask,
  type ApprovalUpcomingNode,
} from '@/services/approvals'
import {cn} from '@/lib/utils'
import {useApprovalDetail} from './useApprovalDetail'

const signModeLabel: Record<string, string> = {all: '会签', any: '或签', sequential: '依次审批'}
const kindLabel: Record<string, string> = {
  approval: '审批', subflow: '子流程', gateway: '条件分支', end: '流程结束',
}
const waitStatusLabel: Record<string, string> = {
  WAITING: '进行中', APPROVED: '已通过', REJECTED: '已拒绝', TERMINATED: '已终止', CANCELLED: '已关闭',
}
type Tone = 'success' | 'danger' | 'active' | 'muted'
const toneClass: Record<Tone, string> = {
  success: 'bg-green-600/10 text-green-700 dark:text-green-400',
  danger: 'bg-destructive/10 text-destructive',
  active: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground',
}
const markerClass: Record<Tone, string> = {
  success: 'border-green-600/25 bg-green-600/10 text-green-700 dark:text-green-400',
  danger: 'border-destructive/25 bg-destructive/10 text-destructive',
  active: 'border-primary/30 bg-primary/10 text-primary',
  muted: 'border-border bg-card text-muted-foreground',
}

function StatusBadge({tone, children}: { tone: Tone; children: ReactNode }) {
  return <span
    className={cn('inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium leading-5', toneClass[tone])}>{children}</span>
}

function taskState(task: ApprovalTask): { label: string; tone: Tone } {
  if (task.decision === 'approve') return {label: '已同意', tone: 'success'}
  if (task.decision === 'reject') return {label: '已拒绝', tone: 'danger'}
  if (task.status === 'PENDING') return {label: '待处理', tone: 'active'}
  if (task.status === 'WAITING') return {label: '等待前序审批', tone: 'muted'}
  return {label: '已关闭', tone: 'muted'}
}

function StateIcon({tone}: { tone: Tone }) {
  const Icon = tone === 'success' ? Check : tone === 'danger' ? X : tone === 'active' ? Clock3 : Minus
  return <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true"/>
}

function formatTime(value?: string, fullDate = false) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', {
    ...(fullDate ? {year: 'numeric'} as const : {}),
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function waitTone(status: string): Tone {
  return status === 'WAITING' ? 'active' : status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'danger' : 'muted'
}

function instanceTone(status: string): Tone {
  if (status === 'APPROVED') return 'success'
  if (['REJECTED', 'REJECTING', 'ERROR'].includes(status)) return 'danger'
  if (['TERMINATED', 'TERMINATING'].includes(status)) return 'muted'
  return 'active'
}

/** 以节点为主轴的签核时间线，详情侧栏与实例详情共用；预测节点以灰色接在末尾。 */
export function ApprovalTimeline({detail, names, upcoming = [], ending}: {
  detail: ApprovalDetail;
  names: Record<string, string>;
  upcoming?: ApprovalUpcomingNode[];
  ending?: ApprovalEndingNode | null
}) {
  if (!detail.waits.length && !upcoming.length && !ending) return <div
    className="rounded-lg border border-dashed p-4 text-center">
    <GitBranch className="mx-auto mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true"/>
    <p className="text-sm font-medium">{detail.status === 'APPROVED' ? '流程已完成' : '暂无审批节点'}</p>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">{['RUNNING', 'SUBMITTING'].includes(detail.status)
      ? '流程正在流转，暂未进入人工审批节点。' : '当前流程没有人工审批记录。'}</p>
  </div>

  const total = detail.waits.length + upcoming.length + (ending ? 1 : 0)
  const endTone = instanceTone(detail.status)
  return <ol aria-label="审批节点" className="min-w-0">
    {detail.waits.map((wait, index) => {
      const tone = waitTone(wait.status)
      const tasks = detail.tasks.filter(task => task.wait_id === wait.id).sort((a, b) => a.position - b.position)
      return <li key={wait.id} className="relative min-w-0 pb-6 last:pb-0"
                 aria-current={wait.status === 'WAITING' ? 'step' : undefined}>
        {index < total - 1 && <span aria-hidden="true" className="absolute bottom-0 left-3.5 top-7 w-px bg-border"/>}
        <span
          className={cn('absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border', markerClass[tone])}>
          <StateIcon tone={tone}/>
        </span>
        <section aria-label={wait.title} className="min-w-0 pl-10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4
              className="min-w-0 flex-1 break-words text-sm font-semibold leading-6 [overflow-wrap:anywhere]">{wait.title}</h4>
            <StatusBadge tone={tone}>{waitStatusLabel[wait.status] ?? wait.status}</StatusBadge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {signModeLabel[wait.sign_mode] ?? wait.sign_mode}{tasks.length > 0 &&
            <span> · {tasks.length} 位审批人</span>}
          </p>
          <div className="mt-3 space-y-4">
            {tasks.map(task => {
              const state = taskState(task)
              const name = names[task.user_id] ?? task.user_id
              const comment = task.comment?.trim()
              const decidedAt = formatTime(task.decided_at)
              return <div key={task.id} className="min-w-0">
                <div className="flex items-start gap-2.5">
                  <span aria-hidden="true"
                        className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium', toneClass[state.tone])}>
                    {name.trim().slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <span
                        className="min-w-0 break-words text-sm font-medium leading-5 [overflow-wrap:anywhere]">{name}</span>
                      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs',
                        state.tone === 'muted' ? 'text-muted-foreground' : state.tone === 'success' ? 'text-green-700 dark:text-green-400'
                          : state.tone === 'danger' ? 'text-destructive' : 'text-primary')}>
                        <StateIcon tone={state.tone}/>{state.label}
                      </span>
                    </div>
                    {decidedAt && <time dateTime={task.decided_at}
                                        className="mt-0.5 block text-xs leading-5 tabular-nums text-muted-foreground">{decidedAt}</time>}
                  </div>
                </div>
                {comment && <blockquote className="mt-2 rounded-lg bg-muted/60 px-3 py-2.5">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">审批意见</p>
                  <p
                    className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">{comment}</p>
                </blockquote>}
              </div>
            })}
            {!tasks.length && <p className="text-xs text-muted-foreground">暂无审批人记录</p>}
          </div>
        </section>
      </li>
    })}
    {upcoming.map((item, index) => {
      const position = detail.waits.length + index
      return <li key={item.id} className="relative min-w-0 pb-6 last:pb-0">
        {position < total - 1 && <span aria-hidden="true" className="absolute bottom-0 left-3.5 top-7 w-px bg-border"/>}
        <span aria-hidden="true"
              className={cn('absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border', markerClass.muted)}>
          {item.certain ? <CircleDashed className="h-3.5 w-3.5"/> : <GitBranch className="h-3.5 w-3.5"/>}
        </span>
        <section aria-label={item.title} className="min-w-0 pl-10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4
              className="min-w-0 flex-1 break-words text-sm font-semibold leading-6 text-muted-foreground [overflow-wrap:anywhere]">{item.title}</h4>
            <StatusBadge tone="muted">{item.certain ? '预计' : '待定'}</StatusBadge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {kindLabel[item.kind] ?? item.kind}{item.sign_mode &&
            <span> · {signModeLabel[item.sign_mode] ?? item.sign_mode}</span>}
          </p>
          {!item.certain && <div className="mt-2 space-y-1">
            <p className="text-xs leading-5 text-muted-foreground">可能进入：</p>
            {(item.candidates ?? []).map(candidate => <p key={candidate.id}
                                                         className="break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              · {candidate.title} · {candidate.sign_mode ? signModeLabel[candidate.sign_mode] ?? candidate.sign_mode : kindLabel[candidate.kind] ?? candidate.kind}
            </p>)}
            {!item.candidates?.length && <p className="text-xs leading-5 text-muted-foreground">分支内暂无审批节点</p>}
          </div>}
        </section>
      </li>
    })}
    {ending && <li className="relative min-w-0 pb-6 last:pb-0">
      <span aria-hidden="true"
            className={cn('absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border', markerClass[endTone])}>
        <StateIcon tone={endTone}/>
      </span>
      <section aria-label={ending.title} className="min-w-0 pl-10">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4
            className="min-w-0 flex-1 break-words text-sm font-semibold leading-6 [overflow-wrap:anywhere]">{ending.title}</h4>
          <StatusBadge tone={endTone}>{approvalStatus[detail.status] ?? detail.status}</StatusBadge>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{kindLabel.end}</p>
      </section>
    </li>}
  </ol>
}

/** 流程状态和当前节点置顶，审批历史沿时间线依次展开。 */
export function ApprovalProgressPanel({appId, instanceId}: { appId: string; instanceId: string }) {
  const {detail, names, error} = useApprovalDetail(appId, instanceId)
  const current = detail?.status === 'RUNNING' ? detail.waits.filter(wait => wait.status === 'WAITING') : []
  const pendingNames = detail ? [...new Set(detail.tasks.filter(task => task.status === 'PENDING')
    .map(task => names[task.user_id] ?? task.user_id))] : []
  const startedAt = formatTime(detail?.createdAt, true)
  return <section aria-label="流程进度" className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><GitBranch className="h-4 w-4 text-muted-foreground"
                                                                               aria-hidden="true"/>流程进度</h3>
      {detail && !error &&
        <StatusBadge tone={instanceTone(detail.status)}>{approvalStatus[detail.status] ?? detail.status}</StatusBadge>}
    </div>
    {error ? <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertCircle
        className="h-4 w-4 shrink-0"/>暂时无法读取流程</p>
      <p className="mt-1 break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{error}</p>
    </div> : !detail ?
      <div role="status" className="flex items-center gap-2 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true"/>正在读取审批…
      </div> : <>
        <div className="space-y-4 border-b pb-5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{(names[detail.initiator] ?? detail.initiator).trim().slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0">
              <p className="break-words text-sm font-medium [overflow-wrap:anywhere]"><span
                className="mr-2 text-xs font-normal text-muted-foreground">发起人</span>{names[detail.initiator] ?? detail.initiator}
              </p>
              {startedAt ? <time dateTime={detail.createdAt}
                                 className="mt-0.5 block text-xs leading-5 tabular-nums text-muted-foreground">{startedAt} 发起</time>
                : <p className="text-xs text-muted-foreground">发起时间未记录</p>}
            </div>
          </div>
          {current.length > 0 && <div className="rounded-lg bg-primary/5 px-3 py-2.5">
            <p className="text-xs font-medium text-primary">当前节点</p>
            <p
              className="mt-1 break-words text-sm font-medium leading-6 [overflow-wrap:anywhere]">{current.map(wait => wait.title).join('、')}</p>
            {pendingNames.length > 0 && <p
              className="mt-1 break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">等待 {pendingNames.slice(0, 2).join('、')}{pendingNames.length > 2 ? '等' + pendingNames.length + '人' : ''} 处理</p>}
          </div>}
        </div>
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-medium text-muted-foreground">审批记录</h4>
            <span
              className="text-xs text-muted-foreground">已通过 {detail.waits.filter(wait => wait.status === 'APPROVED').length} 个节点</span>
          </div>
          <ApprovalTimeline detail={detail} names={names} upcoming={detail.upcoming ?? []} ending={detail.ending}/>
        </div>
      </>}
  </section>
}

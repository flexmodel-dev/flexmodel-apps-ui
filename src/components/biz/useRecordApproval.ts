import * as React from 'react'
import {getAuthSession} from '@/services/auth'
import {
  FINISHED_STATUS,
  getApprovalDetail,
  recordApprovals,
  type ApprovalItem,
} from '@/services/approvals'
import {getApprovalFlows} from '@/services/workflows'
import type {ApprovalFlow} from '@/types/workflow'

/**
 * 记录审批状态 hook：轮询审批实例与启用流程，解析当前用户在流程中的待办任务。
 * locked 用于禁用编辑/删除/保存；progressInstanceId 用于右侧审批进度面板。
 * 传入 instanceId 时优先定位该审批实例（待办中心/消息中心入口），否则取进行中的实例。
 * 通过 cancelled 标志防止切换记录时旧请求的竞态更新。
 */
export function useRecordApproval({appId, formName, recordId, instanceId, enabled}: {
  appId: string
  formName: string
  recordId?: string | null
  instanceId?: string | null
  enabled: boolean
}) {
  const [flows, setFlows] = React.useState<ApprovalFlow[]>([])
  const [instances, setInstances] = React.useState<ApprovalItem[]>([])
  const [myTask, setMyTask] = React.useState<string | null>(null)
  const [progressInstanceId, setProgressInstanceId] = React.useState<string | null>(null)
  const [revision, refresh] = React.useReducer((value: number) => value + 1, 0)

  React.useEffect(() => {
    if (!enabled || !recordId) {
      setFlows([])
      setInstances([])
      setMyTask(null)
      setProgressInstanceId(null)
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const [definitions, runs] = await Promise.all([
          getApprovalFlows(appId),
          recordApprovals(appId, formName, recordId),
        ])
        if (cancelled) return
        setFlows(definitions.filter((flow) =>
          flow.status === 'enabled' && flow.form.kind === 'app' && flow.form.name === formName))
        setInstances(runs)
        const active = runs.find((item) => !FINISHED_STATUS.includes(item.status))
        const target = instanceId ?? active?.id
          ?? [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id
          ?? null
        setProgressInstanceId(target)
        const hinted = instanceId ? runs.find((item) => item.id === instanceId) : null
        const finishedTarget = !!instanceId && (!hinted || FINISHED_STATUS.includes(hinted.status))
        if (target && !finishedTarget) {
          try {
            const detail = await getApprovalDetail(appId, target)
            if (cancelled) return
            const actor = getAuthSession()?.user.id
            const task = detail.tasks.find((task) => task.userId === actor && task.status === 'PENDING')
            setMyTask(task?.id ?? null)
          } catch {
            if (!cancelled) setMyTask(null)
          }
        } else {
          setMyTask(null)
        }
      } catch {
        // 审批状态读取失败时保持现有状态，下轮轮询重试
      }
    }
    void run()
    const timer = window.setInterval(run, 3000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [appId, formName, recordId, instanceId, enabled, revision])

  const locked = instances.some((item) => !FINISHED_STATUS.includes(item.status))

  return {flows, instances, myTask, locked, progressInstanceId, refresh}
}

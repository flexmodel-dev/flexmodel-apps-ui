import * as React from 'react'
import {getAuthSession} from '@/services/auth'
import {
  getApprovalDetail,
  getApprovalFlows,
  recordApprovals,
  type ApprovalItem,
} from '@/services/approvals'
import type {ApprovalFlow} from '@/types/approval'

const FINISHED_STATUS = ['APPROVED', 'REJECTED', 'TERMINATED']

/**
 * 记录审批状态 hook：轮询审批实例与启用流程，解析当前用户在流程中的待办任务。
 * locked 用于禁用编辑/删除/保存；latestInstance 用于右侧审批进度面板（优先进行中的实例）。
 * 通过 cancelled 标志防止切换记录时旧请求的竞态更新。
 */
export function useRecordApproval({appId, formName, recordId, enabled}: {
  appId: string
  formName: string
  recordId?: string | null
  enabled: boolean
}) {
  const [flows, setFlows] = React.useState<ApprovalFlow[]>([])
  const [instances, setInstances] = React.useState<ApprovalItem[]>([])
  const [myTask, setMyTask] = React.useState<string | null>(null)
  const [revision, refresh] = React.useReducer((value: number) => value + 1, 0)

  React.useEffect(() => {
    if (!enabled || !recordId) {
      setFlows([])
      setInstances([])
      setMyTask(null)
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
        if (active) {
          try {
            const detail = await getApprovalDetail(appId, active.id)
            if (cancelled) return
            const actor = getAuthSession()?.user.id
            const task = detail.tasks.find((task) => task.user_id === actor && task.status === 'PENDING')
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
  }, [appId, formName, recordId, enabled, revision])

  const locked = instances.some((item) => !FINISHED_STATUS.includes(item.status))
  const activeInstance = instances.find((item) => !FINISHED_STATUS.includes(item.status))
  const latestInstance = activeInstance
    ?? [...instances].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    ?? null

  return {flows, instances, myTask, locked, latestInstance, refresh}
}

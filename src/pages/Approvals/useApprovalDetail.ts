import * as React from 'react'
import {getApprovalDetail, getApprovalMemberNames, type ApprovalDetail} from '@/services/approvals'
import {toErrorMessage} from '@/lib/utils'

/**
 * 轮询审批详情：InstanceDrawer 与 ApprovalProgressPanel 共用。
 * 同时提供审批成员的 id → 姓名映射（会话内缓存）。
 */
export function useApprovalDetail(appId: string, instanceId: string | undefined, intervalMs = 3000) {
  const [detail, setDetail] = React.useState<ApprovalDetail | null>(null)
  const [names, setNames] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState('')

  const load = React.useCallback(async () => {
    if (!instanceId) return
    try {
      const loaded = await getApprovalDetail(appId, instanceId)
      setDetail(loaded)
      setError('')
    } catch (cause: unknown) {
      setError(toErrorMessage(cause, '读取审批失败'))
    }
  }, [appId, instanceId])

  React.useEffect(() => {
    if (!instanceId) return
    let active = true
    setDetail(null)
    setError('')
    void load()
    getApprovalMemberNames(appId).then((value) => {
      if (active) setNames(value)
    }).catch(() => {
    })
    const timer = window.setInterval(() => void load(), intervalMs)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [appId, instanceId, intervalMs, load])

  return {detail, setDetail, names, error, load}
}

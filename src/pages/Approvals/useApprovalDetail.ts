import * as React from 'react'
import {getApprovalDetail, getApprovalMembers, type ApprovalDetail} from '@/services/approvals'
import type {ApprovalMember} from '@/types/approval'
import {toErrorMessage} from '@/lib/utils'

/**
 * 轮询审批详情：InstanceDrawer 与 ApprovalProgressPanel 共用。
 * 同时提供审批成员的 id → 姓名映射（会话内缓存）。
 */
export function useApprovalDetail(appId: string, instanceId: string | undefined, intervalMs = 3000) {
  const [detail, setDetail] = React.useState<ApprovalDetail | null>(null)
  const [members, setMembers] = React.useState<Record<string, ApprovalMember>>({})
  const names = React.useMemo(() => Object.fromEntries(Object.values(members).map(member => [member.id, member.name])), [members])
  const avatars = React.useMemo(() => Object.fromEntries(Object.values(members).map(member => [member.id, member.avatar])), [members])
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
    setMembers({})
    getApprovalMembers(appId).then((value) => {
      if (active) setMembers(value)
    }).catch(() => {
    })
    const timer = window.setInterval(() => void load(), intervalMs)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [appId, instanceId, intervalMs, load])

  return {detail, setDetail, names, avatars, error, load}
}

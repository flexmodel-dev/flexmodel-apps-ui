import * as React from 'react'
import {getAuthSession} from '@/services/auth'
import type {AppForm} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import type {ApprovalItem} from '@/services/approvals'
import {buildMockHistory} from '@/data/recordHistoryMock'

/** 记录变更历史暂时使用前端 mock，流程仍由真实审批实例驱动。 */
export function useRecordHistoryMock({enabled, form, record, approvals}: {
  enabled: boolean;
  form: AppForm | null;
  record: AppRecord | null;
  approvals: ApprovalItem[]
}) {
  const actorName = getAuthSession()?.user.name ?? '我'
  return React.useMemo(
    () => enabled ? buildMockHistory({form, record, approvals, actorName}) : [],
    [enabled, form, record, approvals, actorName],
  )
}

import {requestJson} from './http'

/** 记录历史单字段变化（服务端已按当前可见字段投影）。 */
export interface RecordHistoryChange {
  fieldName: string
  fieldLabel?: string | null
  fieldType?: string | null
  before?: unknown
  after?: unknown
  beforeDisplay?: string | null
  afterDisplay?: string | null
}

/** 记录历史列表项。 */
export interface RecordHistoryItem {
  id: string
  eventType: string
  source: string
  targetType: string
  targetFormName?: string | null
  actorType: string
  actorId?: string | null
  actorName: string
  /** 带 Z 的 UTC 时间字符串，按浏览器本地时区展示。 */
  occurredAt: string
  recordLabel?: string | null
  summary: string
  changeCount: number
  changesPreview: RecordHistoryChange[]
  hasMoreChanges: boolean
}

/** 记录历史事件详情。 */
export interface RecordHistoryDetail {
  id: string
  eventType: string
  source: string
  targetType: string
  targetFormName?: string | null
  actorType: string
  actorId?: string | null
  actorName: string
  occurredAt: string
  recordLabel?: string | null
  summary: string
  changes: RecordHistoryChange[]
  context?: Record<string, unknown>
}

/** 记录历史分页结果；supported=false 表示当前表单或数据源不支持历史。 */
export interface RecordHistoryPage {
  supported: boolean
  list: RecordHistoryItem[]
  nextCursor: string | null
  hasMore: boolean
}

const historyPath = (appId: string, formName: string, recordId: string) =>
  `/api/apps/${encodeURIComponent(appId)}/forms/${encodeURIComponent(formName)}/records/${encodeURIComponent(recordId)}/histories`

export function listRecordHistories(
  appId: string,
  formName: string,
  recordId: string,
  query?: { size?: number; cursor?: string | null },
) {
  const params = new URLSearchParams()
  if (query?.size) params.set('size', String(query.size))
  if (query?.cursor) params.set('cursor', query.cursor)
  const search = params.toString()
  return requestJson<RecordHistoryPage>(search ? `${historyPath(appId, formName, recordId)}?${search}` : historyPath(appId, formName, recordId))
}

export function getRecordHistory(appId: string, formName: string, recordId: string, eventId: string) {
  return requestJson<RecordHistoryDetail>(`${historyPath(appId, formName, recordId)}/${encodeURIComponent(eventId)}`)
}

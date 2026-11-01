import {requestJson} from '@/services/http'
import type {AppFormViewFilter, AppViewType} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'

export type AppViewQueryScope =
  | 'RECORDS'
  | 'GROUPS'
  | 'GROUP_RECORDS'
  | 'RANGE'
  | 'UNSCHEDULED'
  | 'TREE_ROOTS'
  | 'TREE_CHILDREN'

export type AppViewMoveMode = 'MOVE' | 'RESIZE_START' | 'RESIZE_END'

export interface AppViewQueryRequestInput {
  scope: AppViewQueryScope
  page?: number
  size?: number
  search?: string
  filter?: AppFormViewFilter | null
  sortField?: string
  sortOrder?: 'ASC' | 'DESC'
  groupValue?: unknown
  groupEmpty?: boolean
  rangeStart?: string
  rangeEnd?: string
  parentId?: string
}

export interface AppViewGroup {
  value: unknown
  label: string
  color: string | null
  total: number
  empty: boolean
}

export interface AppViewQueryResponse {
  viewId: string
  type: AppViewType
  list: AppRecord[]
  total: number
  groups: AppViewGroup[] | null
  childFlags: Record<string, boolean> | null
  hasMore: boolean
  movable: boolean
  disabledReason: string | null
}

export interface AppViewFieldChange {
  from: unknown
  to: unknown
}

export interface AppViewMoveInput {
  changes: Record<string, AppViewFieldChange>
  mode?: AppViewMoveMode
}

const API_BASE = '/api/apps'

function viewsPath(appId: string, formName: string, viewId: string) {
  return `${API_BASE}/${appId}/forms/${encodeURIComponent(formName)}/views/${encodeURIComponent(viewId)}`
}

export function queryAppView(
  appId: string,
  formName: string,
  viewId: string,
  request: AppViewQueryRequestInput,
): Promise<AppViewQueryResponse> {
  return requestJson<AppViewQueryResponse>(`${viewsPath(appId, formName, viewId)}/query`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function moveAppViewRecord(
  appId: string,
  formName: string,
  viewId: string,
  recordId: string,
  input: AppViewMoveInput,
): Promise<AppRecord> {
  return requestJson<AppRecord>(`${viewsPath(appId, formName, viewId)}/records/${encodeURIComponent(recordId)}/move`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

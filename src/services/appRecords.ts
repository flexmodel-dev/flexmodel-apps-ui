import {normalizePage, requestJson} from '@/services/http'

export type AppRecord = Record<string, unknown>

export interface AppRecordReferenceValue {
  id: string
  displayValue: string
  referenceForm?: string | null
}

export interface AppRecordPage {
  list: AppRecord[]
  total: number
}

export interface AppRecordQuery {
  page: number
  size: number
  search?: string
  sortField?: string
  sortOrder?: 'ASC' | 'DESC'
  viewTabId?: string
}

export interface AppRecordContext {
  mainFormName: string
  mainRecordId: string
  referenceField?: string
}

const API_BASE = '/api/apps'

function recordsPath(appId: string, formName: string) {
  return `${API_BASE}/${appId}/forms/${encodeURIComponent(formName)}/records`
}

function appendContext(params: URLSearchParams, context?: AppRecordContext) {
  if (!context) return
  params.set('mainFormName', context.mainFormName)
  params.set('mainRecordId', context.mainRecordId)
  if (context.referenceField) params.set('referenceField', context.referenceField)
}

function contextQuery(context?: AppRecordContext) {
  const params = new URLSearchParams()
  appendContext(params, context)
  return params.size ? `?${params}` : ''
}

export async function getAppRecords(
  appId: string,
  formName: string,
  query: AppRecordQuery,
  context?: AppRecordContext,
): Promise<AppRecordPage> {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  })
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.sortField) params.set('sortField', query.sortField)
  if (query.sortOrder) params.set('sortOrder', query.sortOrder)
  if (query.viewTabId?.trim()) params.set('viewTabId', query.viewTabId.trim())
  appendContext(params, context)
  return normalizePage(await requestJson<AppRecordPage>(`${recordsPath(appId, formName)}?${params}`))
}

export async function getAppRecord(
  appId: string,
  formName: string,
  recordId: string,
  context?: AppRecordContext,
): Promise<AppRecord> {
  return requestJson<AppRecord>(
    `${recordsPath(appId, formName)}/${encodeURIComponent(recordId)}${contextQuery(context)}`,
  )
}

export async function createAppRecord(
  appId: string,
  formName: string,
  values: AppRecord,
  context?: AppRecordContext,
): Promise<AppRecord> {
  return requestJson<AppRecord>(`${recordsPath(appId, formName)}${contextQuery(context)}`, {
    method: 'POST',
    body: JSON.stringify(values),
  })
}

export async function updateAppRecord(
  appId: string,
  formName: string,
  recordId: string,
  values: AppRecord,
  context?: AppRecordContext,
): Promise<AppRecord> {
  return requestJson<AppRecord>(
    `${recordsPath(appId, formName)}/${encodeURIComponent(recordId)}${contextQuery(context)}`,
    {
    method: 'PUT',
    body: JSON.stringify(values),
    },
  )
}

export async function deleteAppRecord(
  appId: string,
  formName: string,
  recordId: string,
  context?: AppRecordContext,
): Promise<void> {
  await requestJson<null>(
    `${recordsPath(appId, formName)}/${encodeURIComponent(recordId)}${contextQuery(context)}`,
    {
    method: 'DELETE',
    },
  )
}

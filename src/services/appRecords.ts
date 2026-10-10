import {requestJson} from '@/services/http'

export type AppRecord = Record<string, unknown>

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
}

const API_BASE = '/api/apps'

function recordsPath(appId: string, formName: string) {
  return `${API_BASE}/${appId}/forms/${encodeURIComponent(formName)}/records`
}

function normalizePage(page: AppRecordPage): AppRecordPage {
  return {
    list: Array.isArray(page.list) ? page.list : [],
    total: Number.isFinite(page.total) ? Number(page.total) : 0,
  }
}

export async function getAppRecords(
  appId: string,
  formName: string,
  query: AppRecordQuery,
): Promise<AppRecordPage> {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  })
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.sortField) params.set('sortField', query.sortField)
  if (query.sortOrder) params.set('sortOrder', query.sortOrder)
  return normalizePage(await requestJson<AppRecordPage>(`${recordsPath(appId, formName)}?${params}`))
}

export async function getAppRecord(
  appId: string,
  formName: string,
  recordId: string,
): Promise<AppRecord> {
  return requestJson<AppRecord>(`${recordsPath(appId, formName)}/${encodeURIComponent(recordId)}`)
}

export async function createAppRecord(
  appId: string,
  formName: string,
  values: AppRecord,
): Promise<AppRecord> {
  return requestJson<AppRecord>(recordsPath(appId, formName), {
    method: 'POST',
    body: JSON.stringify(values),
  })
}

export async function updateAppRecord(
  appId: string,
  formName: string,
  recordId: string,
  values: AppRecord,
): Promise<AppRecord> {
  return requestJson<AppRecord>(`${recordsPath(appId, formName)}/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    body: JSON.stringify(values),
  })
}

export async function deleteAppRecord(
  appId: string,
  formName: string,
  recordId: string,
): Promise<void> {
  await requestJson<null>(`${recordsPath(appId, formName)}/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
  })
}
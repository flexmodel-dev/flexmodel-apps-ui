import {requestJson, requestResponse} from '@/services/http'
import type {AppForm} from '@/services/appForms'

export interface TransferColumn { column: number; field: string; kind: 'VALUE' | 'KEY' | 'EXISTING'; targetSheet: string | null }
export interface TransferSheet { sheet: string; formName: string; headerRow: number; keyColumn: number | null; columns: TransferColumn[] }
export interface TransferCell { value: string; display: string; type: string }
export interface TransferUpload {
  uploadId: string; expiresAt: number; platform: boolean; suggestions: TransferSheet[]
  sheets: {name: string; rowCount: number; sample: TransferCell[][]}[]
}
export interface TransferSummary { sheet: string; formName: string; count: number }
export interface TransferPreview {
  importId: string; planHash: string; expiresAt: number; status: 'READY' | 'INVALID'
  forms: TransferSummary[]
  errors: {sheet: string; row: number; field: string; value: string; message: string}[]
  sample: {sheet: string; row: number; key: string; values: Record<string, unknown>}[]
}

export interface TransferResult {
  importId: string;
  status: 'COMMITTED';
  total: number;
  forms: TransferSummary[]
}

export interface TransferForm {
  formName: string; scope: 'ALL' | 'FILTERED' | 'IDS'; fields?: string[]; recordIds?: string[]
  search?: string; viewTabId?: string; sortField?: string; sortOrder?: 'ASC' | 'DESC'
}

export interface TransferExport {
  forms: TransferForm[];
  includeSubforms: boolean;
  includeReferences: boolean
}
const base = (appId: string) => `/api/apps/${encodeURIComponent(appId)}/transfers`

export function getTransferForms(appId: string): Promise<AppForm[]> {
  return requestJson(`${base(appId)}/forms`)
}

export async function uploadTransfer(appId: string, file: File): Promise<TransferUpload> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('请选择 .xlsx 文件')
  if (file.size > 10 * 1024 * 1024) throw new Error('文件不能超过 10 MB')
  const body = new FormData(); body.set('file', file)
  return requestJson(`${base(appId)}/imports`, {method: 'POST', body})
}
export function previewTransfer(appId: string, uploadId: string, sheets: TransferSheet[]): Promise<TransferPreview> {
  return requestJson(`${base(appId)}/imports/${uploadId}/preview`, {method: 'POST', body: JSON.stringify({sheets})})
}
export function commitTransfer(appId: string, preview: TransferPreview): Promise<TransferResult> {
  return requestJson(`${base(appId)}/imports/${preview.importId}/commit`, {method: 'POST', body: JSON.stringify({planHash: preview.planHash})})
}
export async function downloadTransfer(appId: string, request: TransferExport, template = false): Promise<void> {
  const response = await requestResponse(`${base(appId)}/${template ? 'templates' : 'exports'}`, {method: 'POST', body: JSON.stringify(request)})
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url;
  anchor.download = template ? '多表单导入模板.xlsx' : '多表单数据.xlsx'
  document.body.appendChild(anchor)
  try { anchor.click() } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
}

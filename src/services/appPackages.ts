import {requestJson, requestResponse} from '@/services/http'

export const MAX_PACKAGE_BYTES = 50 * 1024 * 1024
export const MAX_PACKAGE_RECORDS = 5000

export interface PackageFormSummary {
  name: string
  label: string
  fieldCount: number
  dataRows: number
  hiddenFieldCount: number
}

export interface PackageResourceSummary {
  key: 'app' | 'forms' | 'navigation' | 'workbenches' | 'approvals' | 'authorizations' | 'permissions' | 'records'
  label: string
  count: number
  detail: string
  included: boolean
}

export interface PackageValidationIssue {
  code: string
  path: string
  message: string
}

export interface AppPackagePreview {
  uploadId: string
  planHash: string
  expiresAt: number
  status: 'READY' | 'INVALID'
  source: {
    appId: string
    appName: string
    description: string
    exportedAt: string
    formatVersion: number
    flexmodelVersion: string
  }
  package: {
    fileName: string
    size: number
    hasData: boolean
    totalRecords: number
    totalFields: number
  }
  forms: PackageFormSummary[]
  resources: PackageResourceSummary[]
  warnings: string[]
  issues: PackageValidationIssue[]
  defaultAppName: string
  /** 非空表示该预览来自内置模板。 */
  templateId?: string | null
}

export type AppPackageImportStatus = 'COMMITTING' | 'COMPENSATING' | 'COMMITTED' | 'FAILED' | 'CLEANUP_REQUIRED'

export interface AppPackageImportResult {
  uploadId: string
  status: AppPackageImportStatus
  /** 执行阶段：provision/forms/references/layouts/navigation/workbenches/approvals/authorizations/records/activating/done */
  phase?: string | null
  appId: string | null
  appName: string | null
  importedAt: string
  totalRecords: number
  forms: { name: string; label: string; count: number }[]
  error: string | null
}

export interface PackageExportInput {
  appId: string
  appName: string
  includeData: boolean
}

export interface PackageExportResult {
  fileName: string
  size: number
  includeData: boolean
}

const importBase = '/api/app-packages/imports'

export async function uploadAppPackage(file: File): Promise<AppPackagePreview> {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    throw new Error('请选择 .flexmodel.zip 应用包')
  }
  if (file.size === 0) {
    throw new Error('应用包为空，请重新选择')
  }
  if (file.size > MAX_PACKAGE_BYTES) {
    throw new Error(`应用包不能超过 ${Math.floor(MAX_PACKAGE_BYTES / 1024 / 1024)} MiB`)
  }
  const body = new FormData()
  body.set('file', file)
  return requestJson(importBase, {method: 'POST', body})
}

/** 查询导入任务状态：提交请求丢失响应后通过该接口找回回执。 */
export function getAppPackageImport(uploadId: string): Promise<AppPackageImportResult | AppPackagePreview> {
  return requestJson(`${importBase}/${encodeURIComponent(uploadId)}`)
}

export function isAppPackageImportResult(value: unknown): value is AppPackageImportResult {
  const status = (value as { status?: unknown } | null)?.status
  return status === 'COMMITTED' || status === 'FAILED' || status === 'CLEANUP_REQUIRED'
    || status === 'COMMITTING' || status === 'COMPENSATING'
}

export function commitAppPackage(
  uploadId: string,
  input: { name: string; planHash: string },
): Promise<AppPackageImportResult> {
  const name = input.name.trim()
  if (!name) throw new Error('请输入新应用名称')
  if (name.length > 100) throw new Error('应用名称不能超过 100 个字符')
  return requestJson(`${importBase}/${encodeURIComponent(uploadId)}/commit`, {
    method: 'POST',
    body: JSON.stringify({name, planHash: input.planHash}),
  })
}

function fileNameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return fallback
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].replace(/"/g, ''))
    } catch {
      // fall through to ascii
    }
  }
  const ascii = /filename="([^"]+)"/i.exec(disposition)
  return ascii ? ascii[1] : fallback
}

export async function downloadAppPackage(input: PackageExportInput): Promise<PackageExportResult> {
  const response = await requestResponse(`/api/apps/${encodeURIComponent(input.appId)}/package-exports`, {
    method: 'POST',
    body: JSON.stringify({includeData: input.includeData}),
  })
  const fileName = fileNameFromDisposition(
    response.headers.get('Content-Disposition'),
    `${input.appName}.flexmodel.zip`,
  )
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return {fileName, size: blob.size, includeData: input.includeData}
}

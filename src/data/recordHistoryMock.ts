import type {RecordHistoryEntry} from '@/components/biz/RecordActivityAside'
import type {AppForm} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import type {ApprovalItem} from '@/services/approvals'
import {formatRecordValue} from '@/lib/recordValue'

const NUMERIC_TYPES = new Set(['NUMBER', 'DECIMAL'])
const DIFF_TYPES = new Set(['TEXT', 'NTEXT', 'NUMBER', 'DECIMAL'])
const SESSION_NOW = Date.now()

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 记录接口不返回系统时间时，用记录 ID 生成稳定的伪创建时间。 */
function seedTime(recordId: string) {
  let hash = 0
  for (let index = 0; index < recordId.length; index++) {
    hash = (hash * 31 + recordId.charCodeAt(index)) >>> 0
  }
  return new Date(SESSION_NOW - (2 + hash % 5) * 86400_000 - (hash % 12) * 3600_000)
}

function numericText(field: AppForm['fields'][number], value: number) {
  return `${field.config?.prefix ?? ''}${value.toLocaleString('zh-CN', {maximumFractionDigits: 2})}${field.config?.suffix ?? ''}`
}

function mockChanges(form: AppForm, record: AppRecord) {
  return form.fields
    .filter(field => !field.builtin && DIFF_TYPES.has(field.type))
    .filter(field => {
      const value = record[field.name]
      if (value === undefined || value === null || value === '') return false
      return NUMERIC_TYPES.has(field.type) || !field.required
    })
    .sort((left, right) => Number(NUMERIC_TYPES.has(right.type)) - Number(NUMERIC_TYPES.has(left.type)))
    .slice(0, 2)
    .map(field => {
      const value = record[field.name]
      const numeric = NUMERIC_TYPES.has(field.type) ? Number(value) : Number.NaN
      return {
        field: field.label,
        from: Number.isFinite(numeric) ? numericText(field, Math.round(numeric * 0.85)) : undefined,
        to: Number.isFinite(numeric) ? numericText(field, numeric) : formatRecordValue(value),
      }
    })
}

/** 历史暂时为前端 mock：创建/更新用稳定时间，审批节点取真实审批实例。 */
export function buildMockHistory({form, record, approvals, actorName}: {
  form: AppForm | null;
  record: AppRecord | null;
  approvals: ApprovalItem[];
  actorName: string
}): RecordHistoryEntry[] {
  if (!form || !record) return []
  const entries: RecordHistoryEntry[] = []
  const submittedTimes = approvals
    .map(item => parseDate(item.createdAt))
    .filter((date): date is Date => date !== null)
    .sort((left, right) => left.getTime() - right.getTime())
  const createdAt = parseDate(record.created_at)
    ?? (submittedTimes[0]
      ? new Date(submittedTimes[0].getTime() - 40 * 60_000)
      : seedTime(String(record.id ?? '')))
  const updatedAt = parseDate(record.updated_at) ?? new Date(createdAt.getTime() + 8 * 60_000)
  entries.push({
    id: 'mock-created',
    actorName,
    at: createdAt.toISOString(),
    kind: 'created',
    action: '创建了记录',
  })
  const changes = mockChanges(form, record)
  if (changes.length) {
    entries.push({
      id: 'mock-updated',
      actorName,
      at: updatedAt.toISOString(),
      kind: 'updated',
      action: `修改了 ${changes.length} 个字段`,
      changes,
    })
  }
  approvals.forEach((item, index) => {
    const submittedAt = parseDate(item.createdAt) ?? createdAt
    entries.push({
      id: `mock-submit-${item.id}`,
      actorName,
      at: submittedAt.toISOString(),
      kind: 'submitted',
      action: `提交了审批「${item.title}」`,
    })
    if (item.status === 'APPROVED' || item.status === 'REJECTED') {
      entries.push({
        id: `mock-result-${item.id}`,
        actorName: '李娜',
        at: new Date(submittedAt.getTime() + (index + 1) * 28 * 60_000).toISOString(),
        kind: item.status === 'APPROVED' ? 'approved' : 'rejected',
        action: item.status === 'APPROVED' ? `审批「${item.title}」已通过` : `审批「${item.title}」被拒绝`,
      })
    }
  })
  return entries.sort((left, right) => right.at.localeCompare(left.at))
}

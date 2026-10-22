export function formatRecordValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (Array.isArray(value)) {
    return value.map(formatRecordValue).filter(Boolean).join(', ')
  }
  if (typeof value === 'object') {
    const reference = value as { displayValue?: unknown; id?: unknown }
    return String(reference.displayValue ?? reference.id ?? '')
  }
  return String(value)
}

export function displayRecordText(value: unknown): string {
  return formatRecordValue(value) || '-'
}

/** 记录标题：引用取首个 displayValue，其余取原值，兜底记录 ID */
export function recordTitle(value: unknown, recordId: string): string {
  if (Array.isArray(value) && value.length > 0) {
    return recordTitle(value[0], recordId)
  }
  if (value && typeof value === 'object' && 'displayValue' in value) {
    const reference = value as { displayValue?: unknown }
    return String(reference.displayValue ?? recordId)
  }
  return String(value ?? recordId)
}

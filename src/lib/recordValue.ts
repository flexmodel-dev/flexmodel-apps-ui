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

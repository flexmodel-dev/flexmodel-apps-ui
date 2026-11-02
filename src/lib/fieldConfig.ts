import type {AppFormField} from '@/services/appForms'

export function isFieldWritable(field: AppFormField, creating: boolean) {
  return !field.builtin && (creating ? field.config?.creatable : field.config?.updatable) !== false
}

export function isEmptyFieldValue(value: unknown) {
  return value == null || typeof value === 'string' && value.trim() === '' || Array.isArray(value) && value.length === 0
}

export function fieldDefaultValue(field: AppFormField, now = new Date()): unknown {
  if (field.config?.defaultNow) {
    const pad = (value: number) => String(value).padStart(2, '0')
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    return field.type === 'DATE' ? date : field.type === 'TIME' ? time : `${date}T${time}`
  }
  if (field.config?.defaultValue != null) return field.config.defaultValue
  const defaults = field.options?.filter(option => option.defaultSelected).map(option => option.id ?? option.text ?? '') ?? []
  if (field.type === 'MULTISELECT' || field.type === 'MULTIREFERENCE') return defaults
  return defaults[0] ?? ''
}

export function fieldValueError(field: AppFormField, value: unknown, required = field.required): string | null {
  if (isEmptyFieldValue(value)) return required ? `${field.label}不能为空` : null
  const config = field.config
  if (config?.maxLength != null && String(value).length > config.maxLength) return `${field.label}不能超过${config.maxLength}个字符`
  if (field.type === 'NUMBER' || field.type === 'DECIMAL') {
    const number = Number(value)
    if (!Number.isFinite(number)) return `${field.label}必须是有效数字`
    if (field.type === 'NUMBER' && !Number.isInteger(number)) return `${field.label}必须是整数`
    if (config?.allowNegative === false && number < 0) return `${field.label}不允许负数`
    if (config?.decimalPlaces != null && number !== Number(number.toFixed(config.decimalPlaces))) {
      return `${field.label}最多允许${config.decimalPlaces}位小数`
    }
  }
  if (field.type === 'MULTISELECT' && !Array.isArray(value)) return `${field.label}必须是选项数组`
  // 格式正则由服务端按 Java 语义验证，避免 JS 与 Java 表达式语法差异。
  return null
}

function optionText(field: AppFormField, value: unknown) {
  return field.options?.find(option => option.id === String(value) || option.text === String(value))?.text ?? String(value)
}

export function formatFieldValue(field: AppFormField, value: unknown): string {
  if (isEmptyFieldValue(value)) return '-'
  if (field.type === 'BOOL') return value === true ? '是' : '否'
  if (['PICKLIST', 'SELECT', 'CLASSIFICATION'].includes(field.type)) return optionText(field, value)
  if (field.type === 'MULTISELECT' && Array.isArray(value)) return value.map(item => optionText(field, item)).join('、')
  if (field.type === 'NUMBER' || field.type === 'DECIMAL') {
    const places = field.config?.decimalPlaces
    const number = Number(value)
    if (!Number.isFinite(number)) return String(value)
    const formatted = number.toLocaleString('zh-CN', {
      useGrouping: field.config?.thousandsSeparator ?? true,
      minimumFractionDigits: places ?? 0,
      maximumFractionDigits: places ?? (field.type === 'NUMBER' ? 0 : 20),
    })
    return `${field.config?.prefix ?? ''}${formatted}${field.config?.suffix ?? ''}`
  }
  const format = field.config?.dateFormat
  if (format) {
    const parts = String(value).match(field.type === 'TIME'
      ? /^(\d{2}):(\d{2})(?::(\d{2}))?/
      : /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/)
    if (parts) {
      const tokens: Record<string, string> = field.type === 'TIME'
        ? {HH: parts[1], mm: parts[2], ss: parts[3] ?? '00'}
        : {yyyy: parts[1], MM: parts[2], dd: parts[3], HH: parts[4] ?? '00', mm: parts[5] ?? '00', ss: parts[6] ?? '00'}
      return format.replace(/yyyy|MM|dd|HH|mm|ss/g, token => tokens[token])
    }
  }
  return String(value)
}

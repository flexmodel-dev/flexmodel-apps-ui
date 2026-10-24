import type {AppForm} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import {toInputValue} from './FormFieldControl'
import {fieldDefaultValue, fieldValueError, isFieldWritable, isEmptyFieldValue} from '@/lib/fieldConfig'

/**
 * 构建提交载荷：仅包含布局中可见的业务字段，必填为空时通过 onInvalid 提示并返回 null。
 */
export function buildRecordPayload(
  form: AppForm,
  renderableFieldNames: Set<string>,
  values: AppRecord,
  onInvalid: (message: string) => void,
  creating = true,
): AppRecord | null {
  const payload: AppRecord = {}
  for (const field of form.fields.filter((item) =>
    renderableFieldNames.has(item.name)
    && isFieldWritable(item, creating)
  )) {
    const value = values[field.name]
    const error = fieldValueError(field, value)
    if (error) {
      onInvalid(error)
      return null
    }
    if (field.type === 'NUMBER' || field.type === 'DECIMAL') {
      payload[field.name] = isEmptyFieldValue(value) ? null : Number(value)
    } else if (field.type === 'BOOL') {
      payload[field.name] = value === '' || value == null ? null : value === true
    } else if (field.type === 'MULTIREFERENCE' || field.type === 'MULTISELECT') {
      payload[field.name] = Array.isArray(value) ? value : []
    } else {
      payload[field.name] = value === '' ? null : value
    }
  }
  return payload
}

/** 新建时应用类型默认值；布尔保留空值，多选保留全部默认选项。 */
export function initialCreateValues(form: AppForm, excludeField?: string): AppRecord {
  const initial: AppRecord = {}
  form.fields
    .filter((field) => field.name !== excludeField)
    .forEach((field) => {
      initial[field.name] = fieldDefaultValue(field)
    })
  return initial
}

/** 由记录构造编辑输入值（REFERENCE 对象转 id、MULTIREFERENCE 数组归一） */
export function toEditValues(form: AppForm, record: AppRecord, excludeField?: string): AppRecord {
  const initial: AppRecord = {}
  form.fields
    .filter((field) => field.name !== excludeField)
    .forEach((field) => {
      initial[field.name] = toInputValue(field, record[field.name])
    })
  return initial
}

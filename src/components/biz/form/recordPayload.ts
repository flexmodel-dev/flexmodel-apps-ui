import type {AppForm} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import {toInputValue} from './FormFieldControl'

/**
 * 构建提交载荷：仅包含布局中可见的业务字段，必填为空时通过 onInvalid 提示并返回 null。
 */
export function buildRecordPayload(
  form: AppForm,
  renderableFieldNames: Set<string>,
  values: AppRecord,
  onInvalid: (message: string) => void,
): AppRecord | null {
  const payload: AppRecord = {}
  for (const field of form.fields.filter((item) =>
    renderableFieldNames.has(item.name)
    && !item.builtin
  )) {
    const value = values[field.name]
    if (field.required && (value === undefined || value === null || value === '')) {
      onInvalid(`${field.label}不能为空`)
      return null
    }
    if (field.type === 'NUMBER' || field.type === 'DECIMAL') {
      payload[field.name] = value === '' ? null : Number(value)
    } else if (field.type === 'BOOL') {
      payload[field.name] = value === true
    } else if (field.type === 'MULTIREFERENCE') {
      payload[field.name] = Array.isArray(value) ? value : []
    } else {
      payload[field.name] = value === '' ? null : value
    }
  }
  return payload
}

/** 新建表单的默认输入值（选项默认值、BOOL false、MULTIREFERENCE 空数组） */
export function initialCreateValues(form: AppForm, excludeField?: string): AppRecord {
  const initial: AppRecord = {}
  form.fields
    .filter((field) => field.name !== excludeField)
    .forEach((field) => {
      const defaultOption = field.options?.find(option => option.defaultSelected)
      initial[field.name] = field.type === 'BOOL'
        ? false
        : field.type === 'MULTIREFERENCE'
          ? []
          : defaultOption?.id ?? defaultOption?.text ?? ''
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

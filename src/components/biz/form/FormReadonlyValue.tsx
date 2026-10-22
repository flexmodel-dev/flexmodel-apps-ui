import * as React from 'react'
import type {AppFormField} from '@/services/appForms'

/** 只读展示字段值，与详情页渲染口径保持一致 */
export function renderFormValue(field: AppFormField, value: unknown) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-muted-foreground">-</span>
  }
  if (field.type === 'BOOL') return value === true ? '是' : '否'
  if (field.type === 'NUMBER' || field.type === 'DECIMAL') {
    return Number(value).toLocaleString()
  }
  return String(value)
}

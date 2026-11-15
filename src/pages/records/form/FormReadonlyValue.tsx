import * as React from 'react'
import type {AppFormField} from '@/services/appForms'
import {formatFieldValue} from '@/lib/fieldConfig'
import {isAttachmentField} from '@/lib/attachments'
import {AttachmentList} from './AttachmentField'

/** 只读展示字段值，与详情页渲染口径保持一致 */
export function renderFormValue(field: AppFormField, value: unknown) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-muted-foreground">-</span>
  }
  if (isAttachmentField(field.type)) return <AttachmentList value={value}/>
  return formatFieldValue(field, value)
}

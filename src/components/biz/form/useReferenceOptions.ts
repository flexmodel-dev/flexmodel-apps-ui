import * as React from 'react'
import {getAppForm, type AppForm} from '@/services/appForms'
import {getAppRecords} from '@/services/appRecords'
import type {ReferenceOption} from './FormFieldControl'

/**
 * 加载 MULTIREFERENCE 候选；单选引用由 ReferenceField 按需搜索，overrides 跳过加载。
 */
export function useReferenceOptions({
                                      appId,
                                      form,
                                      open,
                                      excludeField,
                                      overrides,
                                    }: {
  appId: string
  form: AppForm | null
  open: boolean
  excludeField?: string
  overrides?: Record<string, ReferenceOption[]>
}): Record<string, ReferenceOption[]> {
  const [loaded, setLoaded] = React.useState<Record<string, ReferenceOption[]>>({})

  React.useEffect(() => {
    if (!open || !form) return
    let cancelled = false
    const referenceFields = form.fields.filter((field) =>
      field.type === 'MULTIREFERENCE'
      && field.referenceForm
      && !overrides?.[field.name]
      && field.name !== excludeField
    )
    Promise.all(referenceFields.map(async (field) => {
      const referenceForm = await getAppForm(appId, field.referenceForm!)
      const page = await getAppRecords(appId, field.referenceForm!, {page: 1, size: 100})
      return [field.name, page.list.map((record) => ({
        value: String(record.id ?? ''),
        label: String(record[referenceForm.displayField ?? 'id'] ?? record.id ?? ''),
      }))] as const
    }))
      .then((entries) => {
        if (!cancelled) setLoaded(Object.fromEntries(entries))
      })
      .catch(() => {
        if (!cancelled) setLoaded({})
      })
    return () => {
      cancelled = true
    }
  }, [appId, form, open, excludeField, overrides])

  return {...loaded, ...overrides}
}

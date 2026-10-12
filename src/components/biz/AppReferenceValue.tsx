import * as React from 'react'
import {getAppForm} from '@/services/appForms'
import {getAppRecord, type AppRecord} from '@/services/appRecords'
import type {AppFormField} from '@/services/appForms'

interface ReferenceRecordItem {
  id: string
  label: string
  expanded: boolean
}

function isRecordObject(value: unknown): value is AppRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toReferenceItems(value: unknown, displayField: string): ReferenceRecordItem[] {
  const values = Array.isArray(value) ? value : [value]
  return values.flatMap<ReferenceRecordItem>((item) => {
    if (item === undefined || item === null || item === '') return []
    if (isRecordObject(item)) {
      const id = String(item.id ?? '')
      if (!id) return []
      return [{
        id,
        label: String(item[displayField] ?? item.id ?? ''),
        expanded: true,
      }]
    }
    return [{id: String(item), label: String(item), expanded: false}]
  })
}

export function AppReferenceValue({
                                   appId,
                                   field,
                                   value,
                                   onOpenRecord,
                                 }: {
  appId: string
  field: AppFormField
  value: unknown
  onOpenRecord?: (formName: string, recordId: string) => void
}) {
  const [referenceForm, setReferenceForm] = React.useState<{ displayField?: string | null } | null>(null)
  const [labelsById, setLabelsById] = React.useState<Record<string, string>>({})
  const referenceFormName = field.referenceForm ?? ''
  const displayField = referenceForm?.displayField ?? 'id'
  const items = React.useMemo(
    () => toReferenceItems(value, displayField),
    [value, displayField],
  )
  const pendingRecordIds = React.useMemo(
    () => items.filter((item) => !item.expanded).map((item) => item.id),
    [items],
  )
  const pendingRecordIdsKey = pendingRecordIds.join(',')

  React.useEffect(() => {
    if (!appId || !referenceFormName) return
    let cancelled = false
    getAppForm(appId, referenceFormName)
      .then((form) => {
        if (!cancelled) setReferenceForm(form)
      })
      .catch(() => {
        if (!cancelled) setReferenceForm({displayField: 'id'})
      })
    return () => {
      cancelled = true
    }
  }, [appId, referenceFormName])

  React.useEffect(() => {
    if (!appId || !referenceFormName || !pendingRecordIdsKey) return
    const recordIds = pendingRecordIdsKey.split(',').filter(Boolean)
    let cancelled = false
    Promise.allSettled(recordIds.map(async (recordId) => {
      const record = await getAppRecord(appId, referenceFormName, recordId)
      return [recordId, String(record[displayField] ?? recordId)] as const
    })).then((results) => {
      if (cancelled) return
      const labels: Record<string, string> = {}
      results.forEach((result) => {
        if (result.status !== 'fulfilled') return
        const [recordId, label] = result.value
        labels[recordId] = label
      })
      setLabelsById((previous) => ({...previous, ...labels}))
    })
    return () => {
      cancelled = true
    }
  }, [appId, referenceFormName, displayField, pendingRecordIdsKey])

  if (!items.length) return <span className="text-muted-foreground">-</span>

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {items.map((item) => {
        const label = labelsById[item.id] || item.label || item.id
        if (!referenceFormName || !onOpenRecord) {
          return <span key={item.id} className="text-primary">{label}</span>
        }
        return (
          <button
            key={item.id}
            type="button"
            className="text-left text-primary hover:underline"
            onClick={(event) => {
              event.stopPropagation()
              onOpenRecord(referenceFormName, item.id)
            }}
          >
            {label}
          </button>
        )
      })}
    </span>
  )
}

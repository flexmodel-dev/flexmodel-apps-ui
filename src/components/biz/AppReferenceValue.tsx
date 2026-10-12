import * as React from 'react'
import {getAppForm, type AppForm} from '@/services/appForms'
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

function displayFieldCandidates(form: AppForm): string[] {
  const candidates = [
    form.displayField,
    form.searchField,
    ...form.fields
      .filter((field) => !field.builtin && field.name !== 'id')
      .map((field) => field.name),
    'name',
    'label',
    'title',
  ].filter((name): name is string => Boolean(name?.trim()))
  return Array.from(new Set(candidates))
}

function recordLabel(record: AppRecord, candidates: string[]): string {
  for (const fieldName of candidates) {
    const value = record[fieldName]
    if (value === undefined || value === null || value === '' || typeof value === 'object') continue
    const label = String(value).trim()
    if (label) return label
  }
  return String(record.id ?? '')
}

function toReferenceItems(value: unknown, candidates: string[]): ReferenceRecordItem[] {
  const values = Array.isArray(value) ? value : [value]
  return values.flatMap<ReferenceRecordItem>((item) => {
    if (item === undefined || item === null || item === '') return []
    if (isRecordObject(item)) {
      const id = String(item.id ?? '')
      if (!id) return []
      return [{
        id,
        label: recordLabel(item, candidates),
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
  const [referenceForm, setReferenceForm] = React.useState<AppForm | null>(null)
  const [labelsById, setLabelsById] = React.useState<Record<string, string>>({})
  const referenceFormName = field.referenceForm ?? ''
  const displayFields = React.useMemo(
    () => referenceForm ? displayFieldCandidates(referenceForm) : ['id'],
    [referenceForm],
  )
  const items = React.useMemo(
    () => referenceForm ? toReferenceItems(value, displayFields) : [],
    [referenceForm, value, displayFields],
  )
  const pendingRecordIds = React.useMemo(
    () => items.filter((item) => !item.expanded).map((item) => item.id),
    [items],
  )
  const pendingRecordIdsKey = pendingRecordIds.join(',')
  const hasReferenceValue = value !== undefined
    && value !== null
    && value !== ''
    && (!Array.isArray(value) || value.length > 0)

  React.useEffect(() => {
    if (!appId || !referenceFormName) return
    let cancelled = false
    getAppForm(appId, referenceFormName)
      .then((form) => {
        if (!cancelled) setReferenceForm(form)
      })
      .catch(() => {
        if (!cancelled) {
          setReferenceForm({
            name: referenceFormName,
            label: referenceFormName,
            description: '',
            displayField: 'id',
            searchField: 'id',
            managed: false,
            fields: [],
          })
        }
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
      return [recordId, recordLabel(record, displayFields)] as const
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
  }, [appId, referenceFormName, displayFields, pendingRecordIdsKey])

  if (!hasReferenceValue || (referenceForm && !items.length)) {
    return <span className="text-muted-foreground">-</span>
  }
  if (!referenceForm) return <span className="text-muted-foreground">…</span>

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {items.map((item) => {
        const label = item.expanded
          ? item.label
          : labelsById[item.id] || ''
        if (!label) return <span key={item.id} className="text-muted-foreground">…</span>
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

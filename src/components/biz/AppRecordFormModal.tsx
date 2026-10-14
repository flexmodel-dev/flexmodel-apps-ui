import * as React from 'react'
import {Info} from 'lucide-react'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Checkbox} from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {cn} from '@/lib/utils'
import {AppFormSectionTitle} from '@/components/biz/AppFormSectionTitle'
import {
  formItemWidthTypeClasses,
} from '@/lib/form-items'
import {
  getAppForm,
  type AppForm,
  type AppFormField,
  type AppFormItem,
} from '@/services/appForms'
import {
  createAppRecord,
  getAppRecords,
  getAppRecord,
  updateAppRecord,
  type AppRecord,
  type AppRecordContext,
} from '@/services/appRecords'

type ReferenceOption = { value: string; label: string }

function toInputValue(field: AppFormField, value: unknown) {
  if (field.type === 'BOOL') return value === true || value === 'true'
  if (field.type === 'REFERENCE' && value && typeof value === 'object' && 'id' in value) {
    return String((value as { id?: unknown }).id ?? '')
  }
  return value === undefined || value === null ? '' : String(value)
}

function FieldControl({
                        field,
                        value,
                        options,
                        referenceOptions,
                        disabled,
                        onChange,
                      }: {
  field: AppFormField
  value: unknown
  options: Array<{ id?: string; text?: string; color?: string }>
  referenceOptions: ReferenceOption[]
  disabled?: boolean
  onChange: (value: unknown) => void
}) {
  if (['PICKLIST', 'SELECT', 'CLASSIFICATION', 'MULTISELECT'].includes(field.type)) {
    return (
      <Select value={String(value)} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={`请选择${field.label}`}/>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id ?? option.text} value={option.text ?? ''}>
              {option.text ?? option.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === 'REFERENCE') {
    return (
      <Select value={String(value)} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={`请选择${field.label}`}/>
        </SelectTrigger>
        <SelectContent>
          {referenceOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === 'BOOL') {
    return (
      <label className="flex h-10 items-center gap-2 text-sm">
        <Checkbox
          checked={value === true}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        {value === true ? '是' : '否'}
      </label>
    )
  }

  const inputType = field.type === 'NUMBER' || field.type === 'DECIMAL'
    ? 'number'
    : field.type === 'DATE'
      ? 'date'
      : field.type === 'DATETIME'
        ? 'datetime-local'
        : field.type === 'TIME'
          ? 'time'
          : field.type === 'EMAIL'
            ? 'email'
            : field.type === 'PHONE'
              ? 'tel'
              : field.type === 'URL'
                ? 'url'
                : 'text'

  return (
    <Input
      type={inputType}
      value={String(value)}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder={`请输入${field.label}`}
    />
  )
}

export function AppRecordFormModal({
                                     open,
                                     onOpenChange,
                                     appId,
                                     form,
                                     recordId,
                                     recordContext,
                                     onSaved,
                                   }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appId: string
  form: AppForm
  recordId?: string | null
  recordContext?: AppRecordContext
  onSaved?: (id: string) => void
}) {
  const [values, setValues] = React.useState<AppRecord>({})
  const [error, setError] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [referenceOptions, setReferenceOptions] = React.useState<Record<string, ReferenceOption[]>>({})

  const layoutItems = form.layout.items.length
    ? form.layout.items
    : form.fields.filter((field) => !field.builtin).map((field) => ({type: 'FIELD' as const, name: field.name}))
  const fieldsByName = new Map(form.fields.map((field) => [field.name, field]))
  const renderItems = layoutItems.filter((item): item is AppFormItem =>
    item.type === 'SECTION'
    || (item.type === 'FIELD'
      && Boolean(item.name)
      && fieldsByName.has(item.name!)
      && !(recordContext && item.name === recordContext.referenceField)))

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setError('')
    if (!recordId) {
      const initial: AppRecord = {}
      form.fields.filter((field) => !field.builtin).forEach((field) => {
        initial[field.name] = field.type === 'BOOL' ? false : ''
      })
      if (!cancelled) setValues(initial)
      return () => {
        cancelled = true
      }
    }
    getAppRecord(appId, form.name, recordId, recordContext)
      .then((record) => {
        if (cancelled) return
        const initial: AppRecord = {}
        form.fields.filter((field) => !field.builtin && !(
          recordContext && field.name === recordContext.referenceField
        )).forEach((field) => {
          initial[field.name] = toInputValue(field, record[field.name])
        })
        setValues(initial)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : '加载记录失败')
      })
    return () => {
      cancelled = true
    }
  }, [appId, form, open, recordContext, recordId])

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    const referenceFields = form.fields.filter((field) =>
      field.type === 'REFERENCE'
      && field.referenceForm
      && !(recordContext && field.name === recordContext.referenceField)
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
        if (cancelled) return
        setReferenceOptions(Object.fromEntries(entries))
      })
      .catch(() => {
        if (!cancelled) setReferenceOptions({})
      })
    return () => {
      cancelled = true
    }
  }, [appId, form, open, recordContext])

  const submit = async () => {
    const payload: AppRecord = {}
    for (const field of form.fields.filter((item) =>
      !item.builtin && !(recordContext && item.name === recordContext.referenceField)
    )) {
      const value = values[field.name]
      if (field.required && (value === undefined || value === null || value === '')) {
        setError(`${field.label}不能为空`)
        return
      }
      if (field.type === 'NUMBER' || field.type === 'DECIMAL') {
        payload[field.name] = value === '' ? null : Number(value)
      } else if (field.type === 'BOOL') {
        payload[field.name] = value === true
      } else {
        payload[field.name] = value === '' ? null : value
      }
    }
    setIsSubmitting(true)
    setError('')
    try {
      const saved = recordId
        ? await updateAppRecord(appId, form.name, recordId, payload, recordContext)
        : await createAppRecord(appId, form.name, payload, recordContext)
      onOpenChange(false)
      onSaved?.(String(saved.id ?? ''))
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '保存记录失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <BizDialog
      open={open}
      onOpenChange={onOpenChange}
      width={960}
      title={recordId ? `编辑${form.label}` : `新建${form.label}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            取消
          </Button>
          <Button onClick={submit} disabled={isSubmitting}>保存</Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-12">
          {renderItems.map((item) => {
            if (item.type === 'SECTION') {
              return (
                <div key={`${item.type}-${item.label}`} className="md:col-span-12">
                  <AppFormSectionTitle label={item.label?.trim() || '分栏'}/>
                </div>
              )
            }
            const field = fieldsByName.get(item.name!)!
            if (item.hidden) return null
            return (
              <div
                key={field.name}
                className={cn('space-y-1.5', formItemWidthTypeClasses[item.width ?? 'HALF'])}
              >
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  {item.label?.trim() || field.label}
                  {field.required && <span className="text-destructive">*</span>}
                  {item.tip && <Info className="h-3.5 w-3.5 text-muted-foreground"/>}
                </label>
                <FieldControl
                  field={field}
                  value={values[field.name]}
                  options={field.options ?? []}
                  referenceOptions={referenceOptions[field.name] ?? []}
                  disabled={item.readonly}
                  onChange={(value) => setValues((previous) => ({...previous, [field.name]: value}))}
                />
              </div>
            )
          })}
        </div>
      </div>
    </BizDialog>
  )
}

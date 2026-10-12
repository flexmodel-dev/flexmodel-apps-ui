import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {Settings} from 'lucide-react'
import {BizDialog} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {createRecord, getBusinessObject, getRecords, updateRecord, users, type BusinessObjectField} from '@/data/mock'
import {formItemWidthTypeClasses} from '@/lib/form-items'

type FormValues = Record<string, string | boolean>

function toInputValue(field: BusinessObjectField, value: unknown) {
  if (field.type === 'BOOL') return value === true || value === 'true'
  if (field.type === 'DATETIME') return String(value ?? '').slice(0, 16)
  return value === undefined || value === null ? '' : String(value)
}

function getReferenceOptions(field: BusinessObjectField) {
  if (field.refBusinessObject === 'User') {
    return users.map((user) => ({ value: user.fullName, label: user.fullName }))
  }
  if (field.refBusinessObject === 'Customer') {
    return getRecords('Customer').map((record) => ({
      value: String(record.customerName),
      label: String(record.customerName),
    }))
  }
  return []
}

function FieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: BusinessObjectField
  value: string | boolean
  onChange: (value: string | boolean) => void
  disabled?: boolean
}) {
  if (field.type === 'SELECT') {
    return (
      <Select value={String(value)} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={`请选择${field.label}`} />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((option) => (
            <SelectItem key={option.id} value={option.text}>
              {option.text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === 'REFERENCE') {
    const options = getReferenceOptions(field)
    return (
      <Select value={String(value)} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={`请选择${field.label}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
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

export function RecordFormModal({
  open,
  onOpenChange,
                                  businessObject,
  recordId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessObject: string
  recordId?: string | null
  onSaved?: (id: string) => void
}) {
  const navigate = useNavigate()
  const meta = getBusinessObject(businessObject)
  const editing = React.useMemo(
    () => meta && recordId ? getRecords(meta.name).find((record) => record.id === recordId) : undefined,
    [meta, recordId],
  )
  const [values, setValues] = React.useState<FormValues>({})
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!meta || !open) return
    const next: FormValues = {}
    meta.fields
      .filter((field) => !['createdOn', 'modifiedOn'].includes(field.name))
      .forEach((field) => {
        next[field.name] = toInputValue(field, editing?.[field.name])
      })
    setValues(next)
    setError('')
  }, [editing, meta, open])

  if (!meta) return null

  const fields = meta.fields.filter((field) => !['createdOn', 'modifiedOn'].includes(field.name))
  const handleSubmit = () => {
    const nameValue = String(values[meta.displayField] ?? '').trim()
    if (!nameValue) {
      setError(`${meta.fields.find((field) => field.name === meta.displayField)?.label}不能为空`)
      return
    }

    const record = editing
      ? updateRecord(meta.name, editing.id, values)
      : createRecord(meta.name, values)
    if (record) {
      onOpenChange(false)
      onSaved?.(record.id)
    }
  }

  return (
    <BizDialog
      open={open}
      onOpenChange={onOpenChange}
      width={760}
      title={editing ? `编辑${meta.label}` : `新建${meta.label}`}
      headerExtra={
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary"
          title="表单设计"
          onClick={() => {
            onOpenChange(false)
            navigate(`/admin/business-object/${meta.name}/form-design`)
          }}
        >
          <Settings className="h-4 w-4" />
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit}>{editing ? '保存' : '创建'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {fields.map((field) => (
          <div key={field.name} className={cn('space-y-1.5', formItemWidthTypeClasses.HALF)}>
            <label className="block text-sm font-medium text-foreground">
              {field.label}
              {field.name === meta.displayField && <span className="ml-1 text-destructive">*</span>}
            </label>
            <FieldControl
              field={field}
              value={values[field.name] ?? ''}
              onChange={(value) => setValues((prev) => ({...prev, [field.name]: value}))}
            />
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </BizDialog>
  )
}

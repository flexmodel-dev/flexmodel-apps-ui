import * as React from 'react'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Checkbox} from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {AppFormField} from '@/services/appForms'

export type ReferenceOption = { value: string; label: string }

export function toInputValue(field: AppFormField, value: unknown) {
  if (field.type === 'BOOL') return value === true || value === 'true'
  if (field.type === 'MULTIREFERENCE') {
    return Array.isArray(value) ? value.map(item => String(item)) : []
  }
  if (field.type === 'REFERENCE' && value && typeof value === 'object' && 'id' in value) {
    return String((value as { id?: unknown }).id ?? '')
  }
  return value === undefined || value === null ? '' : String(value)
}

export function FieldControl({
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
            <SelectItem key={option.id ?? option.text} value={option.id ?? option.text ?? ''}>
              {option.text ?? option.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === 'MULTIREFERENCE') {
    return (
      <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
        {referenceOptions.map((option) => {
          const selected = Array.isArray(value) && value.map(String).includes(option.value)
          return (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  const current = Array.isArray(value) ? value.map(String) : []
                  onChange(checked === true
                    ? Array.from(new Set([...current, option.value]))
                    : current.filter((item) => item !== option.value))
                }}
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
            </label>
          )
        })}
      </div>
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

  if (field.type === 'NTEXT') {
    return (
      <Textarea
        value={String(value)}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
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

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
import {Button} from '@/components/ui/button'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'

export type ReferenceOption = { value: string; label: string }

export function toInputValue(field: AppFormField, value: unknown) {
  if (field.type === 'BOOL') return value == null || value === '' ? '' : value === true || value === 'true'
  if (field.type === 'MULTIREFERENCE' || field.type === 'MULTISELECT') {
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
  const inputId = React.useId()
  const emptyOption = `__empty_${inputId}`
  if (field.type === 'MULTISELECT') {
    const selected = Array.isArray(value) ? value.map(String) : []
    const choices = <div className="grid gap-2">
      {options.map(option => {
        const id = option.id ?? option.text ?? ''
        return <label key={id} className="flex items-center gap-2 text-sm">
          <Checkbox checked={selected.includes(id)} disabled={disabled}
                    onCheckedChange={checked => onChange(checked === true
                      ? Array.from(new Set([...selected, id])) : selected.filter(item => item !== id))}/>
          {option.text ?? id}
        </label>
      })}
    </div>
    if (field.config?.displayStyle === 'DROPDOWN') return <Popover>
      <PopoverTrigger asChild><Button type="button" variant="secondary" disabled={disabled} className="w-full justify-start truncate">
        {selected.length ? options.filter(option => selected.includes(option.id ?? option.text ?? '')).map(option => option.text ?? option.id).join('、') : `请选择${field.label}`}
      </Button></PopoverTrigger>
      <PopoverContent className="z-[1100] max-h-64 overflow-y-auto">{choices}</PopoverContent>
    </Popover>
    return <div className="rounded-md border p-3">{choices}</div>
  }

  if (['PICKLIST', 'SELECT', 'CLASSIFICATION'].includes(field.type)) {
    if (field.config?.displayStyle === 'RADIO') return <div className="flex flex-wrap gap-3">
      {options.map(option => {
        const id = option.id ?? option.text ?? ''
        return <label key={id} className="flex items-center gap-2 text-sm">
          <input type="radio" name={inputId} checked={String(value ?? '') === id} disabled={disabled} onChange={() => onChange(id)}/>
          {option.text ?? id}
        </label>
      })}
      {!field.required && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange('')}>清空</Button>}
    </div>
    return (
      <Select value={String(value || emptyOption)} onValueChange={value => onChange(value === emptyOption ? '' : value)} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={`请选择${field.label}`}/>
        </SelectTrigger>
        <SelectContent>
          {!field.required && <SelectItem value={emptyOption}>无</SelectItem>}
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
      <Select value={String(value ?? '')} onValueChange={onChange} disabled={disabled}>
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
      <div className="flex h-10 items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={value === '' || value == null ? 'indeterminate' : value === true}
                    disabled={disabled} onCheckedChange={checked => onChange(checked === true)}/>
          {value === '' || value == null ? '无' : value === true ? '是' : '否'}
        </label>
        {!field.required && value !== '' && value != null && <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange('')}>清空</Button>}
      </div>
    )
  }

  if (field.type === 'NTEXT') {
    return (
      <div className="space-y-2"><Textarea
        value={String(value ?? '')}
        disabled={disabled}
        maxLength={field.config?.maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
        {Boolean(field.config?.commonValues?.length) && <Select onValueChange={onChange} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="选择常用值"/></SelectTrigger>
          <SelectContent>{field.config?.commonValues?.filter(Boolean).map((text, index) => <SelectItem key={index} value={text}>{text}</SelectItem>)}</SelectContent>
        </Select>}
      </div>
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
    <><Input
      type={inputType}
      value={String(value ?? '')}
      disabled={disabled}
      min={field.config?.allowNegative === false && inputType === 'number' ? 0 : undefined}
      step={field.type === 'NUMBER' ? 1 : field.type === 'DECIMAL' ? field.config?.decimalPlaces == null ? 'any' : 10 ** -field.config.decimalPlaces : ['TIME', 'DATETIME'].includes(field.type) ? 1 : undefined}
      maxLength={field.config?.maxLength}
      list={field.config?.commonValues?.length ? inputId : undefined}
      onChange={(event) => onChange(event.target.value)}
      placeholder={`请输入${field.label}`}
    />
      {Boolean(field.config?.commonValues?.length) && <datalist id={inputId}>
        {field.config?.commonValues?.map((text, index) => <option key={index} value={text}/>)}
      </datalist>}
    </>
  )
}

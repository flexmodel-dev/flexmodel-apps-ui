import * as React from 'react'
import {Check, ChevronsUpDown} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import type {AppFormField} from '@/services/appForms'
import {FIELD_TYPE_LABELS} from '@/components/biz/views/viewUtils'
import {cn} from '@/lib/utils'

/** 可搜索的字段选择器：字段多时比原生下拉更容易定位。 */
export function FieldPicker({
                              fields,
                              value,
                              onChange,
                              placeholder = '请选择字段',
                              allowEmpty,
                              emptyLabel = '不设置',
                              disabled,
                              className,
                            }: {
  fields: AppFormField[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  allowEmpty?: boolean
  emptyLabel?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const selected = fields.find((field) => field.name === value)
  const filtered = React.useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return fields
    return fields.filter((field) => `${field.label} ${field.name} ${FIELD_TYPE_LABELS[field.type] ?? field.type}`
      .toLowerCase()
      .includes(keyword))
  }, [fields, search])

  React.useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn('h-9 w-full min-w-0 justify-between gap-2 px-3 text-sm font-normal', className)}
        >
          <span className={cn('min-w-0 flex-1 truncate text-left', !selected && 'text-muted-foreground')}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground"/>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(360px,calc(100vw-32px))] p-0">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索字段"
            className="h-8"
            aria-label="搜索字段"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1" role="listbox">
          {allowEmpty && (
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              <Check className={cn('h-4 w-4 shrink-0', !value ? 'opacity-100' : 'opacity-0')}/>
              <span className="text-muted-foreground">{emptyLabel}</span>
            </button>
          )}
          {filtered.map((field) => (
            <button
              key={field.name}
              type="button"
              role="option"
              aria-selected={value === field.name}
              className={cn(
                'flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                value === field.name && 'bg-primary/5',
              )}
              onClick={() => {
                onChange(field.name)
                setOpen(false)
              }}
            >
              <Check className={cn('mt-0.5 h-4 w-4 shrink-0', value === field.name ? 'opacity-100' : 'opacity-0')}/>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{field.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {field.name} · {FIELD_TYPE_LABELS[field.type] ?? field.type}
                </span>
              </span>
            </button>
          ))}
          {!filtered.length && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {fields.length ? '没有匹配的字段' : '当前表单没有可用字段'}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

import * as React from 'react'
import {Search, SquareArrowOutUpRight, X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {BizDialog} from '@/components/ui/dialog'
import {Popover, PopoverAnchor, PopoverContent} from '@/components/ui/popover'
import {Pagination} from '@/components/biz/Pagination'
import {AppLoading} from '@/components/biz/AppLoading'
import {type AppForm, type AppFormField, getAppForm} from '@/services/appForms'
import {type AppRecord, type AppRecordPage, getAppRecord, getAppRecords} from '@/services/appRecords'
import {formatFieldValue} from '@/lib/fieldConfig'
import {formatRecordValue} from '@/lib/recordValue'
import {cn, toErrorMessage} from '@/lib/utils'
import type {ReferenceOption} from './FormFieldControl'

const labelField: AppFormField = {name: 'label', label: '名称', type: 'TEXT', required: false, builtin: false}

function recordLabel(record: AppRecord, displayField = 'label') {
  return formatRecordValue(record[displayField]) || String(record.id ?? '')
}

function referenceColumns(form: AppForm | null): AppFormField[] {
  if (!form) return [{...labelField, name: 'id', label: '记录 ID'}]
  const display = form.fields.find(field => field.name === form.displayField)
  const visible = form.layout.items.length
    ? form.layout.items.filter(item => item.type === 'FIELD' && !item.hidden).map(item => form.fields.find(field => field.name === item.name))
    : form.fields.filter(field => !field.builtin)
  return Array.from(new Map([display, ...visible].filter((field): field is AppFormField =>
    Boolean(field && !['FILE', 'IMAGE', 'AVATAR', 'SIGN'].includes(field.type)),
  ).map(field => [field.name, field])).values())
}

/** 搜索词和分页变化立即隔离旧结果，防抖请求的迟到响应不能覆盖当前列表。 */
function useReferenceRecords(appId: string, formName: string, options: ReferenceOption[] | undefined,
                             enabled: boolean, search: string, page: number, size: number, retry: number) {
  const key = JSON.stringify([appId, formName, search, page, size, retry])
  const [result, setResult] = React.useState<{key: string; form: AppForm | null; data: AppRecordPage; error: string} | null>(null)
  React.useEffect(() => {
    if (!enabled || options !== undefined) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (!formName) {
        setResult({key, form: null, data: {list: [], total: 0}, error: '请先配置引用表单'})
        return
      }
      Promise.all([getAppForm(appId, formName), getAppRecords(appId, formName, {search, page, size})])
        .then(([form, data]) => { if (!cancelled) setResult({key, form, data, error: ''}) })
        .catch(error => {
          if (!cancelled) setResult({key, form: null, data: {list: [], total: 0}, error: toErrorMessage(error, '加载引用记录失败')})
        })
    }, search ? 250 : 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [appId, formName, options, enabled, search, page, size, retry, key])

  if (options !== undefined) {
    const filtered = options.filter(option => `${option.label} ${option.value}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    return {form: null, data: {list: filtered.slice((page - 1) * size, page * size).map(option => ({id: option.value, label: option.label})), total: filtered.length}, error: '', loading: false}
  }
  return {form: result?.form ?? null, data: result?.key === key ? result.data : {list: [], total: 0},
    error: result?.key === key ? result.error : '', loading: enabled && result?.key !== key}
}

function ReferenceTable({id, records, columns, selectedId, activeIndex, onSelect, loading, error, onRetry}: {
  id?: string
  records: AppRecord[]
  columns: AppFormField[]
  selectedId: string
  activeIndex?: number
  onSelect: (record: AppRecord) => void
  loading: boolean
  error: string
  onRetry: () => void
}) {
  return <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
    <table id={id} role="grid" aria-label="引用记录" aria-busy={loading} className="w-full border-collapse text-sm text-foreground">
      <thead className="sticky top-0 z-10 bg-muted">
        <tr><th className="w-12 border-b border-r px-3 py-3"><span className="sr-only">选择</span></th>
          {columns.map(field => <th key={field.name} className="min-w-40 border-b border-r px-3 py-3 text-left font-medium last:border-r-0">{field.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {!loading && !error && records.map((record, index) => {
          const recordId = String(record.id)
          return <tr key={recordId} id={id ? `${id}-${index}` : undefined} aria-selected={selectedId === recordId}
                     className={cn('cursor-pointer', (selectedId === recordId || activeIndex === index) && 'bg-primary/10')}
                     onClick={() => onSelect(record)}>
            <td className="border-b border-r px-3 py-3 text-center">
              <input type="radio" aria-label={`选择${recordLabel(record, columns[0]?.name)}`}
                     checked={selectedId === recordId} tabIndex={id ? -1 : 0} className="h-4 w-4 accent-primary"
                     onClick={event => event.stopPropagation()} onChange={() => onSelect(record)}/>
            </td>
            {columns.map(field => <td key={field.name} className="max-w-64 border-b border-r px-3 py-3 last:border-r-0">
              <div className="truncate" title={formatRecordValue(record[field.name])}>
                {['REFERENCE', 'MULTIREFERENCE'].includes(field.type) ? formatRecordValue(record[field.name]) || '-' : formatFieldValue(field, record[field.name])}
              </div>
            </td>)}
          </tr>
        })}
      </tbody>
    </table>
    {loading && <AppLoading className="p-8" label="正在加载引用数据"/>}
    {error && <div role="alert" className="space-y-2 p-6 text-center text-destructive">{error}<div><Button type="button" variant="secondary" size="sm" onClick={onRetry}>重试</Button></div></div>}
    {!loading && !error && !records.length && <div className="p-8 text-center text-muted-foreground">暂无匹配记录</div>}
  </div>
}

export function ReferenceField({appId, field, value, options, disabled, onChange}: {
  appId: string
  field: AppFormField
  value: unknown
  options?: ReferenceOption[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const valueId = String(value ?? '')
  const formName = field.referenceForm ?? ''
  const input = React.useRef<HTMLInputElement>(null)
  const dialogInput = React.useRef<HTMLInputElement>(null)
  const anchor = React.useRef<HTMLDivElement>(null)
  const gridId = React.useId()
  const [resolved, setResolved] = React.useState({id: '', label: ''})
  const [search, setSearch] = React.useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<ReferenceOption | null>(null)
  const [keyword, setKeyword] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [size, setSize] = React.useState(20)
  const [retry, setRetry] = React.useState(0)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const selectedLabel = options?.find(option => option.value === valueId)?.label
    ?? (resolved.id === valueId ? resolved.label : valueId)
  const results = useReferenceRecords(appId, formName, options, dropdownOpen || dialogOpen,
    dialogOpen ? keyword.trim() : search?.trim() ?? '', dialogOpen ? page : 1, dialogOpen ? size : 10, retry)
  const columns = React.useMemo(() => {
    const fields = options !== undefined ? [labelField] : referenceColumns(results.form)
    return fields.length ? fields : [{...labelField, name: 'id', label: '记录 ID'}]
  }, [results.form, options])

  React.useEffect(() => {
    if (!valueId || options !== undefined || !formName || resolved.id === valueId) return
    let cancelled = false
    Promise.all([getAppForm(appId, formName), getAppRecord(appId, formName, valueId)])
      .then(([loadedForm, record]) => { if (!cancelled) setResolved({id: valueId, label: recordLabel(record, loadedForm.displayField ?? 'id')}) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [appId, formName, valueId, options, resolved.id])

  React.useEffect(() => {
    if (disabled) { setDropdownOpen(false); setDialogOpen(false); setSearch(null); setActiveIndex(-1) }
  }, [disabled])

  React.useEffect(() => {
    if (dropdownOpen && activeIndex >= 0 && !results.loading) {
      document.getElementById(`${gridId}-${activeIndex}`)?.scrollIntoView({block: 'nearest'})
    }
  }, [dropdownOpen, activeIndex, results.loading, gridId])

  const closeDropdown = () => { setDropdownOpen(false); setSearch(null); setActiveIndex(-1) }
  const toOption = (record: AppRecord): ReferenceOption => ({
    value: String(record.id),
    label: recordLabel(record, options !== undefined ? 'label' : results.form?.displayField ?? 'id'),
  })
  const choose = (option: ReferenceOption) => {
    setResolved({id: option.value, label: option.label})
    onChange(option.value)
    closeDropdown()
  }
  const closeDialog = () => {
    setDialogOpen(false)
    requestAnimationFrame(() => input.current?.focus())
  }
  const openDialog = () => {
    setKeyword(search?.trim() ?? '')
    setPage(1)
    setDraft(valueId ? {value: valueId, label: selectedLabel} : null)
    closeDropdown()
    setDialogOpen(true)
    setRetry(current => current + 1)
  }

  return <>
    <Popover open={dropdownOpen && !disabled} onOpenChange={open => { if (!open) closeDropdown() }}>
      <PopoverAnchor asChild>
        <div ref={anchor} className="relative">
          <Input ref={input} role="combobox" aria-label={field.label} aria-haspopup="grid" aria-expanded={dropdownOpen}
                 aria-controls={dropdownOpen ? gridId : undefined}
                 aria-activedescendant={dropdownOpen && activeIndex >= 0 && !results.loading ? `${gridId}-${activeIndex}` : undefined}
                 autoComplete="off" maxLength={100} placeholder={`请选择${field.label}`} disabled={disabled} className="pr-20"
                 value={search ?? selectedLabel}
                 onBlur={() => { if (!dropdownOpen) setSearch(null) }}
                 onChange={event => {
                   const text = event.target.value
                   setSearch(text); setActiveIndex(-1); setDropdownOpen(Boolean(text.trim()))
                   if (!text) onChange('')
                 }}
                 onKeyDown={event => {
                   if (event.nativeEvent.isComposing) return
                   if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                     event.preventDefault()
                     setDropdownOpen(true)
                     setActiveIndex(index => Math.max(0, Math.min(results.data.list.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
                   } else if (event.key === 'Enter' && dropdownOpen) {
                     event.preventDefault()
                     const record = !results.loading && results.data.list[activeIndex]
                     if (record) choose(toOption(record))
                   } else if (event.key === 'Escape' && dropdownOpen) {
                     event.preventDefault(); event.stopPropagation(); closeDropdown()
                   }
                 }}/>
          <div className="absolute inset-y-0 right-1 flex items-center gap-1">
            {(valueId || search) && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`清空${field.label}`} disabled={disabled}
              onClick={() => { onChange(''); setResolved({id: '', label: ''}); closeDropdown(); input.current?.focus() }}><X className="h-4 w-4"/></Button>}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`选择${field.label}`} title={`选择${field.label}`} disabled={disabled}
                    onClick={openDialog}>{search ? <Search className="h-4 w-4"/> : <SquareArrowOutUpRight className="h-4 w-4"/>}</Button>
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" side="bottom" className="z-[1100] flex max-h-80 w-[max(var(--radix-popover-trigger-width),40rem)] max-w-[calc(100vw-2rem)] flex-col gap-2 p-2"
                      onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}
                      onInteractOutside={event => { if (event.target instanceof Node && anchor.current?.contains(event.target)) event.preventDefault() }}>
        <ReferenceTable id={gridId} records={results.data.list} columns={columns} selectedId={valueId} activeIndex={activeIndex}
                        loading={results.loading} error={results.error} onRetry={() => setRetry(current => current + 1)}
                        onSelect={record => { choose(toOption(record)); input.current?.focus() }}/>
        {results.data.total > 10 && <Button type="button" variant="ghost" size="sm" onClick={openDialog}>共 {results.data.total} 条，打开选择弹窗查看更多</Button>}
      </PopoverContent>
    </Popover>
    <BizDialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog() }} title={`请选择${field.label}`} width={1100} height="min(80vh, 760px)"
               footer={<><Button type="button" variant="secondary" onClick={closeDialog}>取消</Button>
                 <Button type="button" disabled={!draft || disabled} onClick={() => {
                   if (draft) choose(draft)
                   closeDialog()
                 }}>确定</Button></>}>
      <div className="flex h-full min-h-0 flex-col gap-4 text-foreground">
        <div className="relative">
          <Input ref={dialogInput} aria-label="搜索引用记录" placeholder="搜索关键字" maxLength={100} className="pr-10"
                 value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1) }}/>
          {keyword && <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-8 w-8" aria-label="清空搜索" title="清空搜索"
            onClick={() => { setKeyword(''); setPage(1); dialogInput.current?.focus() }}><X className="h-4 w-4"/></Button>}
        </div>
        <ReferenceTable records={results.data.list} columns={columns} selectedId={draft?.value ?? ''}
                        loading={results.loading} error={results.error} onRetry={() => setRetry(current => current + 1)} onSelect={record => setDraft(toOption(record))}/>
        <Pagination page={page} pages={Math.max(1, Math.ceil(results.data.total / size))} total={results.data.total} size={size}
                    className="[&>div]:min-w-0 [&>div]:flex-wrap [&>div]:justify-end"
                    onChange={setPage} onSizeChange={size => { setSize(size); setPage(1) }}/>
      </div>
    </BizDialog>
  </>
}

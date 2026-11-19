import * as React from 'react'
import {flushSync} from 'react-dom'
import {ArrowDown, ArrowUp, CalendarDays, ChevronDown, Pencil, SquareArrowOutUpRight} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {Pagination} from '@/components/shared/Pagination'
import {Empty} from '@/components/ui/empty'
import {message} from '@/components/ui/message'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {AttachmentCell} from '@/pages/records/form/AttachmentField'
import {AppReferenceValue} from '@/pages/records/AppReferenceValue'
import {useRecordApproval} from '@/pages/approvals/useRecordApproval'
import {FieldControl} from '@/pages/records/form/FormFieldControl'
import {parseFormLayout} from '@/pages/records/form/parseFormLayout'
import {buildRecordPayload, toEditValues} from '@/pages/records/form/recordPayload'
import {useAttachmentUploads} from '@/pages/records/form/useAttachmentUploads'
import {useReferenceOptions} from '@/pages/records/form/useReferenceOptions'
import {useViewQuery} from '@/pages/records/views/useViewQuery'
import {type ViewComponentProps, viewDisplayFields} from '@/pages/records/views/types'
import {
  DEFAULT_VIEW_PAGE_SIZE,
  layoutFieldLabel,
  VIEW_PAGE_SIZE_OPTIONS,
  viewPageCount,
} from '@/pages/records/views/viewUtils'
import {ViewErrorState, ViewInlineError, ViewSkeleton} from '@/pages/records/views/viewFeedback'
import {useViewFetching} from '@/pages/records/views/viewFetching'
import {formatFieldValue, isFieldWritable} from '@/lib/fieldConfig'
import {attachmentUrls, isAttachmentField} from '@/lib/attachments'
import type {AppFormField} from '@/services/appForms'
import {type AppRecord, updateAppRecord} from '@/services/appRecords'
import {cn, toErrorMessage} from '@/lib/utils'

const selectionWidth = 40
const defaultPrimaryWidth = 200
const defaultColumnWidth = 160
const minColumnWidth = 96

function cellAction(field: AppFormField) {
  if (field.type === 'REFERENCE' || field.type === 'MULTIREFERENCE') return {
    icon: SquareArrowOutUpRight,
    label: '选择引用'
  }
  if (field.type === 'DATE' || field.type === 'DATETIME') return {icon: CalendarDays, label: '选择日期'}
  if (isSingleDropdown(field) || field.type === 'MULTISELECT' && field.config?.displayStyle === 'DROPDOWN') {
    return {icon: ChevronDown, label: '选择选项'}
  }
  return {icon: Pencil, label: '编辑单元格'}
}

function isSingleDropdown(field: AppFormField) {
  return ['PICKLIST', 'SELECT', 'CLASSIFICATION'].includes(field.type) && field.config?.displayStyle !== 'RADIO'
}

function headerWidths(handle: HTMLElement) {
  const headers = handle.closest('tr')?.querySelectorAll<HTMLTableCellElement>('th[data-field]') ?? []
  return Object.fromEntries(Array.from(headers, header => [header.dataset.field!, header.getBoundingClientRect().width]))
}

function TableFieldEditor({onEditorKeyDown, onCancel, ...props}: React.ComponentProps<typeof FieldControl> & {
  onEditorKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
  onCancel: () => void
}) {
  const {field, value, disabled} = props
  const attachment = isAttachmentField(field.type)
  const expanded = attachment || ['NTEXT', 'MULTIREFERENCE'].includes(field.type)
    || field.type === 'MULTISELECT' && field.config?.displayStyle !== 'DROPDOWN'
    || field.config?.displayStyle === 'RADIO'
  const control = <FieldControl {...props} openPicker onPickerCancel={onCancel}/>
  if (!expanded) {
    return <div onKeyDownCapture={onEditorKeyDown}
                className="[&_input:not([type=checkbox])]:h-8 [&_[role=combobox]]:h-8 [&>div]:max-h-8">
      {control}
    </div>
  }
  const label = `编辑${field.label}`
  const summary = attachment ? `${attachmentUrls(value).length} 个附件`
    : field.type === 'MULTIREFERENCE' ? `已选 ${Array.isArray(value) ? value.length : 0} 项`
      : formatFieldValue(field, value)
  return (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 w-full justify-start px-2 font-normal"
                aria-label={label} title={label} disabled={disabled} onKeyDownCapture={onEditorKeyDown}>
          <span className="truncate">{summary === '-' ? label : summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label={label} align="start"
                      className="z-[1050] max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto"
                      onKeyDownCapture={onEditorKeyDown}
                      onInteractOutside={event => event.preventDefault()}
                      onEscapeKeyDown={event => {
                        event.preventDefault()
                        onCancel()
                      }}>
        {control}
      </PopoverContent>
    </Popover>
  )
}

export function TableView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick, selected = [], onSelectedChange} = props
  const [page, setPage] = React.useState(1)
  const [size, setSize] = React.useState(DEFAULT_VIEW_PAGE_SIZE)
  const [sortKey, setSortKey] = React.useState('')
  const [sortAsc, setSortAsc] = React.useState(true)
  const activeSort = sortKey ? {field: sortKey, order: sortAsc ? 'ASC' : 'DESC'} : view.sort
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({})
  const resize = React.useRef<{ pointerId: number; startX: number; widths: Record<string, number> } | null>(null)
  const [edit, setEdit] = React.useState<{
    id: string; fieldName: string; initial: unknown; value: unknown; required: boolean
  } | null>(null)
  const [saving, setSaving] = React.useState(false)
  const savePending = React.useRef(false)
  const saveOnExit = React.useRef<() => void>(() => {
  })
  const editorPointer = React.useRef<Event | null>(null)
  const editorFocused = React.useRef(false)
  const editRow = React.useRef<HTMLTableRowElement>(null)
  const editId = edit?.id
  const editField = edit?.fieldName
  const editFieldType = form.fields.find(field => field.name === editField)?.type
  const {uploading, startUpload} = useAttachmentUploads()
  const {locked} = useRecordApproval({appId, formName: form.name, recordId: editId, enabled: !!editId && !form.builtin})
  const referenceOptions = useReferenceOptions({appId, form, open: !!editId})

  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const displayNames = viewDisplayFields(form, view)
  const primaryField = form.displayField ? fieldMap.get(form.displayField) : undefined
  const columns = (() => {
    const mapped = displayNames
      .map((name) => fieldMap.get(name))
      .filter((field): field is AppFormField => Boolean(field))
    if (primaryField) {
      return [primaryField, ...mapped.filter((field) => field.name !== primaryField.name)]
    }
    return mapped
  })()
  const resized = columns.length > 0 && columns.every(column => columnWidths[column.name] !== undefined)
  const tableWidth = selectionWidth + columns.reduce((width, column) => width + (resized
    ? columnWidths[column.name] : column.name === primaryField?.name ? defaultPrimaryWidth : defaultColumnWidth), 0)

  const resizeColumn = (widths: Record<string, number>, name: string, delta: number) => {
    setColumnWidths({...widths, [name]: Math.max(minColumnWidth, widths[name] + delta)})
  }

  const query = useViewQuery(appId, form.name, view.id, {
    scope: 'RECORDS',
    page,
    size,
    search,
    filter: advancedFilter,
    sortField: sortKey || undefined,
    sortOrder: sortKey ? (sortAsc ? 'ASC' : 'DESC') : undefined,
  }, refreshTick)

  const rows = query.data?.list ?? []
  const total = query.data?.total ?? 0
  const pages = viewPageCount(total, size)
  const isInitialLoading = query.isLoading && !query.data
  useViewFetching(query.isFetching && !query.isLoading)

  const dirty = !!edit && JSON.stringify(edit.value) !== JSON.stringify(edit.initial)

  React.useEffect(() => {
    if (!editField || editFieldType === 'REFERENCE' && !locked) return
    const cell = editRow.current?.querySelector(`[data-field="${CSS.escape(editField)}"]`)
    if (cell?.querySelector('[aria-expanded="true"]')) return
    cell?.querySelector<HTMLElement>('[data-edit-control] :is(input, button, [role=status]):not([disabled])')?.focus({preventScroll: true})
  }, [editId, editField, editFieldType, locked])

  React.useEffect(() => {
    if (!editId) return
    const onOutsidePointer = (event: PointerEvent) => {
      if (event !== editorPointer.current) saveOnExit.current()
    }
    document.addEventListener('pointerdown', onOutsidePointer)
    return () => document.removeEventListener('pointerdown', onOutsidePointer)
  }, [editId])

  const editingRowVisible = !!editId && rows.some(row => String(row.id) === editId)
  React.useEffect(() => {
    if (!edit || editingRowVisible || saving) return
    if (dirty) {
      message.error('记录已离开当前列表，未保存的修改已取消')
    }
    setEdit(null)
  }, [edit, editingRowVisible, saving, dirty])

  const finishEdit = (restoreFocus: boolean) => {
    const row = editRow.current
    const cell = editField && row?.querySelector(`[data-field="${CSS.escape(editField)}"]`)
    setEdit(null)
    if (restoreFocus) requestAnimationFrame(() => {
      if (cell) cell.querySelector<HTMLButtonElement>('[data-cell-edit]')?.focus({preventScroll: true})
    })
  }

  const cancelEdit = () => {
    if (!savePending.current) finishEdit(true)
  }

  const saveEdit = async (restoreFocus: boolean, value = edit?.value) => {
    if (!edit || savePending.current || uploading) return
    if (locked) {
      finishEdit(restoreFocus)
      return
    }
    if (JSON.stringify(value) === JSON.stringify(edit.initial)) {
      finishEdit(restoreFocus)
      return
    }
    const fields = new Set([edit.fieldName])
    const payload = buildRecordPayload(form, fields, {[edit.fieldName]: value}, message.error, false,
      edit.required ? fields : new Set())
    if (!payload) return
    savePending.current = true
    setSaving(true)
    try {
      await updateAppRecord(appId, form.name, edit.id, payload)
      finishEdit(restoreFocus)
      props.onRecordChanged()
      message.success('保存成功')
    } catch (error) {
      message.error(toErrorMessage(error, '保存失败'))
    } finally {
      savePending.current = false
      setSaving(false)
    }
  }
  saveOnExit.current = () => void saveEdit(false)

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const target = event.target
    if (event.nativeEvent.isComposing || !(target instanceof HTMLElement) || !event.currentTarget.contains(target)) return
    if (target.getAttribute('aria-expanded') === 'true') return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancelEdit()
    } else if (event.key === 'Enter' && !event.shiftKey) {
      if (!dirty && target.closest('button:not([role="checkbox"])')) return
      event.preventDefault()
      event.stopPropagation()
      void saveEdit(true)
    }
  }

  React.useEffect(() => {
    setPage(1)
  }, [search, advancedFilter, view.filter])

  // 勾选只作用于当前页，翻页/改变每页数量时清空，避免对不可见记录执行批量操作。
  const selectionResetKey = `${page}:${size}`
  const previousSelectionKey = React.useRef(selectionResetKey)
  React.useEffect(() => {
    if (previousSelectionKey.current === selectionResetKey) return
    previousSelectionKey.current = selectionResetKey
    onSelectedChange?.([])
  }, [selectionResetKey, onSelectedChange])

  React.useEffect(() => {
    if (page > pages) setPage(pages)
  }, [page, pages])

  const rowIds = rows.map((row) => String(row.id))
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selected.includes(id))
  const someSelected = rowIds.some((id) => selected.includes(id))
  const toggleAll = () => onSelectedChange?.(allSelected ? [] : rowIds)
  const toggleOne = (id: string) => onSelectedChange?.(
    selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id])

  const sortBy = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortAsc(true)
    } else if (sortAsc) {
      setSortAsc(false)
    } else {
      setSortKey('')
      setSortAsc(true)
    }
    setPage(1)
  }

  const renderCell = (row: AppRecord, field: AppFormField) => {
    const value = row[field.name]
    if (isAttachmentField(field.type)) return <AttachmentCell value={value}/>
    if (field.type === 'REFERENCE') {
      return <AppReferenceValue appId={appId} field={field} value={value} onOpenRecord={props.onOpenLinkedRecord}/>
    }
    if (field.name === form.displayField) {
      const displayValue = value === undefined || value === null || value === '' ? '-' : String(value)
      return (
        <button
          type="button"
          className="text-left font-medium text-primary hover:underline"
          onClick={(event) => {
            event.stopPropagation()
            if (!edit) props.onOpenRecord(String(row.id))
          }}
        >
          {displayValue}
        </button>
      )
    }
    if (value === undefined || value === null || value === '') {
      return <span className="text-muted-foreground">-</span>
    }
    if (['PICKLIST', 'SELECT', 'CLASSIFICATION'].includes(field.type)) {
      const option = field.options?.find((item) => item.id === value || item.text === value)
      return (
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-2 w-2 rounded-full" style={{backgroundColor: option?.color ?? '#999'}}/>
          {option?.text ?? String(value)}
        </span>
      )
    }
    if (field.type === 'EMAIL') return <span className="text-primary">{String(value)}</span>
    return formatFieldValue(field, value)
  }

  if (query.error && !query.data) {
    return <ViewErrorState message={query.error} onRetry={query.reload}/>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="data-list app-table-scroll record-list-scroll relative min-h-0 min-w-0 flex-1">
        {query.error && <ViewInlineError message={query.error} onRetry={query.reload}/>}
        {isInitialLoading ? (
          <ViewSkeleton variant="table" rows={6}/>
        ) : rows.length === 0 ? (
          <Empty className="flex-1" description="暂无数据"/>
        ) : (
          <table
            className="app-table record-list-table table-fixed bg-background"
            style={resized ? {width: tableWidth} : {minWidth: tableWidth}}
          >
            <colgroup>
              <col style={{width: selectionWidth}}/>
              {columns.map((column) => (
                <col key={column.name}
                     style={{
                       width: resized ? columnWidths[column.name]
                         : columns.length > 1 && column.name === primaryField?.name ? defaultPrimaryWidth : undefined
                     }}/>
              ))}
            </colgroup>
            <thead>
            <tr>
              <th className="record-list-selection">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label="选择本页全部记录"
                />
              </th>
              {columns.map((column) => (
                <th
                  key={column.name}
                  data-field={column.name}
                  className={cn('cursor-pointer select-none hover:text-primary', column.name === primaryField?.name && 'record-list-primary')}
                  onClick={() => sortBy(column.name)}
                  aria-sort={activeSort?.field === column.name ? (activeSort.order === 'ASC' ? 'ascending' : 'descending') : 'none'}
                  title={`点击切换「${layoutFieldLabel(form, column.name, column.label)}」排序`}
                >
                <span className="inline-flex items-center gap-1">
                  {layoutFieldLabel(form, column.name, column.label)}
                  <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center">
                    {activeSort?.field === column.name && (activeSort.order === 'ASC' ?
                      <ArrowDown className="h-3 w-3"/> :
                      <ArrowUp className="h-3 w-3"/>)}
                  </span>
                </span>
                  <span role="separator" aria-orientation="vertical" tabIndex={0}
                        aria-label={`调整${layoutFieldLabel(form, column.name, column.label)}列宽`}
                        className="absolute inset-y-0 right-0 flex w-2 touch-none cursor-col-resize justify-end outline-none before:h-full before:w-0.5 hover:before:bg-primary focus-visible:before:bg-primary active:before:bg-primary"
                        onClick={event => event.stopPropagation()}
                        onPointerDown={event => {
                          if (event.button !== 0) return
                          event.preventDefault()
                          resize.current = {
                            pointerId: event.pointerId,
                            startX: event.clientX,
                            widths: headerWidths(event.currentTarget)
                          }
                          event.currentTarget.setPointerCapture(event.pointerId)
                        }}
                        onPointerMove={event => {
                          const drag = resize.current
                          if (drag?.pointerId === event.pointerId) {
                            resizeColumn(drag.widths, column.name, event.clientX - drag.startX)
                          }
                        }}
                        onLostPointerCapture={() => {
                          resize.current = null
                        }}
                        onKeyDown={event => {
                          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                          event.preventDefault()
                          resizeColumn(headerWidths(event.currentTarget), column.name, event.key === 'ArrowLeft' ? -16 : 16)
                        }}/>
                </th>
              ))}
            </tr>
            </thead>
            <tbody>
            {rows.map((row) => {
              const recordId = String(row.id)
              const editingRow = edit?.id === recordId
              const initial = edit ? null : toEditValues(form, row)
              const layout = initial && parseFormLayout(form, {scene: 'UPDATE', values: initial})
              const availableFields = new Set(layout?.entries.flatMap(entry =>
                entry.kind === 'FIELD' && !entry.readonly && isFieldWritable(entry.field, false) ? [entry.field.name] : []))
              return (
                <tr
                  key={recordId}
                  ref={editingRow ? editRow : undefined}
                  className="cursor-pointer"
                  data-selected={selected.includes(recordId)}
                  onClick={() => {
                    if (!edit) props.onOpenRecord(recordId)
                  }}
                >
                  <td className="record-list-selection" onClick={(event) => event.stopPropagation()}>
                    <Checkbox checked={selected.includes(recordId)} onCheckedChange={() => toggleOne(recordId)}
                              aria-label={`选择第 ${rows.indexOf(row) + 1} 条记录`}/>
                  </td>
                  {columns.map((column) => {
                    const editing = editingRow && edit.fieldName === column.name
                    const {icon: ActionIcon, label: actionLabel} = cellAction(column)
                    return <td key={column.name} data-field={column.name} data-editing={editing || undefined}
                               onClick={editing ? event => event.stopPropagation() : undefined}
                               onPointerDownCapture={editing ? event => {
                                 editorPointer.current = event.nativeEvent
                               } : undefined}
                               onFocusCapture={editing ? () => {
                                 editorFocused.current = true
                               } : undefined}
                               onBlurCapture={editing ? event => {
                                 editorFocused.current = false
                                 if (event.relatedTarget) window.setTimeout(() => {
                                   if (!editorFocused.current) saveOnExit.current()
                                 }, 0)
                               } : undefined}
                               className={cn('group/cell relative', column.name === primaryField?.name && 'record-list-primary')}>
                      {editing ? (
                        <div data-edit-control aria-busy={saving} title="离开单元格自动保存，Esc 取消">
                          {locked ? <span role="status" tabIndex={0} onKeyDown={handleEditorKeyDown}
                                          className="text-xs text-muted-foreground">审批中，已锁定</span>
                            : <TableFieldEditor appId={appId} formId={form.name}
                                                field={{...column, required: edit.required}}
                                                value={edit.value} options={column.options ?? []}
                                                referenceOptions={referenceOptions[column.name]}
                                                disabled={saving} onUploadStart={startUpload}
                                                onEditorKeyDown={handleEditorKeyDown} onCancel={cancelEdit}
                                                onChange={value => {
                                                  setEdit(current => current?.id === recordId && current.fieldName === column.name
                                                    ? {...current, value} : current)
                                                  if (column.type === 'REFERENCE' || isSingleDropdown(column)) void saveEdit(true, value)
                                                }}/>}
                        </div>
                      ) : (
                        <>
                          <div className={cn('overflow-hidden text-ellipsis whitespace-nowrap',
                            availableFields.has(column.name) && 'group-hover/cell:pr-4 group-focus-within/cell:pr-4 [@media(hover:none)]:pr-4')}>
                            {renderCell(row, column)}
                          </div>
                          {initial && availableFields.has(column.name) && <Button
                            type="button" variant="ghost" size="icon" data-cell-edit
                            className="pointer-events-none absolute inset-y-0 right-1 my-auto h-6 w-6 bg-background text-muted-foreground opacity-0 hover:text-primary group-hover/cell:pointer-events-auto group-hover/cell:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
                            aria-label={`${actionLabel}：${layoutFieldLabel(form, column.name, column.label)}`}
                            title={actionLabel}
                            onClick={event => {
                              event.stopPropagation()
                              const value = initial[column.name]
                              const draft = {
                                id: recordId, fieldName: column.name, initial: value, value,
                                required: layout?.requiredFieldNames.has(column.name) ?? false
                              }
                              if (ActionIcon !== CalendarDays) {
                                setEdit(draft)
                                return
                              }
                              const cell = event.currentTarget.closest('td')
                              // 原生日期选择器需要在触发它的用户事件内打开。
                              flushSync(() => setEdit(draft))
                              const input = cell?.querySelector<HTMLInputElement>('input:is([type="date"], [type="datetime-local"])')
                              input?.focus({preventScroll: true})
                              try {
                                input?.showPicker?.()
                              } catch {
                                // 受浏览器限制时继续使用已聚焦的日期输入框。
                              }
                            }}>
                            <ActionIcon className="h-3.5 w-3.5"/>
                          </Button>}
                        </>
                      )}
                    </td>
                  })}
                </tr>
              )
            })}
            </tbody>
          </table>
        )}
      </div>
      {!isInitialLoading && (
        <div className="mt-2 flex items-center justify-between">
          <Pagination
            page={page}
            pages={pages}
            total={total}
            size={size}
            sizeOptions={VIEW_PAGE_SIZE_OPTIONS}
            onChange={setPage}
            onSizeChange={(nextSize) => {
              setSize(nextSize)
              setPage(1)
            }}
            className="w-full"
          />
        </div>
      )}
    </div>
  )
}

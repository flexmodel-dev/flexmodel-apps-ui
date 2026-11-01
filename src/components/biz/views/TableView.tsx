import * as React from 'react'
import {ArrowDown, ArrowUp, Pencil, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {Pagination} from '@/components/biz/Pagination'
import {Empty} from '@/components/ui/empty'
import {AppLoading} from '@/components/biz/AppLoading'
import {AttachmentCell} from '@/components/biz/form/AttachmentField'
import {AppReferenceValue} from '@/components/biz/AppReferenceValue'
import {useViewQuery} from '@/components/biz/views/useViewQuery'
import {type ViewComponentProps, viewDisplayFields} from '@/components/biz/views/types'
import {formatFieldValue} from '@/lib/fieldConfig'
import {isAttachmentField} from '@/lib/attachments'
import type {AppFormField} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import {cn} from '@/lib/utils'

/** 表格视图：延续原有表格交互，数据改走视图查询接口。 */
export function TableView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick, selected = [], onSelectedChange} = props
  const [page, setPage] = React.useState(1)
  const [size, setSize] = React.useState(30)
  const [sortKey, setSortKey] = React.useState('')
  const [sortAsc, setSortAsc] = React.useState(true)

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
  const pages = Math.max(1, Math.ceil(total / size))
  const isLoading = query.isLoading

  const toggleAll = () => onSelectedChange?.(
    selected.length === rows.length ? [] : rows.map((row) => String(row.id)))
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
            props.onOpenRecord(String(row.id))
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="data-list app-table-scroll record-list-scroll min-h-0 min-w-0 flex-1">
        {isLoading ? (
          <AppLoading center className="min-h-[240px]"/>
        ) : (
          <table
            className="app-table record-list-table table-fixed bg-background"
            style={{minWidth: 48 + columns.reduce((width, column) => width + (column.name === primaryField?.name ? 220 : 180), 0) + 120}}
          >
            <colgroup>
              <col style={{width: 48}}/>
              {columns.map((column) => (
                <col key={column.name}
                     style={{width: columns.length > 1 && column.name === primaryField?.name ? 220 : undefined}}/>
              ))}
              <col style={{width: columns.length ? 120 : undefined}}/>
            </colgroup>
            <thead>
            <tr>
              <th className="record-list-selection">
                <Checkbox checked={rows.length > 0 && selected.length === rows.length} onCheckedChange={toggleAll}/>
              </th>
              {columns.map((column) => (
                <th
                  key={column.name}
                  className={cn('cursor-pointer select-none hover:text-primary', column.name === primaryField?.name && 'record-list-primary')}
                  onClick={() => sortBy(column.name)}
                >
                <span className="inline-flex items-center gap-1">
                  {form.layout.items.find((item) => item.type === 'FIELD' && item.name === column.name)?.label?.trim() || column.label}
                  <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center">
                    {sortKey === column.name && (sortAsc ? <ArrowDown className="h-3 w-3"/> :
                      <ArrowUp className="h-3 w-3"/>)}
                  </span>
                </span>
                </th>
              ))}
              <th className="record-list-actions">操作</th>
            </tr>
            </thead>
            <tbody>
            {rows.map((row) => {
              const recordId = String(row.id)
              return (
                <tr
                  key={recordId}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-muted/40',
                    selected.includes(recordId) && 'bg-primary/10',
                  )}
                  data-selected={selected.includes(recordId)}
                  onClick={() => props.onOpenRecord(recordId)}
                >
                  <td className="record-list-selection" onClick={(event) => event.stopPropagation()}>
                    <Checkbox checked={selected.includes(recordId)} onCheckedChange={() => toggleOne(recordId)}/>
                  </td>
                  {columns.map((column) => (
                    <td key={column.name} className={cn(column.name === primaryField?.name && 'record-list-primary')}>
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap">{renderCell(row, column)}</div>
                    </td>
                  ))}
                  <td className="record-list-actions">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7" title="编辑"
                        onClick={(event) => {
                          event.stopPropagation()
                          props.onOpenRecord(recordId, 'edit')
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5"/>
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive" title="删除"
                        onClick={(event) => {
                          event.stopPropagation()
                          props.onRequestDelete?.(recordId)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5"/>
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
            </tbody>
          </table>
        )}
        {!isLoading && rows.length === 0 && <Empty description="暂无数据"/>}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Pagination
          page={page}
          pages={pages}
          total={total}
          size={size}
          onChange={setPage}
          onSizeChange={(nextSize) => {
            setSize(nextSize)
            setPage(1)
          }}
          className="w-full"
        />
      </div>
    </div>
  )
}

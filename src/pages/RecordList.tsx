import * as React from 'react'
import {formatFieldValue} from '@/lib/fieldConfig'
import {useParams} from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowRightLeft,
  Columns3,
  Edit,
  FileInput,
  FileSpreadsheet,
  Filter,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Settings,
  Share,
  Trash2,
} from 'lucide-react'
import {AppLayout} from '@/components/layout/AppLayout'
import {AppLoading} from '@/components/biz/AppLoading'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {BizDialog, ConfirmDialog} from '@/components/ui/dialog'
import {Checkbox} from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Pagination} from '@/components/biz/Pagination'
import {Empty} from '@/components/ui/empty'
import {AppRecordDrawer} from '@/components/biz/AppRecordDrawer'
import {AppReferenceValue} from '@/components/biz/AppReferenceValue'
import {
  getAppForm,
  patchAppFormViewTabs,
  type AppForm,
  type AppFormField,
  type AppFormViewTab,
  type AppViewFilterOperator,
  type AppViewFilterValue,
} from '@/services/appForms'
import {
  deleteAppRecord,
  getAppRecords,
  type AppRecord,
} from '@/services/appRecords'
import {cn, toErrorMessage} from '@/lib/utils'

const compactButtonClass = 'h-8 px-2.5 text-xs'
const ALL_VIEW_TAB = {id: 'all', label: '全部'}

interface ViewTabConditionDraft {
  fieldName: string
  operator: AppViewFilterOperator
  value: AppViewFilterValue
}

interface ViewTabDraft {
  id: string
  label: string
  conditions: ViewTabConditionDraft[]
}

const viewTabOperatorLabels: Record<AppViewFilterOperator, string> = {
  _eq: '等于',
  _ne: '不等于',
  _contains: '包含',
  _not_contains: '不包含',
  _starts_with: '开头是',
  _ends_with: '结尾是',
  _gt: '大于',
  _gte: '大于等于',
  _lt: '小于',
  _lte: '小于等于',
}

function viewTabOperators(field: AppFormField): AppViewFilterOperator[] {
  switch (field.type) {
    case 'NUMBER':
    case 'DECIMAL':
    case 'DATE':
    case 'DATETIME':
    case 'TIME':
      return ['_eq', '_ne', '_gt', '_gte', '_lt', '_lte']
    case 'BOOL':
    case 'PICKLIST':
    case 'SELECT':
    case 'CLASSIFICATION':
    case 'MULTISELECT':
    case 'REFERENCE':
      return ['_eq', '_ne']
    default:
      return ['_eq', '_ne', '_contains', '_not_contains', '_starts_with', '_ends_with']
  }
}

function viewTabInputType(field: AppFormField) {
  if (field.type === 'NUMBER' || field.type === 'DECIMAL') return 'number'
  if (field.type === 'DATE') return 'date'
  if (field.type === 'DATETIME') return 'datetime-local'
  if (field.type === 'TIME') return 'time'
  return 'text'
}

function ConditionValueControl({
                                 field,
                                 value,
                                 onChange,
                               }: {
  field: AppFormField
  value: AppViewFilterValue
  onChange: (value: AppViewFilterValue) => void
}) {
  if (field.type === 'BOOL') {
    return (
      <Select value={String(value)} onValueChange={(nextValue) => onChange(nextValue === 'true')}>
        <SelectTrigger className="h-8 w-[180px]">
          <SelectValue placeholder="请选择"/>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">是</SelectItem>
          <SelectItem value="false">否</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  if (field.options?.length) {
    return (
      <Select value={String(value)} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[180px]">
          <SelectValue placeholder="请选择"/>
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option) => {
            const optionValue = option.text ?? option.id ?? ''
            return (
              <SelectItem key={option.id ?? optionValue} value={optionValue}>
                {optionValue}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    )
  }
  return (
    <Input
      type={viewTabInputType(field)}
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-[180px]"
      placeholder={field.type === 'REFERENCE' ? '记录 ID' : undefined}
    />
  )
}

function toViewTabDraft(tab: AppFormViewTab): ViewTabDraft {
  return {
    id: tab.id,
    label: tab.label,
    conditions: tab.filter._and.map((condition) => {
      const fieldName = Object.keys(condition)[0]
      const operator = Object.keys(condition[fieldName])[0] as AppViewFilterOperator
      return {fieldName, operator, value: condition[fieldName][operator]}
    }),
  }
}

export default function RecordList({formName}: { formName?: string }) {
  const {appId = ''} = useParams<{ appId: string; menuId: string }>()
  const resolvedFormName = formName ?? ''
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [rows, setRows] = React.useState<AppRecord[]>([])
  const [total, setTotal] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState('')
  const [debouncedQ, setDebouncedQ] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [size, setSize] = React.useState(20)
  const [selected, setSelected] = React.useState<string[]>([])
  const [sortKey, setSortKey] = React.useState('')
  const [sortAsc, setSortAsc] = React.useState(true)
  const [activeTabId, setActiveTabId] = React.useState('all')
  const [tabsConfigOpen, setTabsConfigOpen] = React.useState(false)
  const [draftTabs, setDraftTabs] = React.useState<ViewTabDraft[]>([])
  const [isSavingTabs, setIsSavingTabs] = React.useState(false)
  const [tabsError, setTabsError] = React.useState<string | null>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const searchAreaRef = React.useRef<HTMLDivElement>(null)
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [detailMode, setDetailMode] = React.useState<'view' | 'edit'>('view')
  const [linkedRecord, setLinkedRecord] = React.useState<{ formName: string; recordId: string } | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [refreshTick, setRefreshTick] = React.useState(0)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [deleteIds, setDeleteIds] = React.useState<string[] | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [q])

  React.useEffect(() => {
    if (!searchOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (searchAreaRef.current && !searchAreaRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [searchOpen])

  React.useEffect(() => {
    if (!appId || !resolvedFormName) {
      setForm(null)
      setIsLoading(false)
      setError('未知表单')
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getAppForm(appId, resolvedFormName)
      .then((loadedForm) => {
        if (cancelled) return
        setForm(loadedForm)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setForm(null)
        setError(toErrorMessage(caught, '加载表单失败'))
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, resolvedFormName])

  React.useEffect(() => {
    if (activeTabId === 'all') return
    if (!form?.viewTabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId('all')
    }
  }, [activeTabId, form])

  React.useEffect(() => {
    if (!appId || !resolvedFormName) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getAppRecords(appId, resolvedFormName, {
      page,
      size,
      search: debouncedQ,
      sortField: sortKey || undefined,
      sortOrder: sortKey ? (sortAsc ? 'ASC' : 'DESC') : undefined,
      viewTabId: activeTabId === 'all' ? undefined : activeTabId,
    })
      .then((result) => {
        if (cancelled) return
        setRows(result.list)
        setTotal(result.total)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(toErrorMessage(caught, '加载记录失败'))
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, resolvedFormName, page, size, debouncedQ, sortKey, sortAsc, activeTabId, refreshTick])

  React.useEffect(() => {
    setSelected([])
    setDetailId(null)
    setDetailMode('view')
    setLinkedRecord(null)
    setFormOpen(false)
    setQ('')
    setDebouncedQ('')
    setSortKey('')
    setSortAsc(true)
    setPage(1)
  }, [appId, resolvedFormName])

  const availableFilterFields = form?.fields.filter((field) => !field.builtin) ?? []

  const openTabsConfig = () => {
    setDraftTabs((form?.viewTabs ?? []).map(toViewTabDraft))
    setTabsError(null)
    setTabsConfigOpen(true)
  }

  const updateDraftTab = (index: number, label: string) => {
    setDraftTabs((tabs) => tabs.map((tab, tabIndex) => (tabIndex === index ? {...tab, label} : tab)))
  }

  const addDraftTab = () => {
    const firstField = availableFilterFields[0]
    setDraftTabs((tabs) => [...tabs, {
      id: crypto.randomUUID(),
      label: '新页签',
      conditions: firstField
        ? [{fieldName: firstField.name, operator: '_eq', value: firstField.type === 'BOOL' ? false : ''}]
        : [],
    }])
  }

  const removeDraftTab = (index: number) => {
    setDraftTabs((tabs) => tabs.filter((_, tabIndex) => tabIndex !== index))
  }

  const updateDraftCondition = (tabIndex: number, conditionIndex: number, condition: ViewTabConditionDraft) => {
    setDraftTabs((tabs) => tabs.map((tab, index) => {
      if (index !== tabIndex) return tab
      return {
        ...tab, conditions: tab.conditions.map((item, itemIndex) => (
          itemIndex === conditionIndex ? condition : item
        ))
      }
    }))
  }

  const addDraftCondition = (tabIndex: number) => {
    const firstField = availableFilterFields[0]
    if (!firstField) return
    setDraftTabs((tabs) => tabs.map((tab, index) => {
      if (index !== tabIndex) return tab
      return {
        ...tab, conditions: [...tab.conditions, {
          fieldName: firstField.name,
          operator: '_eq',
          value: firstField.type === 'BOOL' ? false : '',
        }]
      }
    }))
  }

  const removeDraftCondition = (tabIndex: number, conditionIndex: number) => {
    setDraftTabs((tabs) => tabs.map((tab, index) => {
      if (index !== tabIndex) return tab
      return {...tab, conditions: tab.conditions.filter((_, itemIndex) => itemIndex !== conditionIndex)}
    }))
  }

  const saveTabsConfig = async () => {
    const fieldMap = new Map(availableFilterFields.map((field) => [field.name, field]))
    const labels = new Set<string>()
    const nextTabs: AppFormViewTab[] = []
    try {
      for (const tab of draftTabs) {
        const label = tab.label.trim()
        if (!label || label.length > 32) throw new Error('页签名称不能为空，且不能超过 32 个字符')
        if (labels.has(label)) throw new Error(`页签名称重复：${label}`)
        labels.add(label)
        if (!tab.conditions.length) throw new Error(`页签「${label}」至少需要一个筛选条件`)
        const conditions = tab.conditions.map((condition) => {
          const field = fieldMap.get(condition.fieldName)
          if (!field) throw new Error(`页签「${label}」包含无效字段`)
          let value = condition.value
          if (field.type === 'NUMBER' || field.type === 'DECIMAL') {
            const numericValue = Number(value)
            if (!Number.isFinite(numericValue)) throw new Error(`页签「${label}」的数字筛选值不合法`)
            value = numericValue
          } else if (field.type === 'BOOL') {
            if (typeof value !== 'boolean') throw new Error(`页签「${label}」的布尔筛选值不合法`)
          } else if (typeof value === 'string') {
            value = value.trim()
            if (!value) throw new Error(`页签「${label}」的筛选值不能为空`)
          }
          return {[field.name]: {[condition.operator]: value}}
        })
        nextTabs.push({id: tab.id, label, filter: {_and: conditions}})
      }
      setIsSavingTabs(true)
      setTabsError(null)
      const updatedForm = await patchAppFormViewTabs(appId, resolvedFormName, nextTabs)
      setForm(updatedForm)
      if (!updatedForm.viewTabs.some((tab) => tab.id === activeTabId)) setActiveTabId('all')
      setTabsConfigOpen(false)
    } catch (caught: unknown) {
      setTabsError(toErrorMessage(caught, '保存页签失败'))
    } finally {
      setIsSavingTabs(false)
    }
  }

  const refresh = () => setRefreshTick((tick) => tick + 1)
  const openLinkedRecord = (formName: string, recordId: string) => setLinkedRecord({formName, recordId})

  const requestDeleteSelected = () => {
    if (!selected.length) return
    setDeleteError(null)
    setDeleteIds(selected)
  }

  const requestDeleteRecord = (recordId: string) => {
    setDeleteError(null)
    setDeleteIds([recordId])
  }

  const confirmDelete = async () => {
    if (!deleteIds?.length) return
    setIsDeleting(true)
    setDeleteError(null)
    setDeletingId(deleteIds.length === 1 ? deleteIds[0] : null)
    try {
      for (const recordId of deleteIds) {
        await deleteAppRecord(appId, resolvedFormName, recordId)
      }
      setSelected((previous) => previous.filter((recordId) => !deleteIds.includes(recordId)))
      if (detailId && deleteIds.includes(detailId)) setDetailId(null)
      if (linkedRecord && deleteIds.includes(linkedRecord.recordId)) setLinkedRecord(null)
      setDeleteIds(null)
      if (deleteIds.length > 1) setPage(1)
      refresh()
    } catch (caught: unknown) {
      setDeleteError(toErrorMessage(caught, '删除记录失败'))
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  if (!form) {
    return (
      <AppLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          {error ?? '未知表单'}
        </div>
      </AppLayout>
    )
  }

  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const viewTabs = [ALL_VIEW_TAB, ...form.viewTabs]
  const layoutNames = form.layout.items.length
    ? form.layout.items
      .filter((item) => item.type === 'FIELD' && Boolean(item.name))
      .map((item) => item.name!)
    : form.fields.filter((field) => !field.builtin).map((field) => field.name)
  const layoutColumns = layoutNames
    .map((name) => fieldMap.get(name))
    .filter((field): field is AppFormField => Boolean(field))
  const primaryField = form.displayField ? fieldMap.get(form.displayField) : undefined
  const columns = primaryField
    ? [primaryField, ...layoutColumns.filter((field) => field.name !== primaryField.name)]
    : layoutColumns
  const pages = Math.max(1, Math.ceil(total / size))

  const toggleAll = () => setSelected(selected.length === rows.length ? [] : rows.map((row) => String(row.id)))
  const toggleOne = (id: string) => setSelected((previous) =>
    previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id])

  const openRecordDetail = (recordId: string, mode: 'view' | 'edit' = 'view') => {
    setDetailId(recordId)
    setDetailMode(mode)
  }

  const editRecord = (recordId: string) => openRecordDetail(recordId, 'edit')

  const sortBy = (key: string) => {
    if (sortKey === key) setSortAsc((asc) => !asc)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
    setPage(1)
  }

  const renderCell = (row: AppRecord, field: AppFormField) => {
    const value = row[field.name]
    if (field.type === 'REFERENCE') {
      return <AppReferenceValue appId={appId} field={field} value={value} onOpenRecord={openLinkedRecord}/>
    }
    if (field.name === form.displayField) {
      const displayValue = value === undefined || value === null || value === '' ? '-' : String(value)
      return (
        <button
          type="button"
          className="text-left font-medium text-primary hover:underline"
          onClick={(event) => {
            event.stopPropagation()
            openRecordDetail(String(row.id))
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
          <i
            className="inline-block h-2 w-2 rounded-full"
            style={{backgroundColor: option?.color ?? '#999'}}
          />
          {option?.text ?? String(value)}
        </span>
      )
    }
    if (field.type === 'EMAIL') return <span className="text-primary">{String(value)}</span>
    return formatFieldValue(field, value)
  }

  return (
    <AppLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
      <div
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{form.label}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div ref={searchAreaRef} className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                title="搜索"
                aria-label="搜索"
                onClick={() => setSearchOpen((open) => !open)}
              >
                <Search className="h-4 w-4"/>
              </Button>
              {searchOpen && (
                <Input
                  value={q}
                  placeholder={`搜索${form.label}`}
                  onChange={(event) => {
                    setQ(event.target.value)
                    setPage(1)
                  }}
                  className="h-8 w-[160px]"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setQ('')
                      setSearchOpen(false)
                    }
                  }}
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                title="高级查询"
                aria-label="高级查询"
              >
                <Filter className="h-4 w-4"/>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                title="列显示"
                aria-label="列显示"
              >
                <Columns3 className="h-4 w-4"/>
              </Button>
            </div>
            <Button
              size="sm"
              className={compactButtonClass}
              onClick={() => setFormOpen(true)}
            >
              <Plus className="h-4 w-4"/> 新建
            </Button>
            <Button variant="secondary" size="sm" className={compactButtonClass}>
              <FileInput className="h-4 w-4"/> 导入
            </Button>
            <Button variant="secondary" size="sm" className={compactButtonClass}>
              <FileSpreadsheet className="h-4 w-4"/> 导出
            </Button>
          </div>
        </div>

        <div className="flex items-end justify-between border-b px-3">
          <ul className="flex list-none items-center gap-1">
            {viewTabs.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTabId(tab.id)
                    setPage(1)
                    setSelected([])
                  }}
                  className={cn(
                    '-mb-0.5 inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
                    activeTabId === tab.id ? 'border-primary text-foreground' : 'border-transparent',
                  )}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="mb-1 flex items-center gap-1">
            <span className="block h-5 w-px shrink-0 bg-muted-foreground/40" aria-hidden="true"/>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="配置页签"
              aria-label="配置页签"
              onClick={openTabsConfig}
            >
              <Settings className="h-4 w-4"/>
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'overflow-hidden border-b bg-card transition-[max-height,opacity] duration-200',
            selected.length ? 'max-h-14 opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="text-sm text-muted-foreground">共选择 {selected.length}/{total} 条数据</span>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                className={compactButtonClass}
                disabled={selected.length !== 1}
                onClick={() => openRecordDetail(selected[0], 'edit')}
              >
                <Edit className="h-4 w-4"/> 编辑
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className={compactButtonClass}
                disabled={!selected.length || isDeleting}
                onClick={requestDeleteSelected}
              >
                <Trash2 className="h-4 w-4"/> 删除
              </Button>
              <Button variant="secondary" size="sm" className={compactButtonClass}>
                <Share className="h-4 w-4"/> 共享
              </Button>
              <Button variant="secondary" size="sm" className={compactButtonClass}>
                <ArrowRightLeft className="h-4 w-4"/> 移交
              </Button>
              <Button variant="secondary" size="sm" className={compactButtonClass}>
                <FileSpreadsheet className="h-4 w-4"/> 导出
              </Button>
              <Button variant="secondary" size="sm" className={compactButtonClass}>
                <ListChecks className="h-4 w-4"/> 批量编辑
              </Button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-3">
          {error && (
            <div className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}
          <div className="data-list app-table-scroll min-h-0 flex-1 overflow-x-auto">
            {isLoading ? (
              <AppLoading center className="min-h-[240px]"/>
            ) : (
              <table className="app-table w-full min-w-[900px] border-collapse bg-background">
                <thead>
                <tr>
                  <th className="w-[36px]">
                    <Checkbox
                      checked={rows.length > 0 && selected.length === rows.length}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.name}
                      className="cursor-pointer select-none hover:text-primary"
                      onClick={() => sortBy(column.name)}
                    >
                      {form.layout.items.find((item) => item.type === 'FIELD' && item.name === column.name)?.label?.trim() || column.label}
                      {sortKey === column.name && (
                        sortAsc ? <ArrowDown className="ml-1 h-3 w-3"/> : <ArrowUp className="ml-1 h-3 w-3"/>
                      )}
                    </th>
                  ))}
                  <th className="w-[120px]">操作</th>
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
                      onClick={() => openRecordDetail(recordId)}
                    >
                      <td onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selected.includes(recordId)}
                          onCheckedChange={() => toggleOne(recordId)}
                        />
                      </td>
                      {columns.map((column) => (
                        <td key={column.name}>{renderCell(row, column)}</td>
                      ))}
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="编辑"
                            onClick={(event) => {
                              event.stopPropagation()
                              editRecord(recordId)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5"/>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="删除"
                            disabled={deletingId === recordId}
                            onClick={(event) => {
                              event.stopPropagation()
                              requestDeleteRecord(recordId)
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
      </div>

      <AppRecordDrawer
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null)
            setDetailMode('view')
          }
        }}
        appId={appId}
        formName={resolvedFormName}
        recordId={detailId}
        initialMode={detailMode}
        onSaved={() => refresh()}
        onOpenRecord={openLinkedRecord}
        onDeleted={() => {
          setDetailId(null)
          setLinkedRecord(null)
          setSelected((previous) => previous.filter((id) => id !== detailId))
          refresh()
        }}
      />

      <AppRecordDrawer
        open={Boolean(linkedRecord)}
        onOpenChange={(open) => {
          if (!open) setLinkedRecord(null)
        }}
        appId={appId}
        formName={linkedRecord?.formName ?? resolvedFormName}
        recordId={linkedRecord?.recordId ?? null}
        onSaved={() => refresh()}
        onOpenRecord={openLinkedRecord}
        onDeleted={() => {
          setLinkedRecord(null)
          refresh()
        }}
      />

      <AppRecordDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        appId={appId}
        formName={resolvedFormName}
        onSaved={() => {
          setSelected([])
          refresh()
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteIds)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteIds(null)
            setDeleteError(null)
          }
        }}
        title={deleteIds?.length === 1 ? '删除记录' : '批量删除记录'}
        message={<>
          {deleteIds?.length === 1
            ? `确认删除这条「${form.label}」记录吗？删除后不可恢复。`
            : `确认删除选中的 ${deleteIds?.length ?? 0} 条「${form.label}」记录吗？删除后不可恢复。`}
          {deleteError ? (
            <div className="mt-2 text-sm text-destructive" role="alert">{deleteError}</div>
          ) : null}
        </>}
        busy={isDeleting}
        confirmText="删除"
        onConfirm={() => void confirmDelete()}
      />

      <BizDialog
        open={tabsConfigOpen}
        onOpenChange={setTabsConfigOpen}
        title="配置页签"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setTabsConfigOpen(false)} disabled={isSavingTabs}>
              取消
            </Button>
            <Button size="sm" onClick={() => void saveTabsConfig()} disabled={isSavingTabs}>
              {isSavingTabs ? '保存中...' : '保存'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {tabsError ? (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {tabsError}
            </div>
          ) : null}
          {!availableFilterFields.length ? (
            <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
              当前表单暂无可筛选字段
            </div>
          ) : draftTabs.map((tab, tabIndex) => (
            <div key={tab.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={tab.label}
                  onChange={(event) => updateDraftTab(tabIndex, event.target.value)}
                  className="h-8 flex-1"
                  placeholder="页签名称"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeDraftTab(tabIndex)}
                  aria-label="删除页签"
                >
                  <Trash2 className="h-4 w-4"/>
                </Button>
              </div>
              {tab.conditions.map((condition, conditionIndex) => {
                const field = fieldMap.get(condition.fieldName)
                if (!field) return null
                const operators = viewTabOperators(field)
                return (
                  <div key={`${tab.id}-${conditionIndex}`} className="flex items-center gap-2">
                    <Select
                      value={condition.fieldName}
                      onValueChange={(fieldName) => updateDraftCondition(tabIndex, conditionIndex, {
                        fieldName,
                        operator: '_eq',
                        value: fieldMap.get(fieldName)?.type === 'BOOL' ? false : '',
                      })}
                    >
                      <SelectTrigger className="h-8 w-[150px]">
                        <SelectValue placeholder="字段"/>
                      </SelectTrigger>
                      <SelectContent>
                        {availableFilterFields.map((item) => (
                          <SelectItem key={item.name} value={item.name}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={condition.operator}
                      onValueChange={(operator) => updateDraftCondition(tabIndex, conditionIndex, {
                        ...condition,
                        operator: operator as AppViewFilterOperator,
                      })}
                    >
                      <SelectTrigger className="h-8 w-[120px]">
                        <SelectValue placeholder="条件"/>
                      </SelectTrigger>
                      <SelectContent>
                        {operators.map((operator) => (
                          <SelectItem key={operator} value={operator}>
                            {viewTabOperatorLabels[operator]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ConditionValueControl
                      field={field}
                      value={condition.value}
                      onChange={(value) => updateDraftCondition(tabIndex, conditionIndex, {
                        ...condition,
                        value,
                      })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeDraftCondition(tabIndex, conditionIndex)}
                      aria-label="删除条件"
                    >
                      <Trash2 className="h-4 w-4"/>
                    </Button>
                  </div>
                )
              })}
              <Button
                variant="secondary"
                size="sm"
                className={compactButtonClass}
                onClick={() => addDraftCondition(tabIndex)}
                disabled={tab.conditions.length >= 10}
              >
                <Plus className="h-4 w-4"/> 添加条件
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            className={compactButtonClass}
            onClick={addDraftTab}
            disabled={!availableFilterFields.length || draftTabs.length >= 20}
          >
            <Plus className="h-4 w-4"/> 新增页签
          </Button>
        </div>
      </BizDialog>
    </AppLayout>
  )
}

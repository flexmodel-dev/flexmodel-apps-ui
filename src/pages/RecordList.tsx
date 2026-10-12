import * as React from 'react'
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
import {BizDialog} from '@/components/ui/dialog'
import {Checkbox} from '@/components/ui/checkbox'
import {Pagination} from '@/components/biz/Pagination'
import {Empty} from '@/components/ui/empty'
import {Drawer, DrawerContent} from '@/components/ui/drawer'
import {AppRecordDetail} from '@/components/biz/AppRecordDetail'
import {AppRecordFormModal} from '@/components/biz/AppRecordFormModal'
import {AppReferenceValue} from '@/components/biz/AppReferenceValue'
import {getAppForm, type AppForm, type AppFormField} from '@/services/appForms'
import {
  deleteAppRecord,
  getAppRecords,
  type AppRecord,
} from '@/services/appRecords'
import {cn} from '@/lib/utils'
import {isFormDividerField} from '@/lib/form-layout'

const defaultViewTabs = ['全部']
const compactButtonClass = 'h-8 px-2.5 text-xs'

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
  const [filterName, setFilterName] = React.useState('全部')
  const [viewTabs, setViewTabs] = React.useState(defaultViewTabs)
  const [tabsConfigOpen, setTabsConfigOpen] = React.useState(false)
  const [draftTabs, setDraftTabs] = React.useState(defaultViewTabs)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const searchAreaRef = React.useRef<HTMLDivElement>(null)
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [linkedRecord, setLinkedRecord] = React.useState<{ formName: string; recordId: string } | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [formRecordId, setFormRecordId] = React.useState<string | null>(null)
  const [refreshTick, setRefreshTick] = React.useState(0)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

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
        setError(caught instanceof Error ? caught.message : '加载表单失败')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, resolvedFormName])

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
    })
      .then((result) => {
        if (cancelled) return
        setRows(result.list)
        setTotal(result.total)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : '加载记录失败')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, resolvedFormName, page, size, debouncedQ, sortKey, sortAsc, refreshTick])

  React.useEffect(() => {
    setSelected([])
    setDetailId(null)
    setLinkedRecord(null)
    setFormOpen(false)
    setFormRecordId(null)
    setQ('')
    setDebouncedQ('')
    setSortKey('')
    setSortAsc(true)
    setPage(1)
  }, [appId, resolvedFormName])

  const openTabsConfig = () => {
    setDraftTabs(viewTabs)
    setTabsConfigOpen(true)
  }

  const updateDraftTab = (index: number, label: string) => {
    setDraftTabs((tabs) => tabs.map((tab, tabIndex) => (tabIndex === index ? label : tab)))
  }

  const addDraftTab = () => setDraftTabs((tabs) => [...tabs, '新页签'])

  const removeDraftTab = (index: number) => {
    setDraftTabs((tabs) => (tabs.length > 1 ? tabs.filter((_, tabIndex) => tabIndex !== index) : tabs))
  }

  const saveTabsConfig = () => {
    const nextTabs = Array.from(new Set(draftTabs.map((tab) => tab.trim()).filter(Boolean)))
    if (!nextTabs.length) return
    setViewTabs(nextTabs)
    if (!nextTabs.includes(filterName)) setFilterName(nextTabs[0])
    setTabsConfigOpen(false)
  }

  const refresh = () => setRefreshTick((tick) => tick + 1)
  const openLinkedRecord = (formName: string, recordId: string) => setLinkedRecord({formName, recordId})

  const removeSelected = async () => {
    if (!selected.length) return
    setIsDeleting(true)
    setError(null)
    try {
      for (const recordId of selected) {
        await deleteAppRecord(appId, resolvedFormName, recordId)
      }
      setSelected([])
      setPage(1)
      refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '删除记录失败')
    } finally {
      setIsDeleting(false)
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
  const layoutColumns = (form.layout?.fields?.length ? form.layout.fields : form.fields.map((field) => field.name))
    .map((name) => fieldMap.get(name))
    .filter((field): field is AppFormField => Boolean(field) && !field!.builtin && !isFormDividerField(field!.name))
  const primaryField = form.displayField ? fieldMap.get(form.displayField) : undefined
  const columns = primaryField
    ? [primaryField, ...layoutColumns.filter((field) => field.name !== primaryField.name)]
    : layoutColumns
  const pages = Math.max(1, Math.ceil(total / size))

  const toggleAll = () => setSelected(selected.length === rows.length ? [] : rows.map((row) => String(row.id)))
  const toggleOne = (id: string) => setSelected((previous) =>
    previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id])

  const editRecord = (recordId: string) => {
    setFormRecordId(recordId)
    setFormOpen(true)
  }

  const removeRecord = async (recordId: string) => {
    setDeletingId(recordId)
    try {
      await deleteAppRecord(appId, resolvedFormName, recordId)
      setSelected((previous) => previous.filter((item) => item !== recordId))
      if (detailId === recordId) setDetailId(null)
      if (linkedRecord?.recordId === recordId) setLinkedRecord(null)
      refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '删除记录失败')
    } finally {
      setDeletingId(null)
    }
  }
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
            setDetailId(String(row.id))
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
      const option = field.options?.find((item) => item.text === value)
      return (
        <span className="inline-flex items-center gap-1">
          <i
            className="inline-block h-2 w-2 rounded-full"
            style={{backgroundColor: option?.color ?? '#999'}}
          />
          {String(value)}
        </span>
      )
    }
    if (field.type === 'BOOL') return value === true ? '是' : '否'
    if (field.type === 'NUMBER' || field.type === 'DECIMAL') return Number(value).toLocaleString()
    if (field.type === 'EMAIL') return <span className="text-primary">{String(value)}</span>
    return String(value)
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
              onClick={() => {
                setFormRecordId(null)
                setFormOpen(true)
              }}
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
            {viewTabs.map((label) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => setFilterName(label)}
                  className={cn(
                    '-mb-0.5 inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
                    filterName === label ? 'border-primary text-foreground' : 'border-transparent',
                  )}
                >
                  {label}
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
                onClick={() => {
                  setFormRecordId(selected[0] ?? null)
                  setFormOpen(true)
                }}
              >
                <Edit className="h-4 w-4"/> 编辑
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className={compactButtonClass}
                disabled={!selected.length || isDeleting}
                onClick={removeSelected}
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
                      {form.layout?.properties?.[column.name]?.label?.trim() || column.label}
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
                      onClick={() => setDetailId(recordId)}
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
                              void removeRecord(recordId)
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

      <Drawer open={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)}>
        <DrawerContent className="w-full overflow-y-auto md:w-[calc(100vw-16rem)]">
          <div className="p-4 md:p-5">
            {detailId && (
              <AppRecordDetail
                appId={appId}
                formName={resolvedFormName}
                recordId={detailId}
                onOpenRecord={openLinkedRecord}
                onDeleted={() => {
                  setDetailId(null)
                  setLinkedRecord(null)
                  setSelected((previous) => previous.filter((id) => id !== detailId))
                  refresh()
                }}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={Boolean(linkedRecord)} onOpenChange={(open) => !open && setLinkedRecord(null)}>
        <DrawerContent className="w-full overflow-y-auto md:w-[calc(100vw-16rem)]">
          <div className="p-4 md:p-5">
            {linkedRecord && (
              <AppRecordDetail
                appId={appId}
                formName={linkedRecord.formName}
                recordId={linkedRecord.recordId}
                onOpenRecord={openLinkedRecord}
                onDeleted={() => {
                  setLinkedRecord(null)
                  refresh()
                }}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AppRecordFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        appId={appId}
        form={form}
        recordId={formRecordId}
        onSaved={() => {
          setSelected([])
          refresh()
        }}
      />

      <BizDialog
        open={tabsConfigOpen}
        onOpenChange={setTabsConfigOpen}
        title="配置页签"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setTabsConfigOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={saveTabsConfig} disabled={!draftTabs.some((tab) => tab.trim())}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {draftTabs.map((label, index) => (
            <div key={`${label}-${index}`} className="flex items-center gap-2">
              <Input
                value={label}
                onChange={(event) => updateDraftTab(index, event.target.value)}
                className="h-8"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={draftTabs.length <= 1}
                onClick={() => removeDraftTab(index)}
              >
                <Trash2 className="h-4 w-4"/>
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" className={compactButtonClass} onClick={addDraftTab}>
            <Plus className="h-4 w-4"/> 新增页签
          </Button>
        </div>
      </BizDialog>
    </AppLayout>
  )
}

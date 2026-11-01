import {Popover, PopoverTrigger} from '@/components/ui/popover'
import {type RecordQuery, RecordQueryPopover} from '@/components/biz/RecordQueryPopover'
import * as React from 'react'
import {
  ArrowRightLeft,
  Edit,
  FileInput,
  FileSpreadsheet,
  Filter,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share,
  Trash2,
} from 'lucide-react'
import {useParams} from 'react-router-dom'
import {AppLayout} from '@/components/layout/AppLayout'
import {AppLoading} from '@/components/biz/AppLoading'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {ConfirmDialog} from '@/components/ui/dialog'
import {message} from '@/components/ui/message'
import {AppRecordDrawer} from '@/components/biz/AppRecordDrawer'
import {AppTransferDialog} from '@/components/biz/AppTransferDialog'
import {ViewBar} from '@/components/biz/views/ViewBar'
import {ViewSettingsDrawer, type ViewSettingsTarget} from '@/components/biz/views/ViewSettingsDrawer'
import {TableView} from '@/components/biz/views/TableView'
import {GalleryView} from '@/components/biz/views/GalleryView'
import {DetailView} from '@/components/biz/views/DetailView'
import {KanbanView} from '@/components/biz/views/KanbanView'
import {CalendarView} from '@/components/biz/views/CalendarView'
import {HierarchyView} from '@/components/biz/views/HierarchyView'
import {GanttView} from '@/components/biz/views/GanttView'
import type {ViewComponentProps} from '@/components/biz/views/types'
import {
  type AppForm,
  type AppFormViewFilter,
  type AppFormViewTab,
  type AppViewType,
  getAppForm,
  patchAppFormViewTabs,
} from '@/services/appForms'
import {deleteAppRecord} from '@/services/appRecords'
import {cn, toErrorMessage} from '@/lib/utils'

const compactButtonClass = 'h-8 px-2.5 text-xs'

function ViewRenderer(props: ViewComponentProps) {
  switch (props.view.type) {
    case 'KANBAN':
      return <KanbanView {...props} />
    case 'CALENDAR':
      return <CalendarView {...props} />
    case 'GALLERY':
      return <GalleryView {...props} />
    case 'DETAIL':
      return <DetailView {...props} />
    case 'HIERARCHY':
      return <HierarchyView {...props} />
    case 'GANTT':
      return <GanttView {...props} />
    default:
      return <TableView {...props} />
  }
}

/**
 * 表单记录页：视图页面容器。负责表单加载、当前视图、共享查询、工具栏和记录操作；
 * 各视图组件只负责展示与专属交互。
 */
export default function RecordList({formName}: { formName?: string }) {
  const {appId = ''} = useParams<{ appId: string; menuId: string }>()
  const resolvedFormName = formName ?? ''
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [queryOpen, setQueryOpen] = React.useState(false)
  const [advancedQuery, setAdvancedQuery] = React.useState<RecordQuery | null>(null)
  const [q, setQ] = React.useState('')
  const [debouncedQ, setDebouncedQ] = React.useState('')
  const [selected, setSelected] = React.useState<string[]>([])
  const [activeViewId, setActiveViewId] = React.useState('')
  const [settingsTarget, setSettingsTarget] = React.useState<ViewSettingsTarget | null>(null)
  const [deleteViewTarget, setDeleteViewTarget] = React.useState<AppFormViewTab | null>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const searchAreaRef = React.useRef<HTMLDivElement>(null)
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [detailMode, setDetailMode] = React.useState<'view' | 'edit'>('view')
  const [linkedRecord, setLinkedRecord] = React.useState<{ formName: string; recordId: string } | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [refreshTick, setRefreshTick] = React.useState(0)
  const [transfer, setTransfer] = React.useState<'import' | 'export' | 'selected' | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [deleteIds, setDeleteIds] = React.useState<string[] | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [isSavingViews, setIsSavingViews] = React.useState(false)

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
        setActiveViewId((current) =>
          loadedForm.viewTabs.some((view) => view.id === current) ? current : (loadedForm.viewTabs[0]?.id ?? ''))
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

  // 切换表单时清空全部共享状态；首次进入打开第一个视图
  React.useEffect(() => {
    setSelected([])
    setDetailId(null)
    setDetailMode('view')
    setLinkedRecord(null)
    setFormOpen(false)
    setQ('')
    setAdvancedQuery(null)
    setQueryOpen(false)
    setActiveViewId('')
    setDebouncedQ('')
    setRefreshTick((tick) => tick + 1)
  }, [appId, resolvedFormName])

  const activeView = form?.viewTabs.find((view) => view.id === activeViewId) ?? form?.viewTabs[0] ?? null
  const availableFilterFields = form?.fields.filter((field) => !field.builtin) ?? []
  const advancedFilter = React.useMemo<AppFormViewFilter | null>(() => {
    if (!advancedQuery?.filter) return null
    try {
      return JSON.parse(advancedQuery.filter) as AppFormViewFilter
    } catch {
      return null
    }
  }, [advancedQuery])

  const refresh = () => setRefreshTick((tick) => tick + 1)
  const openLinkedRecord = (formName: string, recordId: string) => setLinkedRecord({formName, recordId})
  const openRecordDetail = (recordId: string, mode: 'view' | 'edit' = 'view') => {
    setDetailId(recordId)
    setDetailMode(mode)
  }

  const selectView = (viewId: string) => {
    if (viewId === activeViewId) return
    setActiveViewId(viewId)
    setSelected([])
    setDetailId(null)
    setDetailMode('view')
  }

  const saveViews = async (viewTabs: AppFormViewTab[]): Promise<AppForm | null> => {
    setIsSavingViews(true)
    try {
      const updatedForm = await patchAppFormViewTabs(appId, resolvedFormName, viewTabs)
      setForm(updatedForm)
      return updatedForm
    } catch (caught: unknown) {
      message.error(toErrorMessage(caught, '保存视图失败'))
      return null
    } finally {
      setIsSavingViews(false)
    }
  }

  const createView = (type: AppViewType) => setSettingsTarget({view: null, createType: type})

  const editView = (view: AppFormViewTab) => {
    if (view.id !== activeViewId) setActiveViewId(view.id)
    setSettingsTarget({view, createType: null})
  }

  const duplicateView = async (view: AppFormViewTab) => {
    if (!form) return
    const labels = new Set(form.viewTabs.map((item) => item.label))
    let label = `${view.label}副本`
    let index = 2
    while (labels.has(label)) {
      label = `${view.label}副本${index}`
      index++
    }
    const sourceIndex = form.viewTabs.findIndex((item) => item.id === view.id)
    const copy: AppFormViewTab = {
      ...view,
      id: crypto.randomUUID(),
      label,
      config: {...view.config},
      displayFields: [...view.displayFields],
    }
    const nextTabs = [...form.viewTabs]
    nextTabs.splice(sourceIndex + 1, 0, copy)
    const updated = await saveViews(nextTabs)
    if (updated) {
      message.success('视图已复制')
      setActiveViewId(copy.id)
    }
  }

  const deleteView = async (view: AppFormViewTab) => {
    if (!form) return
    const nextTabs = form.viewTabs.filter((item) => item.id !== view.id)
    const updated = await saveViews(nextTabs)
    setDeleteViewTarget(null)
    if (updated) {
      message.success('视图已删除')
      if (activeViewId === view.id) setActiveViewId(updated.viewTabs[0]?.id ?? '')
    }
  }

  const reorderViews = async (viewId: string, targetIndex: number) => {
    if (!form) return
    const from = form.viewTabs.findIndex((view) => view.id === viewId)
    if (from < 0) return
    const nextTabs = [...form.viewTabs]
    const [moved] = nextTabs.splice(from, 1)
    const insertAt = Math.max(0, Math.min(targetIndex, nextTabs.length))
    nextTabs.splice(insertAt, 0, moved)
    if (nextTabs.every((view, index) => view.id === form.viewTabs[index]?.id)) return
    await saveViews(nextTabs)
  }

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
      refresh()
    } catch (caught: unknown) {
      setDeleteError(toErrorMessage(caught, '删除记录失败'))
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  if (!form || !activeView) {
    return (
      <AppLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          {error ?? '未知表单'}
        </div>
      </AppLayout>
    )
  }

  const isTableView = activeView.type === 'TABLE'

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
                  onChange={(event) => setQ(event.target.value)}
                  className="h-8 w-[160px]"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setQ('')
                      setSearchOpen(false)
                    }
                  }}
                />
              )}
              <Popover open={queryOpen} onOpenChange={setQueryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    aria-pressed={Boolean(advancedQuery)}
                    data-active={Boolean(advancedQuery)}
                    title="高级查询"
                    aria-label="高级查询"
                  >
                    <Filter className={cn('h-4 w-4', advancedQuery && 'text-primary')}/>
                  </Button>
                </PopoverTrigger>
                <RecordQueryPopover
                  open={queryOpen} onOpenChange={setQueryOpen}
                  fields={availableFilterFields} value={advancedQuery} onApply={(value) => {
                  setAdvancedQuery(value)
                  setSelected([])
                }}/>
              </Popover>
            </div>
            <Button size="sm" className={compactButtonClass} onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4"/> 新建
            </Button>
            <Button variant="secondary" size="sm" className={compactButtonClass} disabled={form.builtin}
                    onClick={() => setTransfer('import')}>
              <FileInput className="h-4 w-4"/> 导入
            </Button>
            <Button variant="secondary" size="sm" className={compactButtonClass} disabled={form.builtin}
                    onClick={() => setTransfer('export')}>
              <FileSpreadsheet className="h-4 w-4"/> 导出
            </Button>
          </div>
        </div>

        {advancedQuery && (
          <div className="flex items-center gap-2 border-b bg-primary/5 px-4 py-2 text-xs">
            <button className="text-primary hover:underline" onClick={() => setQueryOpen(true)}>
              已启用高级查询：{advancedQuery.conditions.length} 个条件（{advancedQuery.logic === '_and' ? '全部满足' : '任一满足'}）
            </button>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
              setAdvancedQuery(null)
              setSelected([])
            }}>清空查询</Button>
          </div>
        )}

        <div className="flex items-end justify-between gap-2 border-b px-3">
          <div className="min-w-0 flex-1 overflow-hidden">
            <ViewBar
              form={form}
              activeViewId={activeView.id}
              onSelect={selectView}
              onReorder={(viewId, targetIndex) => void reorderViews(viewId, targetIndex)}
              onCreate={createView}
              onEdit={editView}
              onDuplicate={(view) => void duplicateView(view)}
              onDelete={setDeleteViewTarget}
            />
          </div>
          <div className="mb-1 flex shrink-0 items-center gap-1">
            <span className="block h-5 w-px shrink-0 bg-muted-foreground/40" aria-hidden="true"/>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="刷新"
              aria-label="刷新"
              onClick={refresh}
            >
              <RefreshCw className="h-4 w-4"/>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="设置当前视图"
              aria-label="设置当前视图"
              onClick={() => setSettingsTarget({view: activeView, createType: null})}
            >
              <Settings className="h-4 w-4"/>
            </Button>
          </div>
        </div>

        {isTableView && (
          <div
            className={cn(
              'overflow-hidden border-b bg-card transition-[max-height,opacity] duration-200',
              selected.length ? 'max-h-14 opacity-100' : 'max-h-0 opacity-0',
            )}
          >
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="text-sm text-muted-foreground">共选择 {selected.length} 条数据</span>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="secondary" size="sm" className={compactButtonClass}
                  disabled={selected.length !== 1}
                  onClick={() => openRecordDetail(selected[0], 'edit')}
                >
                  <Edit className="h-4 w-4"/> 编辑
                </Button>
                <Button
                  variant="secondary" size="sm" className={compactButtonClass}
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
                <Button variant="secondary" size="sm" className={compactButtonClass} disabled={form.builtin}
                        onClick={() => setTransfer('selected')}>
                  <FileSpreadsheet className="h-4 w-4"/> 导出
                </Button>
                <Button variant="secondary" size="sm" className={compactButtonClass}>
                  <ListChecks className="h-4 w-4"/> 批量编辑
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col p-3">
          {error && (
            <div className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}
          {isLoading ? (
            <AppLoading center className="min-h-[240px]"/>
          ) : (
            <ViewRenderer
              key={activeView.id}
              appId={appId}
              form={form}
              view={activeView}
              search={debouncedQ}
              advancedFilter={advancedFilter}
              refreshTick={refreshTick}
              onRecordChanged={refresh}
              selected={selected}
              onSelectedChange={setSelected}
              onOpenRecord={openRecordDetail}
              onOpenLinkedRecord={openLinkedRecord}
              onRequestDelete={requestDeleteRecord}
            />
          )}
        </div>
      </div>

      {transfer && (
        <AppTransferDialog
          key={`${appId}:${resolvedFormName}:${transfer}`}
          appId={appId} currentForm={form}
          mode={transfer} selectedIds={selected} query={{
          search: debouncedQ, viewTabId: activeView.id, filter: advancedQuery?.filter,
        }}
          onClose={() => setTransfer(null)} onImported={() => {
          setSelected([])
          refresh()
        }}/>
      )}

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

      <ConfirmDialog
        open={Boolean(deleteViewTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteViewTarget(null)
        }}
        title="删除视图"
        message={`确认删除视图「${deleteViewTarget?.label}」吗？删除后不可恢复。`}
        busy={isSavingViews}
        confirmText="删除"
        onConfirm={() => deleteViewTarget && void deleteView(deleteViewTarget)}
      />

      {settingsTarget && (
        <ViewSettingsDrawer
          open
          onOpenChange={(open) => {
            if (!open) setSettingsTarget(null)
          }}
          appId={appId}
          form={form}
          target={settingsTarget}
          onSaved={(updatedForm, viewId) => {
            setForm(updatedForm)
            setActiveViewId(viewId)
            setSelected([])
            refresh()
          }}
        />
      )}
    </AppLayout>
  )
}

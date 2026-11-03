import {Popover, PopoverTrigger} from '@/components/ui/popover'
import {type RecordQuery, RecordQueryPopover} from '@/components/biz/RecordQueryPopover'
import * as React from 'react'
import {Edit, FileInput, FileSpreadsheet, Filter, Plus, RefreshCw, Settings, Trash2, X,} from 'lucide-react'
import {useParams} from 'react-router-dom'
import {AppLayout} from '@/components/layout/AppLayout'
import {AppLoading} from '@/components/biz/AppLoading'
import {Button} from '@/components/ui/button'
import {ConfirmDialog} from '@/components/ui/dialog'
import {Empty} from '@/components/ui/empty'
import {message} from '@/components/ui/message'
import {AppRecordDrawer} from '@/components/biz/AppRecordDrawer'
import {AppTransferDialog} from '@/components/biz/AppTransferDialog'
import {SearchInput} from '@/components/biz/SearchInput'
import {ViewBar} from '@/components/biz/views/ViewBar'
import {ViewFetchingProvider} from '@/components/biz/views/viewFetching'
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

function FilterChip({children, onOpen, onRemove, removeLabel}: {
  children: React.ReactNode
  onOpen?: () => void
  onRemove?: () => void
  removeLabel?: string
}) {
  return (
    <span className="inline-flex max-w-full items-center overflow-hidden rounded-full border bg-card text-xs">
      <button
        type="button"
        className="inline-flex min-w-0 items-center gap-1 px-2.5 py-1 text-foreground transition-colors hover:bg-accent disabled:cursor-default"
        onClick={onOpen}
        disabled={!onOpen}
      >
        <Filter className="h-3 w-3 shrink-0 text-muted-foreground"/>
        <span className="truncate">{children}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          className="inline-flex h-full items-center px-1.5 py-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label={removeLabel ?? '清除筛选'}
          onClick={onRemove}
        >
          <X className="h-3 w-3"/>
        </button>
      )}
    </span>
  )
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
  const [formError, setFormError] = React.useState<string | null>(null)
  const [formReloadTick, setFormReloadTick] = React.useState(0)
  const [queryOpen, setQueryOpen] = React.useState(false)
  const [advancedQuery, setAdvancedQuery] = React.useState<RecordQuery | null>(null)
  const [q, setQ] = React.useState('')
  const [debouncedQ, setDebouncedQ] = React.useState('')
  const [selected, setSelected] = React.useState<string[]>([])
  const [activeViewId, setActiveViewId] = React.useState('')
  const [settingsTarget, setSettingsTarget] = React.useState<ViewSettingsTarget | null>(null)
  const [deleteViewTarget, setDeleteViewTarget] = React.useState<AppFormViewTab | null>(null)
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [detailMode, setDetailMode] = React.useState<'view' | 'edit'>('view')
  const [linkedRecord, setLinkedRecord] = React.useState<{ formName: string; recordId: string } | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [refreshTick, setRefreshTick] = React.useState(0)
  const [transfer, setTransfer] = React.useState<'import' | 'export' | 'selected' | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteIds, setDeleteIds] = React.useState<string[] | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [isSavingViews, setIsSavingViews] = React.useState(false)
  const [isViewFetching, setIsViewFetching] = React.useState(false)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [q])

  React.useEffect(() => {
    if (!appId || !resolvedFormName) {
      setForm(null)
      setIsLoading(false)
      setFormError('未知表单')
      return
    }
    let cancelled = false
    setIsLoading(true)
    setFormError(null)
    setForm(null)
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
        setFormError(toErrorMessage(caught, '加载表单失败'))
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, resolvedFormName, formReloadTick])

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

  // 关键词或临时查询变化后，旧的勾选可能已经不在当前结果里，直接清空避免误操作。
  React.useEffect(() => {
    setSelected([])
    setDetailId(null)
  }, [debouncedQ, advancedQuery])

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
  const advancedConditionCount = advancedQuery?.conditions.length ?? 0
  const hasTemporaryQuery = Boolean(debouncedQ || advancedQuery)

  const refresh = () => setRefreshTick((tick) => tick + 1)
  const openLinkedRecord = (targetFormName: string, recordId: string) =>
    setLinkedRecord({formName: targetFormName, recordId})
  const openRecordDetail = (recordId: string, mode: 'view' | 'edit' = 'view') => {
    setDetailId(recordId)
    setDetailMode(mode)
  }
  const createRecord = () => setFormOpen(true)
  const clearFilters = () => {
    setQ('')
    setDebouncedQ('')
    setAdvancedQuery(null)
    setSelected([])
  }
  const openViewSettings = () => {
    if (activeView) setSettingsTarget({view: activeView, createType: null})
  }

  const selectView = (viewId: string) => {
    if (viewId === activeViewId) return
    setActiveViewId(viewId)
    setSelected([])
    setDetailId(null)
    setDetailMode('view')
    setQueryOpen(false)
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

  const duplicateView = async (view: AppFormViewTab) => {
    if (!form || isSavingViews) return
    if (form.viewTabs.length >= 20) {
      message.error('视图数量已达上限（20 个）')
      return
    }
    const labels = new Set(form.viewTabs.map((item) => item.label))
    const base = `${view.label}副本`
    let label = base
    let index = 2
    while (labels.has(label)) {
      label = `${base}${index}`
      index++
    }
    const sourceIndex = form.viewTabs.findIndex((item) => item.id === view.id)
    const copy: AppFormViewTab = {
      ...view,
      id: crypto.randomUUID(),
      label,
      filter: view.filter ? JSON.parse(JSON.stringify(view.filter)) as AppFormViewFilter : null,
      sort: view.sort ? {...view.sort} : null,
      config: {...view.config},
      displayFields: [...view.displayFields],
    }
    const nextTabs = [...form.viewTabs]
    nextTabs.splice(sourceIndex + 1, 0, copy)
    const updated = await saveViews(nextTabs)
    if (updated) {
      message.success('视图已复制')
      setActiveViewId(copy.id)
      setSelected([])
      setDetailId(null)
    }
  }

  const renameView = async (view: AppFormViewTab, label: string): Promise<boolean> => {
    if (!form || isSavingViews) return false
    const nextTabs = form.viewTabs.map((item) => (item.id === view.id ? {...item, label} : item))
    const updated = await saveViews(nextTabs)
    return Boolean(updated)
  }

  const deleteView = async (view: AppFormViewTab) => {
    if (!form || isSavingViews) return
    if (form.viewTabs.length <= 1) {
      message.error('至少需要保留一个视图')
      setDeleteViewTarget(null)
      return
    }
    const index = form.viewTabs.findIndex((item) => item.id === view.id)
    const nextTabs = form.viewTabs.filter((item) => item.id !== view.id)
    const updated = await saveViews(nextTabs)
    setDeleteViewTarget(null)
    if (updated) {
      message.success('视图已删除')
      if (activeViewId === view.id) {
        const fallback = updated.viewTabs[Math.max(0, index - 1)] ?? updated.viewTabs[0]
        setActiveViewId(fallback?.id ?? '')
      }
    }
  }

  const reorderViews = async (viewId: string, targetIndex: number) => {
    if (!form || isSavingViews) return
    const from = form.viewTabs.findIndex((view) => view.id === viewId)
    if (from < 0) return
    const nextTabs = [...form.viewTabs]
    const [moved] = nextTabs.splice(from, 1)
    const insertAt = Math.max(0, Math.min(targetIndex, nextTabs.length))
    nextTabs.splice(insertAt, 0, moved)
    if (nextTabs.every((view, index) => view.id === form.viewTabs[index]?.id)) return
    const snapshot = form
    setForm({...form, viewTabs: nextTabs})
    setIsSavingViews(true)
    try {
      const updated = await patchAppFormViewTabs(appId, resolvedFormName, nextTabs)
      setForm(updated)
    } catch (caught: unknown) {
      setForm(snapshot)
      message.error(toErrorMessage(caught, '调整视图顺序失败'))
    } finally {
      setIsSavingViews(false)
    }
  }

  const saveAdvancedAsViewFilter = async () => {
    if (!form || !activeView || !advancedFilter || isSavingViews) return
    const nextTabs = form.viewTabs.map((view) =>
      view.id === activeView.id ? {...view, filter: advancedFilter} : view)
    const updated = await saveViews(nextTabs)
    if (updated) {
      setAdvancedQuery(null)
      message.success('已保存为当前视图筛选')
    }
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
    }
  }

  if (!form) {
    return (
      <AppLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
        <div className="flex min-h-[240px] items-center justify-center rounded-xl border bg-card p-6">
          {isLoading ? <AppLoading center/> : (
            <div className="space-y-3 text-center">
              <p className="text-sm text-destructive" role="alert">{formError ?? '未知表单'}</p>
              <Button variant="secondary" size="sm" onClick={() => setFormReloadTick((tick) => tick + 1)}>
                <RefreshCw className="h-4 w-4"/>重新加载
              </Button>
            </div>
          )}
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
      <div
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2 pt-2">
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <h1 className="shrink-0 truncate text-lg font-semibold">{form.label}</h1>
            {form.description && (
              <p className="hidden min-w-0 truncate text-xs text-muted-foreground sm:block" title={form.description}>
                {form.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <SearchInput
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onClear={() => {
                setQ('')
                setDebouncedQ('')
              }}
              placeholder={`搜索${form.label}`}
              className="w-[180px] [&_input]:h-8 sm:w-[220px]"
            />
            <Popover open={queryOpen} onOpenChange={setQueryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8 text-muted-foreground"
                  aria-pressed={Boolean(advancedQuery)}
                  aria-label="高级查询"
                  title="高级查询"
                >
                  <Filter className={cn('h-4 w-4', advancedQuery && 'text-primary')}/>
                  {advancedConditionCount > 0 && (
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground">
                      {advancedConditionCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <RecordQueryPopover
                open={queryOpen} onOpenChange={setQueryOpen}
                fields={availableFilterFields} value={advancedQuery} onApply={(value) => {
                setAdvancedQuery(value)
                setSelected([])
              }}/>
            </Popover>
            <Button size="sm" className={compactButtonClass} onClick={createRecord}>
              <Plus className="h-4 w-4"/> 新建
            </Button>
            <Button variant="secondary" size="sm" className={compactButtonClass} disabled={form.builtin}
                    title={form.builtin ? '系统内置表单不支持导入' : undefined}
                    onClick={() => setTransfer('import')}>
              <FileInput className="h-4 w-4"/> 导入
            </Button>
            <Button variant="secondary" size="sm" className={compactButtonClass} disabled={form.builtin}
                    title={form.builtin ? '系统内置表单不支持导出' : undefined}
                    onClick={() => setTransfer('export')}>
              <FileSpreadsheet className="h-4 w-4"/> 导出
            </Button>
          </div>
        </div>

        {hasTemporaryQuery && (
          <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted/20 px-3 py-1.5 text-xs">
            {debouncedQ && (
              <FilterChip
                onRemove={() => {
                  setQ('')
                  setDebouncedQ('')
                }}
                removeLabel="清除搜索"
              >
                搜索：{debouncedQ}
              </FilterChip>
            )}
            {advancedQuery && (
              <FilterChip
                onOpen={() => setQueryOpen(true)}
                onRemove={() => setAdvancedQuery(null)}
                removeLabel="清除高级查询"
              >
                已启用高级查询：{advancedConditionCount} 个条件（{advancedQuery.logic === '_and' ? '全部满足' : '任一满足'}）
              </FilterChip>
            )}
            {hasTemporaryQuery && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={clearFilters}>
                清空临时筛选
              </Button>
            )}
            {advancedQuery && activeView && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary"
                disabled={isSavingViews}
                onClick={() => void saveAdvancedAsViewFilter()}
              >
                保存为视图筛选
              </Button>
            )}
          </div>
        )}

        <div className="flex items-end justify-between gap-2 border-b px-3">
          <div className="min-w-0 flex-1 overflow-hidden">
            <ViewBar
              form={form}
              activeViewId={activeView?.id ?? ''}
              saving={isSavingViews}
              onSelect={selectView}
              onReorder={(viewId, targetIndex) => void reorderViews(viewId, targetIndex)}
              onCreate={createView}
              onRename={renameView}
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
              title={isViewFetching ? '正在刷新…' : '刷新'}
              aria-label="刷新"
              aria-busy={isViewFetching}
              onClick={refresh}
            >
              <RefreshCw className={cn('h-4 w-4', isViewFetching && 'animate-spin')}/>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="设置当前视图"
              aria-label="设置当前视图"
              disabled={!activeView}
              onClick={openViewSettings}
            >
              <Settings className="h-4 w-4"/>
            </Button>
          </div>
        </div>

        {activeView?.type === 'TABLE' && (
          <div
            className={cn(
              'overflow-hidden bg-card transition-[max-height,opacity] duration-200',
              selected.length ? 'max-h-14 border-b opacity-100' : 'max-h-0 opacity-0',
            )}
          >
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="text-sm text-muted-foreground">本页已选 {selected.length} 条数据</span>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="secondary" size="sm" className={compactButtonClass}
                  disabled={selected.length !== 1}
                  onClick={() => selected[0] && openRecordDetail(selected[0], 'edit')}
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
                <Button
                  variant="secondary" size="sm" className={compactButtonClass}
                  disabled={form.builtin || !selected.length}
                  title={form.builtin ? '系统内置表单不支持导出' : undefined}
                  onClick={() => setTransfer('selected')}
                >
                  <FileSpreadsheet className="h-4 w-4"/> 导出选中
                </Button>
                <Button variant="ghost" size="sm" className={compactButtonClass} onClick={() => setSelected([])}>
                  清空选择
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col p-3">
          <ViewFetchingProvider onFetchingChange={setIsViewFetching}>
            {activeView ? (
              <ViewRenderer
                key={activeView.id}
                appId={appId}
                form={form}
                view={activeView}
                search={debouncedQ}
                advancedFilter={advancedFilter}
                refreshTick={refreshTick}
                onRecordChanged={refresh}
                onOpenViewSettings={openViewSettings}
                selected={selected}
                onSelectedChange={setSelected}
                onOpenRecord={openRecordDetail}
                onOpenLinkedRecord={openLinkedRecord}
                onRequestDelete={requestDeleteRecord}
              />
            ) : (
              <Empty
                description="当前表单还没有视图，请先创建一个视图再查看记录。"
                className="flex-1"
              >
                <Button onClick={() => setSettingsTarget({view: null, createType: 'TABLE'})}>
                  <Plus className="h-4 w-4"/>新建表格视图
                </Button>
              </Empty>
            )}
          </ViewFetchingProvider>
        </div>
      </div>

      {transfer && activeView && (
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
            setDetailId(null)
            refresh()
          }}
        />
      )}
    </AppLayout>
  )
}

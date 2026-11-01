import * as React from 'react'
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {Button} from '@/components/ui/button'
import {Empty} from '@/components/ui/empty'
import {message} from '@/components/ui/message'
import {AppLoading} from '@/components/biz/AppLoading'
import {useViewQuery} from '@/components/biz/views/useViewQuery'
import {type ViewComponentProps, viewDisplayFields, viewTitleValue} from '@/components/biz/views/types'
import {type AppViewGroup, moveAppViewRecord} from '@/services/appViews'
import type {AppForm, AppFormField, AppFormViewFilter, AppFormViewTab} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import {formatFieldValue} from '@/lib/fieldConfig'
import {cn, toErrorMessage} from '@/lib/utils'

/** REFERENCE 等投影对象取原始 id，BOOL/选项保持原值。 */
function rawGroupValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in value) {
    return (value as { id: unknown }).id
  }
  return value
}

function groupKey(group: AppViewGroup): string {
  return group.empty ? 'ungrouped' : `group-${JSON.stringify(group.value ?? null)}`
}

function summaryText(field: AppFormField, record: AppRecord): string {
  const value = record[field.name]
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const display = (value as { displayValue?: unknown }).displayValue
    if (display !== undefined && display !== null) return String(display)
  }
  return formatFieldValue(field, value)
}

interface KanbanCardProps {
  form: AppForm
  view: AppFormViewTab
  record: AppRecord
  summaryFields: AppFormField[]
  dragDisabled: boolean
  isActive: boolean
  onOpenRecord: (recordId: string) => void
}

function KanbanCard({form, view, record, summaryFields, dragDisabled, isActive, onOpenRecord}: KanbanCardProps) {
  const recordId = String(record.id)
  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id: recordId,
    disabled: dragDisabled,
    data: {record},
  })
  const suppressClickRef = React.useRef(false)
  React.useEffect(() => {
    if (isDragging) suppressClickRef.current = true
  }, [isDragging])

  const cardListeners = dragDisabled || !listeners ? undefined : {
    ...listeners,
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      suppressClickRef.current = false
      listeners.onPointerDown?.(event)
    },
  }

  const openRecord = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    onOpenRecord(recordId)
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...cardListeners}
      className={cn(
        'rounded-lg border bg-card p-2.5 text-sm shadow-sm hover:shadow-md',
        !dragDisabled && 'cursor-grab',
        (isDragging || isActive) && 'opacity-50',
      )}
    >
      <button type="button" className="block w-full truncate text-left font-medium hover:text-primary"
              onClick={openRecord}>
        {viewTitleValue(form, view, record)}
      </button>
      {summaryFields.length > 0 && (
        <div className="mt-1.5 space-y-1 text-xs">
          {summaryFields.map((field) => (
            <div key={field.name} className="flex gap-1">
              <span className="shrink-0 text-muted-foreground">{field.label}:</span>
              <span className="min-w-0 flex-1 truncate">{summaryText(field, record)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface KanbanColumnProps {
  appId: string
  form: AppForm
  view: AppFormViewTab
  group: AppViewGroup
  columnId: string
  search: string
  advancedFilter: AppFormViewFilter | null
  reloadKey: string
  dragDisabled: boolean
  activeId: string | null
  summaryFields: AppFormField[]
  onOpenRecord: (recordId: string) => void
}

function KanbanColumn({
                        appId,
                        form,
                        view,
                        group,
                        columnId,
                        search,
                        advancedFilter,
                        reloadKey,
                        dragDisabled,
                        activeId,
                        summaryFields,
                        onOpenRecord,
                      }: KanbanColumnProps) {
  const [page, setPage] = React.useState(1)
  const [loaded, setLoaded] = React.useState<AppRecord[]>([])
  const conditionKey = `${reloadKey}|${search}|${JSON.stringify(advancedFilter ?? null)}`
  const conditionRef = React.useRef(conditionKey)
  const {setNodeRef, isOver} = useDroppable({id: columnId})

  const query = useViewQuery(appId, form.name, view.id, {
    scope: 'GROUP_RECORDS',
    groupValue: group.empty ? undefined : group.value,
    groupEmpty: group.empty,
    page,
    size: 30,
    search,
    filter: advancedFilter,
  }, conditionKey)

  React.useEffect(() => {
    if (conditionRef.current === conditionKey) return
    conditionRef.current = conditionKey
    setPage(1)
    setLoaded([])
  }, [conditionKey])

  React.useEffect(() => {
    const data = query.data
    if (!data) return
    setLoaded((previous) => {
      if (page === 1) return data.list
      const seen = new Set(previous.map((item) => String(item.id)))
      return [...previous, ...data.list.filter((item) => !seen.has(String(item.id)))]
    })
  }, [query.data, page])

  const total = query.data?.total ?? 0
  const hasMore = loaded.length < total
  const showingList = !(query.isLoading && page === 1)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full w-72 shrink-0 flex-col rounded-lg border bg-muted/30',
        isOver && !dragDisabled && 'border-primary/50',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className={cn('inline-block h-2 w-2 shrink-0 rounded-full', !group.color && 'bg-muted-foreground/40')}
          style={group.color ? {backgroundColor: group.color} : undefined}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{group.label}</span>
        <span className="text-xs text-muted-foreground">{group.total}</span>
      </div>
      <div className="record-list-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {!showingList ? (
          <AppLoading center className="min-h-[120px]"/>
        ) : query.error ? (
          <div className="px-1 py-2 text-xs text-destructive">{query.error}</div>
        ) : loaded.length === 0 ? (
          <div className="px-1 py-2 text-xs text-muted-foreground">暂无记录</div>
        ) : (
          loaded.map((record) => (
            <KanbanCard
              key={String(record.id)}
              form={form}
              view={view}
              record={record}
              summaryFields={summaryFields}
              dragDisabled={dragDisabled}
              isActive={activeId === String(record.id)}
              onOpenRecord={onOpenRecord}
            />
          ))
        )}
      </div>
      {hasMore && !query.error && (
        <Button
          variant="ghost"
          size="sm"
          className="m-1 mt-0 h-7 text-xs text-muted-foreground"
          disabled={query.isLoading}
          onClick={() => setPage(page + 1)}
        >
          {query.isLoading ? '加载中…' : `加载更多（${loaded.length}/${total}）`}
        </Button>
      )}
    </div>
  )
}

/** 看板视图：按分组列展示记录，支持跨列拖拽更新分组字段。 */
export function KanbanView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick, onOpenRecord, onRecordChanged} = props
  const groupField = view.config.groupField ?? null
  const [moveTick, setMoveTick] = React.useState(0)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [isMoving, setIsMoving] = React.useState(false)
  const isMovingRef = React.useRef(false)
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}))
  const reloadKey = `${refreshTick}:${moveTick}`

  const groupsQuery = useViewQuery(appId, form.name, view.id, {
    scope: 'GROUPS',
    search,
    filter: advancedFilter,
  }, reloadKey)
  const groups = groupsQuery.data?.groups ?? []
  const movable = groupsQuery.data?.movable ?? false
  const draggable = Boolean(groupField) && movable
  const dragDisabled = !draggable || isMoving
  const dragHint = !groupField
    ? '视图尚未配置分组字段，暂不支持拖拽'
    : movable
      ? null
      : (groupsQuery.data?.disabledReason ?? '当前视图暂不支持拖拽')

  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const titleField = view.config.titleField || form.displayField || 'id'
  const summaryFields = viewDisplayFields(form, view)
    .filter((name) => name !== groupField && name !== titleField)
    .map((name) => fieldMap.get(name))
    .filter((field): field is AppFormField => Boolean(field))
    .slice(0, 4)
  const columnGroupMap = new Map(groups.map((group) => [groupKey(group), group]))

  const handleDragStart = (event: DragStartEvent) => {
    if (isMovingRef.current) return
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    if (!groupField || isMovingRef.current) return
    const over = event.over
    if (!over) return
    const targetGroup = columnGroupMap.get(String(over.id))
    const record = (event.active.data.current as { record?: AppRecord } | undefined)?.record
    if (!targetGroup || !record) return
    const rawFrom = rawGroupValue(record[groupField])
    const rawTo = targetGroup.empty ? null : targetGroup.value
    if (rawFrom === rawTo) return
    isMovingRef.current = true
    setIsMoving(true)
    try {
      await moveAppViewRecord(appId, form.name, view.id, String(record.id), {
        changes: {[groupField]: {from: rawFrom, to: rawTo}},
      })
      message.success('已移动')
      onRecordChanged()
    } catch (caught) {
      message.error(toErrorMessage(caught, '移动失败'))
      setMoveTick((tick) => tick + 1)
    } finally {
      isMovingRef.current = false
      setIsMoving(false)
    }
  }

  if (groupsQuery.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <AppLoading center className="min-h-[240px]"/>
      </div>
    )
  }

  if (groupsQuery.error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-1 py-6 text-sm text-destructive">{groupsQuery.error}</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {dragHint && <div className="pb-2 text-xs text-muted-foreground">{dragHint}</div>}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="record-list-scroll flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
          {groups.length === 0 && <Empty description="暂无分组"/>}
          {groups.map((group) => {
            const key = groupKey(group)
            return (
              <KanbanColumn
                key={key}
                appId={appId}
                form={form}
                view={view}
                group={group}
                columnId={key}
                search={search}
                advancedFilter={advancedFilter}
                reloadKey={reloadKey}
                dragDisabled={dragDisabled}
                activeId={activeId}
                summaryFields={summaryFields}
                onOpenRecord={onOpenRecord}
              />
            )
          })}
        </div>
      </DndContext>
    </div>
  )
}

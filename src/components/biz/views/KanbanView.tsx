import * as React from 'react'
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
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
import {
  groupKeyForRecord,
  groupKeyForValue,
  layoutFieldLabel,
  rawGroupValue,
  recordFieldText,
} from '@/components/biz/views/viewUtils'
import {ViewErrorState, ViewFetchingBar, ViewInlineError, ViewSkeleton} from '@/components/biz/views/viewFeedback'
import {type AppViewGroup, moveAppViewRecord} from '@/services/appViews'
import type {AppForm, AppFormField, AppFormViewFilter, AppFormViewTab} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import {cn, toErrorMessage} from '@/lib/utils'

function groupKey(group: AppViewGroup): string {
  return group.empty ? 'ungrouped' : groupKeyForValue(group.value)
}

interface MoveEvent {
  record: AppRecord
  recordId: string
  fromKey: string
  toKey: string
  sequence: number
  pending: boolean
}

function KanbanCard({
                      form,
                      view,
                      record,
                      summaryFields,
                      dragDisabled,
                      onOpen,
                    }: {
  form: AppForm
  view: AppFormViewTab
  record: AppRecord
  summaryFields: AppFormField[]
  dragDisabled: boolean
  onOpen: () => void
}) {
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
    onOpen()
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...cardListeners}
      role="button"
      tabIndex={0}
      onClick={openRecord}
      data-kanban-record={recordId}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'rounded-lg border bg-card p-2.5 text-sm shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !dragDisabled && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <div className="truncate text-left font-medium hover:text-primary">
        {viewTitleValue(form, view, record)}
      </div>
      {summaryFields.length > 0 && (
        <div className="mt-1.5 space-y-1 text-xs">
          {summaryFields.map((field) => (
            <div key={field.name} className="flex gap-1">
              <span className="shrink-0 text-muted-foreground">
                {layoutFieldLabel(form, field.name, field.label)}:
              </span>
              <span className="min-w-0 flex-1 truncate">{recordFieldText(field, record[field.name])}</span>
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
  groupField: string
  search: string
  advancedFilter: AppFormViewFilter | null
  reloadKey: string
  dragDisabled: boolean
  summaryFields: AppFormField[]
  moveEvent: MoveEvent | null
  onOpenRecord: (recordId: string) => void
}

function KanbanColumn({
                        appId,
                        form,
                        view,
                        group,
                        columnId,
                        groupField,
                        search,
                        advancedFilter,
                        reloadKey,
                        dragDisabled,
                        summaryFields,
                        moveEvent,
                        onOpenRecord,
                      }: KanbanColumnProps) {
  const [page, setPage] = React.useState(1)
  const [loaded, setLoaded] = React.useState<AppRecord[]>([])
  const conditionKey = `${view.id}|${groupField}|${search}|${JSON.stringify(advancedFilter ?? null)}`
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
  }, reloadKey)

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

  // 拖拽成功后先在本地移动卡片，等待列数据重载时不会闪回原列。
  React.useEffect(() => {
    if (!moveEvent) return
    setLoaded((previous) => {
      const without = previous.filter((record) => String(record.id) !== moveEvent.recordId)
      return moveEvent.toKey === columnId ? [moveEvent.record, ...without] : without
    })
  }, [moveEvent, columnId])

  const total = query.data?.total ?? group.total
  const hasMore = loaded.length < total
  const isInitialLoading = query.isLoading && !query.data
  const adjustedTotal = moveEvent?.pending
    ? total + (moveEvent.toKey === columnId ? 1 : 0) - (moveEvent.fromKey === columnId ? 1 : 0)
    : total

  return (
    <div
      ref={setNodeRef}
      data-kanban-column={group.label}
      className={cn(
        'flex h-full w-[min(80vw,18rem)] shrink-0 flex-col overflow-hidden rounded-lg border bg-muted/30 transition-colors',
        isOver && !dragDisabled && 'border-primary/60 ring-1 ring-primary/30',
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b bg-card/80 px-3 py-2 backdrop-blur">
        <span
          className={cn('inline-block h-2 w-2 shrink-0 rounded-full', !group.color && 'bg-muted-foreground/40')}
          style={group.color ? {backgroundColor: group.color} : undefined}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={group.label}>{group.label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{adjustedTotal}</span>
      </div>
      <div className="record-list-scroll relative min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        <ViewFetchingBar active={query.isFetching && !query.isLoading}/>
        {query.error && <ViewInlineError message={query.error} onRetry={query.reload}/>}
        {isInitialLoading ? (
          <ViewSkeleton variant="list" rows={3}/>
        ) : loaded.length === 0 ? (
          <div
            className="flex min-h-[96px] items-center justify-center rounded-lg border border-dashed px-2 text-center text-xs text-muted-foreground">
            {isOver ? '放到这里' : '暂无记录'}
          </div>
        ) : (
          loaded.map((record) => (
            <KanbanCard
              key={String(record.id)}
              form={form}
              view={view}
              record={record}
              summaryFields={summaryFields}
              dragDisabled={dragDisabled}
              onOpen={() => onOpenRecord(String(record.id))}
            />
          ))
        )}
      </div>
      {hasMore && !query.error && (
        <Button
          variant="ghost"
          size="sm"
          className="m-1 mt-0 h-7 text-xs text-muted-foreground"
          disabled={query.isFetching}
          onClick={() => setPage((current) => current + 1)}
        >
          {query.isFetching ? '加载中…' : `加载更多（${loaded.length}/${total}）`}
        </Button>
      )}
    </div>
  )
}

/** 看板视图：按分组列展示记录，支持跨列拖拽更新分组字段。 */
export function KanbanView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick, onRecordChanged, onOpenViewSettings} = props
  const groupField = view.config.groupField ?? null
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [activeRecord, setActiveRecord] = React.useState<AppRecord | null>(null)
  const [moveEvent, setMoveEvent] = React.useState<MoveEvent | null>(null)
  const [moveTick, setMoveTick] = React.useState(0)
  const [isMoving, setIsMoving] = React.useState(false)
  const isMovingRef = React.useRef(false)
  const sequenceRef = React.useRef(0)
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 6}}))
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
    ? '当前视图还没有分组字段'
    : movable
      ? null
      : (groupsQuery.data?.disabledReason ?? '当前视图不支持拖拽调整')

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
    const record = (event.active.data.current as { record?: AppRecord } | undefined)?.record
    setActiveId(String(event.active.id))
    setActiveRecord(record ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    setActiveRecord(null)
    if (!groupField || isMovingRef.current) return
    const over = event.over
    if (!over) return
    const targetGroup = columnGroupMap.get(String(over.id))
    const record = (event.active.data.current as { record?: AppRecord } | undefined)?.record
    if (!targetGroup || !record) return
    const fromKey = groupKeyForRecord(groupField, record)
    const toKey = groupKey(targetGroup)
    if (fromKey === toKey) return
    const rawFrom = rawGroupValue(record[groupField])
    const rawTo = targetGroup.empty ? null : targetGroup.value
    if (rawFrom === rawTo) return

    const sequence = ++sequenceRef.current
    const nextMove: MoveEvent = {
      record,
      recordId: String(record.id),
      fromKey,
      toKey,
      sequence,
      pending: true,
    }
    setMoveEvent(nextMove)
    isMovingRef.current = true
    setIsMoving(true)
    try {
      await moveAppViewRecord(appId, form.name, view.id, String(record.id), {
        changes: {[groupField]: {from: rawFrom, to: rawTo}},
      })
      message.success('已移动')
      setMoveEvent((previous) => previous?.sequence === sequence ? {...previous, pending: false} : previous)
      onRecordChanged()
    } catch (caught: unknown) {
      message.error(toErrorMessage(caught, '移动失败'))
      setMoveEvent({
        record,
        recordId: String(record.id),
        fromKey: toKey,
        toKey: fromKey,
        sequence: ++sequenceRef.current,
        pending: false,
      })
      setMoveTick((tick) => tick + 1)
    } finally {
      isMovingRef.current = false
      setIsMoving(false)
    }
  }

  if (!groupField) {
    return (
      <Empty className="min-h-[240px]" description="看板视图需要先选择分组字段。">
        {onOpenViewSettings && (
          <Button size="sm" onClick={onOpenViewSettings}>去设置分组字段</Button>
        )}
      </Empty>
    )
  }

  if (groupsQuery.error && !groupsQuery.data) {
    return <ViewErrorState message={groupsQuery.error} onRetry={groupsQuery.reload}/>
  }

  if (groupsQuery.isLoading && !groupsQuery.data) {
    return (
      <div className="flex min-h-0 flex-1 gap-3">
        {[0, 1, 2].map((column) => (
          <div key={column} className="w-[min(80vw,18rem)] shrink-0 rounded-lg border bg-muted/30 p-2">
            <ViewSkeleton variant="list" rows={4}/>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {(dragHint || isMoving) && (
        <div className="flex flex-wrap items-center gap-2 pb-2 text-xs text-muted-foreground">
          {isMoving ? <span className="inline-flex items-center gap-1"><AppLoading size="sm" className="min-h-0"/>正在移动…</span> : dragHint}
        </div>
      )}
      {groupsQuery.error && groupsQuery.data && (
        <ViewInlineError message={groupsQuery.error} onRetry={groupsQuery.reload}/>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null)
          setActiveRecord(null)
        }}
      >
        <div className="record-list-scroll flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
          {groups.length === 0 && <Empty description="暂无分组数据"/>}
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
                groupField={groupField}
                search={search}
                advancedFilter={advancedFilter}
                reloadKey={reloadKey}
                dragDisabled={dragDisabled}
                summaryFields={summaryFields}
                moveEvent={moveEvent}
                onOpenRecord={(recordId) => props.onOpenRecord(recordId)}
              />
            )
          })}
        </div>
        <DragOverlay>
          {activeRecord ? (
            <div className="w-[min(80vw,18rem)] rounded-lg border bg-card p-2.5 text-sm shadow-lg">
              <div className="truncate font-medium">{viewTitleValue(form, view, activeRecord)}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {activeId && activeRecord && (
        <span className="sr-only">正在拖动记录 {String(activeRecord.id)}</span>
      )}
    </div>
  )
}

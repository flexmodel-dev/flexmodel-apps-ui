import * as React from 'react'
import {CalendarClock, ChevronLeft, ChevronRight} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Empty} from '@/components/ui/empty'
import {message} from '@/components/ui/message'
import {AppLoading} from '@/components/biz/AppLoading'
import {useViewQuery} from '@/components/biz/views/useViewQuery'
import {type ViewComponentProps, viewTitleValue} from '@/components/biz/views/types'
import {type AppViewFieldChange, type AppViewMoveMode, moveAppViewRecord} from '@/services/appViews'
import type {AppViewGanttScale} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import {cn, toErrorMessage} from '@/lib/utils'

const DAY_MS = 86400000
const PAGE_SIZE = 1000
const UNSCHEDULED_SIZE = 100
const ROW_HEIGHT = 36
const BAR_HEIGHT = 20
const HEADER_ROW_HEIGHT = 24
const LIST_WIDTH = 240

const SCALE_CONFIG: Record<AppViewGanttScale, { dayWidth: number; headerRows: number; label: string }> = {
  DAY: {dayWidth: 48, headerRows: 2, label: '按日'},
  WEEK: {dayWidth: 14, headerRows: 2, label: '按周'},
  MONTH: {dayWidth: 5, headerRows: 1, label: '按月'},
}

const DATE_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

type FieldKind = 'DATE' | 'DATETIME'

interface ParsedDateValue {
  date: Date
  raw: string
}

interface ScheduledBar {
  recordId: string
  title: string
  start: ParsedDateValue
  end: ParsedDateValue
  left: number
  width: number
}

interface HeaderCell {
  label: string
  sub?: string
  left: number
  width: number
  muted?: boolean
}

interface DragState {
  recordId: string
  mode: AppViewMoveMode
  pointerX: number
  left: number
  width: number
  startRaw: string
  endRaw: string
  deltaX: number
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateTime(date: Date): string {
  return `${formatDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes(), date.getSeconds())
}

function parseDateValue(value: unknown): ParsedDateValue | null {
  if (typeof value !== 'string') return null
  const match = DATE_VALUE_PATTERN.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day, Number(match[4]) || 0, Number(match[5]) || 0, Number(match[6]) || 0)
  if (Number.isNaN(date.getTime())) return null
  return {date, raw: value}
}

function normalizeRaw(raw: string, kind: FieldKind): string {
  if (kind === 'DATE') return raw.slice(0, 10)
  const parsed = parseDateValue(raw)
  return parsed ? formatDateTime(parsed.date) : raw
}

function shiftRaw(raw: string, days: number, kind: FieldKind): string {
  const parsed = parseDateValue(raw)
  if (!parsed) return raw
  const shifted = addDays(parsed.date, days)
  return kind === 'DATE' ? formatDate(shifted) : formatDateTime(shifted)
}

function initialWindow(): { start: Date; end: Date } {
  const base = localMidnight(new Date())
  return {start: addDays(base, -30), end: addDays(base, 90)}
}

function resolveDragGeometry(drag: DragState, totalWidth: number, dayWidth: number) {
  if (drag.mode === 'MOVE') {
    const left = Math.min(Math.max(0, drag.left + drag.deltaX), Math.max(0, totalWidth - drag.width))
    return {left, width: drag.width}
  }
  if (drag.mode === 'RESIZE_START') {
    const left = Math.min(Math.max(0, drag.left + drag.deltaX), drag.left + drag.width - dayWidth)
    return {left, width: drag.left + drag.width - left}
  }
  const right = Math.max(drag.left + dayWidth, Math.min(totalWidth, drag.left + drag.width + drag.deltaX))
  return {left: drag.left, width: right - drag.left}
}

/** 甘特视图：自绘时间轴，支持窗口平移、多刻度展示与拖拽改期。 */
export function GanttView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick} = props
  const startFieldName = view.config.startField || ''
  const endFieldName = view.config.endField || ''
  const startField = form.fields.find((field) => field.name === startFieldName)
  const endField = form.fields.find((field) => field.name === endFieldName)
  const startKind: FieldKind = startField?.type === 'DATE' ? 'DATE' : 'DATETIME'
  const endKind: FieldKind = endField?.type === 'DATE' ? 'DATE' : 'DATETIME'
  const scale = view.config.ganttScale ?? 'WEEK'
  const dayWidth = SCALE_CONFIG[scale].dayWidth
  const headerHeight = SCALE_CONFIG[scale].headerRows * HEADER_ROW_HEIGHT

  const [win, setWin] = React.useState(initialWindow)
  const [unscheduledOpen, setUnscheduledOpen] = React.useState(true)
  const [isMoving, setIsMoving] = React.useState(false)
  const [moveTick, setMoveTick] = React.useState(0)
  const [drag, setDrag] = React.useState<DragState | null>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const movedRef = React.useRef(false)
  const leftScrollRef = React.useRef<HTMLDivElement | null>(null)
  const rightScrollRef = React.useRef<HTMLDivElement | null>(null)

  const reloadKey = `${refreshTick}:${moveTick}`
  const rangeQuery = useViewQuery(appId, form.name, view.id, {
    scope: 'RANGE',
    rangeStart: startKind === 'DATE' ? formatDate(win.start) : formatDateTime(win.start),
    rangeEnd: startKind === 'DATE' ? formatDate(win.end) : formatDateTime(win.end),
    page: 1,
    size: PAGE_SIZE,
    search,
    filter: advancedFilter,
  }, reloadKey)
  const unscheduledQuery = useViewQuery(appId, form.name, view.id, {
    scope: 'UNSCHEDULED',
    page: 1,
    size: UNSCHEDULED_SIZE,
    search,
    filter: advancedFilter,
  }, reloadKey)

  const movable = rangeQuery.data?.movable ?? false
  const disabledReason = rangeQuery.data?.disabledReason
  const totalDays = Math.max(1, Math.round((win.end.getTime() - win.start.getTime()) / DAY_MS)) + 1
  const totalWidth = totalDays * dayWidth

  const header = React.useMemo(() => {
    const top: HeaderCell[] = []
    const bottom: HeaderCell[] = []
    const base = win.start
    let index = 0
    while (index < totalDays) {
      const day = addDays(base, index)
      let width = dayWidth
      let step = 1
      while (index + step < totalDays) {
        const next = addDays(base, index + step)
        if (next.getFullYear() !== day.getFullYear() || next.getMonth() !== day.getMonth()) break
        width += dayWidth
        step += 1
      }
      top.push({label: `${day.getFullYear()}年${day.getMonth() + 1}月`, left: index * dayWidth, width})
      index += step
    }
    if (scale === 'DAY') {
      for (let i = 0; i < totalDays; i += 1) {
        const day = addDays(base, i)
        const weekday = day.getDay()
        bottom.push({
          label: `${day.getMonth() + 1}/${day.getDate()}`,
          sub: WEEKDAY_LABELS[weekday],
          left: i * dayWidth,
          width: dayWidth,
          muted: weekday === 0 || weekday === 6,
        })
      }
    } else if (scale === 'WEEK') {
      let first = 0
      while (first < totalDays && addDays(base, first).getDay() !== 1) first += 1
      for (let i = first; i < totalDays; i += 7) {
        const day = addDays(base, i)
        bottom.push({
          label: `${day.getMonth() + 1}/${day.getDate()}`,
          left: i * dayWidth,
          width: Math.min(7, totalDays - i) * dayWidth,
        })
      }
    }
    return {top, bottom: bottom.length ? bottom : null}
  }, [win, scale, dayWidth, totalDays])

  const scheduled = React.useMemo(() => {
    const rows: ScheduledBar[] = []
    const invalid: AppRecord[] = []
    for (const record of rangeQuery.data?.list ?? []) {
      const start = parseDateValue(record[startFieldName])
      const end = parseDateValue(record[endFieldName])
      if (record._invalidRange === true || !start || !end || end.date.getTime() < start.date.getTime()) {
        invalid.push(record)
        continue
      }
      const leftEdge = ((start.date.getTime() - win.start.getTime()) / DAY_MS) * dayWidth
      const endEdgeDate = endKind === 'DATE' ? addDays(end.date, 1) : end.date
      const rightEdge = ((endEdgeDate.getTime() - win.start.getTime()) / DAY_MS) * dayWidth
      const left = Math.max(0, leftEdge)
      const right = Math.min(totalWidth, rightEdge)
      if (right - left <= 0) continue
      rows.push({
        recordId: String(record.id),
        title: viewTitleValue(form, view, record),
        start,
        end,
        left,
        width: right - left,
      })
    }
    return {rows, invalid}
  }, [rangeQuery.data, startFieldName, endFieldName, endKind, win, dayWidth, totalWidth, form, view])

  const startFieldLabel = form.layout.items.find((item) => item.type === 'FIELD' && item.name === startFieldName)?.label?.trim()
    || form.fields.find((field) => field.name === startFieldName)?.label
    || '开始时间'
  const unscheduledList = unscheduledQuery.data?.list ?? []
  const unscheduledItems = [
    ...unscheduledList.map((record) => ({record, hint: `${startFieldLabel}未设置`, invalid: false})),
    ...scheduled.invalid.map((record) => ({record, hint: '起止日期非法', invalid: true})),
  ]
  const unscheduledTotal = (unscheduledQuery.data?.total ?? 0) + scheduled.invalid.length

  const shiftWindow = (direction: number) => {
    setWin((previous) => {
      const delta = ((previous.end.getTime() - previous.start.getTime()) / 4) * direction
      return {
        start: localMidnight(new Date(previous.start.getTime() + delta)),
        end: localMidnight(new Date(previous.end.getTime() + delta)),
      }
    })
  }

  const commitMove = (state: DragState, deltaDays: number) => {
    const startTo = state.mode === 'RESIZE_END' ? null : shiftRaw(state.startRaw, deltaDays, startKind)
    const endTo = state.mode === 'RESIZE_START' ? null : shiftRaw(state.endRaw, deltaDays, endKind)
    const nextStart = parseDateValue(startTo ?? state.startRaw)
    const nextEnd = parseDateValue(endTo ?? state.endRaw)
    if (!nextStart || !nextEnd || nextStart.date.getTime() > nextEnd.date.getTime()) {
      setIsMoving(false)
      message.error('开始时间不能晚于结束时间')
      return
    }
    const changes: Record<string, AppViewFieldChange> = {}
    if (startTo) changes[startFieldName] = {from: normalizeRaw(state.startRaw, startKind), to: startTo}
    if (endTo) changes[endFieldName] = {from: normalizeRaw(state.endRaw, endKind), to: endTo}
    moveAppViewRecord(appId, form.name, view.id, state.recordId, {changes, mode: state.mode})
      .then(() => {
        message.success('已更新排期')
        props.onRecordChanged()
      })
      .catch((caught: unknown) => {
        message.error(toErrorMessage(caught, '更新排期失败'))
      })
      .finally(() => {
        setMoveTick((tick) => tick + 1)
        setIsMoving(false)
      })
  }

  const handleBarPointerDown = (event: React.PointerEvent<HTMLDivElement>, bar: ScheduledBar) => {
    if (!movable || isMoving || event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const offsetX = event.clientX - rect.left
    const mode: AppViewMoveMode = offsetX < 8 ? 'RESIZE_START' : offsetX > rect.width - 8 ? 'RESIZE_END' : 'MOVE'
    const state: DragState = {
      recordId: bar.recordId,
      mode,
      pointerX: event.clientX,
      left: bar.left,
      width: bar.width,
      startRaw: bar.start.raw,
      endRaw: bar.end.raw,
      deltaX: 0,
    }
    dragRef.current = state
    setDrag(state)
    setIsMoving(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleBarPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current
    if (!state) return
    const next = {...state, deltaX: event.clientX - state.pointerX}
    dragRef.current = next
    setDrag(next)
  }

  const handleBarPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!state) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (Math.abs(state.deltaX) < 4) {
      setIsMoving(false)
      return
    }
    movedRef.current = true
    const deltaDays = Math.round(state.deltaX / dayWidth)
    if (deltaDays === 0) {
      setIsMoving(false)
      return
    }
    commitMove(state, deltaDays)
  }

  const handleBarPointerCancel = () => {
    dragRef.current = null
    setDrag(null)
    setIsMoving(false)
    movedRef.current = true
  }

  const syncScroll = (source: 'left' | 'right') => {
    const from = source === 'left' ? leftScrollRef.current : rightScrollRef.current
    const to = source === 'left' ? rightScrollRef.current : leftScrollRef.current
    if (from && to && from.scrollTop !== to.scrollTop) to.scrollTop = from.scrollTop
  }

  const todayX = ((Date.now() - win.start.getTime()) / DAY_MS) * dayWidth
  const todayVisible = todayX >= 0 && todayX <= totalWidth

  if (!startField || !endField) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Empty description="甘特视图需要先配置开始与结束字段" className="min-h-[240px]"/>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={isMoving} onClick={() => shiftWindow(-1)}>
            <ChevronLeft className="h-4 w-4"/>
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={isMoving}
                  onClick={() => setWin(initialWindow())}>
            今天
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={isMoving} onClick={() => shiftWindow(1)}>
            <ChevronRight className="h-4 w-4"/>
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">刻度：{SCALE_CONFIG[scale].label}</span>
        {!movable && (
          <span
            className="text-xs text-amber-600 dark:text-amber-400">{disabledReason ?? '当前视图不支持拖拽调整'}</span>
        )}
        <Button
          variant={unscheduledOpen ? 'default' : 'outline'}
          size="sm"
          className="h-7 gap-1 px-2"
          onClick={() => setUnscheduledOpen((open) => !open)}
        >
          <CalendarClock className="h-3.5 w-3.5"/>
          未排期（{unscheduledTotal}）
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border">
          {rangeQuery.isLoading ? (
            <AppLoading center className="min-h-[240px] w-full"/>
          ) : rangeQuery.error && !rangeQuery.data ? (
            <Empty description={rangeQuery.error} className="min-h-[240px] w-full"/>
          ) : scheduled.rows.length === 0 ? (
            <Empty description="暂无数据" className="min-h-[240px] w-full"/>
          ) : (
            <>
              <div className="flex min-h-0 shrink-0 flex-col border-r" style={{width: LIST_WIDTH}}>
                <div
                  className="flex shrink-0 items-center border-b bg-card px-3 text-xs text-muted-foreground"
                  style={{height: headerHeight}}
                >
                  任务
                </div>
                <div
                  ref={leftScrollRef}
                  onScroll={() => syncScroll('left')}
                  className="record-list-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
                >
                  {scheduled.rows.map((bar, index) => (
                    <div
                      key={bar.recordId}
                      className={cn(
                        'flex h-9 shrink-0 cursor-pointer items-center overflow-hidden px-3 text-sm transition-colors hover:bg-muted/40',
                        index % 2 === 1 && 'bg-muted/20',
                      )}
                      onClick={() => props.onOpenRecord(bar.recordId)}
                    >
                      <span className="truncate">{bar.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div
                ref={rightScrollRef}
                onScroll={() => syncScroll('right')}
                className="record-list-scroll relative min-h-0 flex-1 overflow-auto"
              >
                <div className="relative" style={{width: totalWidth, minWidth: '100%'}}>
                  <div
                    className="sticky top-0 z-20 shrink-0 border-b bg-card text-xs text-muted-foreground"
                    style={{height: headerHeight}}
                  >
                    {header.top.map((cell, index) => (
                      <div
                        key={`top-${index}`}
                        className="absolute top-0 flex h-6 items-center overflow-hidden whitespace-nowrap border-r px-2"
                        style={{left: cell.left, width: cell.width}}
                      >
                        {cell.label}
                      </div>
                    ))}
                    {header.bottom && (
                      <>
                        <div className="absolute left-0 right-0 top-6 h-px bg-border"/>
                        {header.bottom.map((cell, index) => (
                          <div
                            key={`bottom-${index}`}
                            className={cn(
                              'absolute top-6 flex h-6 items-center gap-1 overflow-hidden whitespace-nowrap border-r px-2',
                              cell.muted && 'text-muted-foreground/50',
                            )}
                            style={{left: cell.left, width: cell.width}}
                          >
                            <span>{cell.label}</span>
                            {cell.sub && <span>{cell.sub}</span>}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                  <div className="relative" style={{height: scheduled.rows.length * ROW_HEIGHT}}>
                    {scheduled.rows.map((bar, index) => {
                      const active = drag?.recordId === bar.recordId
                      const geometry = active && drag ? resolveDragGeometry(drag, totalWidth, dayWidth) : {
                        left: bar.left,
                        width: bar.width
                      }
                      return (
                        <div
                          key={bar.recordId}
                          className={cn('relative', index % 2 === 1 && 'bg-muted/20')}
                          style={{height: ROW_HEIGHT}}
                          onClick={() => props.onOpenRecord(bar.recordId)}
                        >
                          <div
                            className={cn(
                              'absolute flex touch-none select-none items-center overflow-hidden rounded-full bg-primary/80 px-2 text-xs text-primary-foreground',
                              movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                              active && 'z-10 shadow-md ring-1 ring-ring',
                            )}
                            style={{
                              top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                              left: geometry.left,
                              width: geometry.width,
                              height: BAR_HEIGHT
                            }}
                            title={bar.title}
                            onPointerDown={(event) => handleBarPointerDown(event, bar)}
                            onPointerMove={handleBarPointerMove}
                            onPointerUp={handleBarPointerUp}
                            onPointerCancel={handleBarPointerCancel}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (movedRef.current) {
                                movedRef.current = false
                                return
                              }
                              props.onOpenRecord(bar.recordId)
                            }}
                          >
                            <span className="truncate">{bar.title}</span>
                            {movable && (
                              <>
                                <span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"/>
                                <span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"/>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {todayVisible && (
                    <div
                      className="pointer-events-none absolute bottom-0 z-10 w-px bg-destructive/60"
                      style={{left: todayX, top: headerHeight}}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {unscheduledOpen && (
          <div className="record-list-scroll w-56 shrink-0 overflow-y-auto rounded-lg border p-2">
            <div className="px-1 pb-1 text-xs font-medium text-muted-foreground">未排期（{unscheduledTotal}）</div>
            {unscheduledQuery.isLoading ? (
              <AppLoading className="min-h-[120px]"/>
            ) : unscheduledItems.length === 0 ? (
              <Empty image={null} description="暂无未排期记录" className="py-6"/>
            ) : (
              unscheduledItems.map((item) => (
                <button
                  key={String(item.record.id)}
                  type="button"
                  className="block w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                  onClick={() => props.onOpenRecord(String(item.record.id))}
                >
                  <span className="block truncate text-sm">{viewTitleValue(form, view, item.record)}</span>
                  <span
                    className={cn('block truncate text-xs', item.invalid ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}
                  >
                    {item.hint}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

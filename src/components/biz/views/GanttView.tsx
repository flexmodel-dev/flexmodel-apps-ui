import * as React from 'react'
import {CalendarClock, ChevronDown, ChevronLeft, ChevronRight, ChevronUp} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Empty} from '@/components/ui/empty'
import {Input} from '@/components/ui/input'
import {BizDrawer} from '@/components/ui/drawer'
import {message} from '@/components/ui/message'
import {AppLoading} from '@/components/biz/AppLoading'
import {useViewQuery} from '@/components/biz/views/useViewQuery'
import {type ViewComponentProps, viewTitleValue} from '@/components/biz/views/types'
import {ViewErrorState, ViewFetchingBar, ViewInlineError} from '@/components/biz/views/viewFeedback'
import {type UnscheduledItem, UnscheduledList} from '@/components/biz/views/UnscheduledList'
import {type AppViewFieldChange, type AppViewMoveMode, moveAppViewRecord} from '@/services/appViews'
import type {AppViewGanttScale} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import {cn, toErrorMessage} from '@/lib/utils'

const DAY_MS = 86400000
const RANGE_PAGE_SIZE = 500
const UNSCHEDULED_SIZE = 50
const ROW_HEIGHT = 36
const BAR_HEIGHT = 20
const HEADER_ROW_HEIGHT = 24
const LIST_WIDTH = 240
const RANGE_PADDING_DAYS = 30

const SCALE_CONFIG: Record<AppViewGanttScale, { dayWidth: number; headerRows: number; label: string }> = {
  DAY: {dayWidth: 48, headerRows: 2, label: '按日'},
  WEEK: {dayWidth: 14, headerRows: 2, label: '按周'},
  MONTH: {dayWidth: 5, headerRows: 1, label: '按月'},
}

const SCALE_ORDER: AppViewGanttScale[] = ['DAY', 'WEEK', 'MONTH']

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
  return {start: addDays(base, -RANGE_PADDING_DAYS), end: addDays(base, 90)}
}

function windowAround(date: Date): { start: Date; end: Date } {
  const base = localMidnight(date)
  return {start: addDays(base, -RANGE_PADDING_DAYS), end: addDays(base, 90)}
}

function parseDateInput(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
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

function scaleStepDays(scale: AppViewGanttScale): number {
  return scale === 'DAY' ? 1 : 7
}

/** 甘特视图：自绘时间轴，支持窗口平移、刻度切换、拖拽预览与未排期记录。 */
export function GanttView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick, onRecordChanged} = props
  const startFieldName = view.config.startField || ''
  const endFieldName = view.config.endField || ''
  const startField = form.fields.find((field) => field.name === startFieldName)
  const endField = form.fields.find((field) => field.name === endFieldName)
  const startKind: FieldKind = startField?.type === 'DATE' ? 'DATE' : 'DATETIME'
  const endKind: FieldKind = endField?.type === 'DATE' ? 'DATE' : 'DATETIME'

  const [scale, setScale] = React.useState<AppViewGanttScale>(view.config.ganttScale ?? 'WEEK')
  const [win, setWin] = React.useState(initialWindow)
  const [jumpDate, setJumpDate] = React.useState('')
  const [unscheduledOpen, setUnscheduledOpen] = React.useState(true)
  const [unscheduledDrawerOpen, setUnscheduledDrawerOpen] = React.useState(false)
  const [isMoving, setIsMoving] = React.useState(false)
  const [moveTick, setMoveTick] = React.useState(0)
  const [drag, setDrag] = React.useState<DragState | null>(null)
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [records, setRecords] = React.useState<AppRecord[]>([])
  const [unscheduledPage, setUnscheduledPage] = React.useState(1)
  const [unscheduledRecords, setUnscheduledRecords] = React.useState<AppRecord[]>([])
  const dragRef = React.useRef<DragState | null>(null)
  const movedRef = React.useRef(false)
  const isMovingRef = React.useRef(false)
  const leftScrollRef = React.useRef<HTMLDivElement | null>(null)
  const rightScrollRef = React.useRef<HTMLDivElement | null>(null)
  const autoScrollKeyRef = React.useRef('')

  React.useEffect(() => {
    setScale(view.config.ganttScale ?? 'WEEK')
  }, [view.config.ganttScale])

  const dayWidth = SCALE_CONFIG[scale].dayWidth
  const headerHeight = SCALE_CONFIG[scale].headerRows * HEADER_ROW_HEIGHT
  const reloadKey = `${refreshTick}:${moveTick}`
  const windowKey = `${view.id}|${startFieldName}|${endFieldName}|${formatDate(win.start)}|${formatDate(win.end)}|${search}|${JSON.stringify(advancedFilter ?? null)}`
  const unscheduledKey = `${view.id}|${search}|${JSON.stringify(advancedFilter ?? null)}|${refreshTick}`

  const rangeQuery = useViewQuery(appId, form.name, view.id, {
    scope: 'RANGE',
    rangeStart: startKind === 'DATE' ? formatDate(win.start) : formatDateTime(win.start),
    rangeEnd: startKind === 'DATE' ? formatDate(win.end) : formatDateTime(win.end),
    page,
    size: RANGE_PAGE_SIZE,
    search,
    filter: advancedFilter,
  }, reloadKey)
  const unscheduledQuery = useViewQuery(appId, form.name, view.id, {
    scope: 'UNSCHEDULED',
    page: unscheduledPage,
    size: UNSCHEDULED_SIZE,
    search,
    filter: advancedFilter,
  }, reloadKey)

  const movable = rangeQuery.data?.movable ?? false
  const disabledReason = rangeQuery.data?.disabledReason
  const total = rangeQuery.data?.total ?? 0
  const totalDays = Math.max(1, Math.round((win.end.getTime() - win.start.getTime()) / DAY_MS)) + 1
  const totalWidth = totalDays * dayWidth

  React.useEffect(() => {
    setPage(1)
  }, [refreshTick])

  React.useEffect(() => {
    setRecords([])
    setPage(1)
  }, [windowKey])

  React.useEffect(() => {
    setUnscheduledRecords([])
    setUnscheduledPage(1)
  }, [unscheduledKey])

  React.useEffect(() => {
    const data = rangeQuery.data
    if (!data) return
    setRecords((previous) => {
      if (page === 1) return data.list
      const merged = new Map(previous.map((item) => [String(item.id), item]))
      for (const item of data.list) merged.set(String(item.id), item)
      return Array.from(merged.values())
    })
  }, [rangeQuery.data, page])

  React.useEffect(() => {
    const data = unscheduledQuery.data
    if (!data) return
    setUnscheduledRecords((previous) => {
      if (unscheduledPage === 1) return data.list
      const merged = new Map(previous.map((item) => [String(item.id), item]))
      for (const item of data.list) merged.set(String(item.id), item)
      return Array.from(merged.values())
    })
  }, [unscheduledQuery.data, unscheduledPage])

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
    for (const record of records) {
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
  }, [records, startFieldName, endFieldName, endKind, win, dayWidth, totalWidth, form, view])

  const startFieldLabel = form.layout.items.find((item) => item.type === 'FIELD' && item.name === startFieldName)?.label?.trim()
    || form.fields.find((field) => field.name === startFieldName)?.label
    || '开始时间'
  const endFieldLabel = form.layout.items.find((item) => item.type === 'FIELD' && item.name === endFieldName)?.label?.trim()
    || form.fields.find((field) => field.name === endFieldName)?.label
    || '结束时间'

  const unscheduledItems = unscheduledRecords.map<UnscheduledItem>((record) => {
    const start = parseDateValue(record[startFieldName])
    const end = parseDateValue(record[endFieldName])
    const invalid = record._invalidRange === true
      || (start && end && end.date.getTime() < start.date.getTime())
    const hint = invalid
      ? '起止日期非法'
      : !start
        ? `${startFieldLabel}未设置`
        : `${endFieldLabel}未设置`
    return {record, title: viewTitleValue(form, view, record), hint, invalid: Boolean(invalid)}
  })
  const unscheduledTotal = unscheduledQuery.data?.total ?? 0
  const unscheduledHasMore = unscheduledItems.length < unscheduledTotal
  const hasMoreRange = records.length < total

  const shiftWindow = (direction: number) => {
    setWin((previous) => {
      const delta = ((previous.end.getTime() - previous.start.getTime()) / 4) * direction
      return {
        start: localMidnight(new Date(previous.start.getTime() + delta)),
        end: localMidnight(new Date(previous.end.getTime() + delta)),
      }
    })
  }

  const goToday = () => setWin(initialWindow())

  const jump = (value: string) => {
    setJumpDate(value)
    const date = parseDateInput(value)
    if (date) setWin(windowAround(date))
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
    isMovingRef.current = true
    moveAppViewRecord(appId, form.name, view.id, state.recordId, {changes, mode: state.mode})
      .then(() => {
        message.success('已更新排期')
        onRecordChanged()
      })
      .catch((caught: unknown) => {
        message.error(toErrorMessage(caught, '更新排期失败'))
      })
      .finally(() => {
        setMoveTick((tick) => tick + 1)
        setIsMoving(false)
        isMovingRef.current = false
      })
  }

  const handleBarPointerDown = (event: React.PointerEvent<HTMLDivElement>, bar: ScheduledBar) => {
    if (!movable || isMovingRef.current || event.button !== 0) return
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
  const dragDays = drag ? Math.round(drag.deltaX / dayWidth) : 0
  const dragLabel = drag
    ? `${drag.mode === 'MOVE' ? '移动' : drag.mode === 'RESIZE_START' ? '调整开始' : '调整结束'} ${dragDays > 0 ? '+' : ''}${dragDays} 天`
    : ''
  const gridBackground = scale === 'MONTH'
    ? undefined
    : {backgroundImage: `repeating-linear-gradient(to right, hsl(var(--border)) 0 1px, transparent 1px ${dayWidth * scaleStepDays(scale)}px)`}

  // 首次加载、切换刻度或平移窗口后把“今天”带到可视区域，避免按日刻度下排期条在屏幕外。
  React.useEffect(() => {
    if (!scheduled.rows.length || !todayVisible) return
    const autoScrollKey = `${scale}|${formatDate(win.start)}|${scheduled.rows.length}`
    if (autoScrollKeyRef.current === autoScrollKey) return
    autoScrollKeyRef.current = autoScrollKey
    const element = rightScrollRef.current
    if (!element) return
    element.scrollLeft = Math.max(0, todayX - element.clientWidth * 0.35)
  }, [scale, win.start, scheduled.rows.length, todayVisible, todayX])

  if (!startField || !endField) {
    return (
      <Empty className="min-h-[240px]" description="甘特视图需要先配置开始与结束字段。">
        {props.onOpenViewSettings && (
          <Button size="sm" onClick={props.onOpenViewSettings}>去设置字段</Button>
        )}
      </Empty>
    )
  }

  const unscheduledList = (
    <UnscheduledList
      items={unscheduledItems}
      total={unscheduledTotal}
      hasMore={unscheduledHasMore}
      isLoading={unscheduledQuery.isLoading}
      isFetching={unscheduledQuery.isFetching}
      error={unscheduledQuery.error}
      onRetry={unscheduledQuery.reload}
      onLoadMore={() => setUnscheduledPage((current) => current + 1)}
      onOpenRecord={props.onOpenRecord}
    />
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={isMoving} onClick={() => shiftWindow(-1)}
                  title="向前平移" aria-label="向前平移">
            <ChevronLeft className="h-4 w-4"/>
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={isMoving} onClick={goToday}>今天</Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={isMoving} onClick={() => shiftWindow(1)}
                  title="向后平移" aria-label="向后平移">
            <ChevronRight className="h-4 w-4"/>
          </Button>
        </div>
        <Input
          type="date"
          value={jumpDate}
          onChange={(event) => jump(event.target.value)}
          className="h-7 w-[132px] text-xs"
          aria-label="跳转到日期"
        />
        <div className="flex items-center gap-1">
          {SCALE_ORDER.map((item) => (
            <Button
              key={item}
              variant={scale === item ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setScale(item)}
            >
              {SCALE_CONFIG[item].label}
            </Button>
          ))}
        </div>
        <span className="hidden text-xs text-muted-foreground lg:inline">
          {formatDate(win.start)} ~ {formatDate(win.end)}
        </span>
        {!rangeQuery.isLoading && disabledReason && (
          <span className="text-xs text-amber-600 dark:text-amber-400">{disabledReason}</span>
        )}
        <Button
          variant={unscheduledOpen ? 'secondary' : 'outline'}
          size="sm"
          className="ml-auto hidden h-7 gap-1 px-2 text-xs md:inline-flex"
          onClick={() => setUnscheduledOpen((open) => !open)}
        >
          <CalendarClock className="h-3.5 w-3.5"/>
          未排期（{unscheduledTotal}）
          {unscheduledOpen ? <ChevronUp className="h-3.5 w-3.5"/> : <ChevronDown className="h-3.5 w-3.5"/>}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs md:hidden"
          onClick={() => setUnscheduledDrawerOpen(true)}
        >
          <CalendarClock className="h-3.5 w-3.5"/>
          未排期（{unscheduledTotal}）
        </Button>
        {isMoving && <span className="text-xs text-muted-foreground">保存中…</span>}
        {hasMoreRange && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            已加载 {records.length} / {total} 条
            <Button
              size="sm" variant="outline" className="h-7 text-xs"
              disabled={rangeQuery.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              继续加载
            </Button>
          </span>
        )}
      </div>
      {rangeQuery.error && rangeQuery.data && <ViewInlineError message={rangeQuery.error} onRetry={rangeQuery.reload}/>}
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
          <ViewFetchingBar active={rangeQuery.isFetching && !rangeQuery.isLoading}/>
          {rangeQuery.error && !rangeQuery.data ? (
            <ViewErrorState message={rangeQuery.error} onRetry={rangeQuery.reload}/>
          ) : rangeQuery.isLoading && !rangeQuery.data ? (
            <AppLoading center className="min-h-[240px]"/>
          ) : scheduled.rows.length === 0 ? (
            <Empty className="min-h-[240px]" description="当前时间窗口内没有排期记录">
              <Button variant="secondary" size="sm" onClick={goToday}>回到今天</Button>
              {unscheduledTotal > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setUnscheduledDrawerOpen(true)}>查看未排期</Button>
              )}
            </Empty>
          ) : (
            <>
              <div className="flex min-h-0 flex-1">
                <div className="flex min-h-0 w-40 shrink-0 flex-col border-r md:w-60">
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
                          hoveredId === bar.recordId && 'bg-primary/5',
                        )}
                        onClick={() => props.onOpenRecord(bar.recordId)}
                        onMouseEnter={() => setHoveredId(bar.recordId)}
                        onMouseLeave={() => setHoveredId(null)}
                        title={bar.title}
                      >
                        <span className="truncate">{bar.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  ref={rightScrollRef}
                  onScroll={() => syncScroll('right')}
                  data-gantt-scroll
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
                    <div className="relative" style={{height: scheduled.rows.length * ROW_HEIGHT, ...gridBackground}}>
                      {scheduled.rows.map((bar, index) => {
                        const active = drag?.recordId === bar.recordId
                        const geometry = active && drag ? resolveDragGeometry(drag, totalWidth, dayWidth) : {
                          left: bar.left,
                          width: bar.width
                        }
                        return (
                          <div
                            key={bar.recordId}
                            className={cn(
                              'relative',
                              index % 2 === 1 && 'bg-muted/20',
                              hoveredId === bar.recordId && 'bg-primary/5',
                            )}
                            style={{height: ROW_HEIGHT}}
                            onClick={() => props.onOpenRecord(bar.recordId)}
                            onMouseEnter={() => setHoveredId(bar.recordId)}
                            onMouseLeave={() => setHoveredId(null)}
                          >
                            <div
                              className={cn(
                                'group/bar absolute flex touch-none select-none items-center overflow-visible rounded-full bg-primary/80 px-2 text-xs text-primary-foreground',
                                movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                                active && 'z-10 shadow-md ring-1 ring-ring',
                              )}
                              style={{
                                top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                                left: geometry.left,
                                width: geometry.width,
                                height: BAR_HEIGHT
                              }}
                              data-gantt-record={bar.recordId}
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
                                  <span
                                    className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-full bg-black/10 opacity-0 transition-opacity group-hover/bar:opacity-100"/>
                                  <span
                                    className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-full bg-black/10 opacity-0 transition-opacity group-hover/bar:opacity-100"/>
                                </>
                              )}
                              {active && dragDays !== 0 && (
                                <span
                                  className="pointer-events-none absolute -top-5 left-0 z-20 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-[10px] text-popover-foreground shadow"
                                >
                                  {dragLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {todayVisible && (
                      <>
                        <div
                          className="pointer-events-none absolute bottom-0 z-10 w-px bg-destructive/60"
                          style={{left: todayX, top: headerHeight}}
                        />
                        <span
                          className="pointer-events-none absolute z-20 -translate-x-1/2 rounded bg-destructive px-1 text-[10px] leading-4 text-destructive-foreground"
                          style={{left: todayX, top: headerHeight - 8}}
                        >
                          今天
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        {unscheduledOpen && (
          <div className="hidden w-56 shrink-0 flex-col overflow-hidden rounded-lg border md:flex">
            <div
              className="flex shrink-0 items-center justify-between border-b px-2 py-1.5 text-xs font-medium text-muted-foreground">
              <span>未排期（{unscheduledTotal}）</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setUnscheduledOpen(false)}
                      aria-label="收起未排期">
                <ChevronRight className="h-3.5 w-3.5"/>
              </Button>
            </div>
            <div className="record-list-scroll min-h-0 flex-1 overflow-y-auto p-1.5">{unscheduledList}</div>
          </div>
        )}
      </div>

      <BizDrawer
        open={unscheduledDrawerOpen}
        onOpenChange={setUnscheduledDrawerOpen}
        title="未排期记录"
        width="w-[min(92vw,380px)]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto">{unscheduledList}</div>
      </BizDrawer>
    </div>
  )
}

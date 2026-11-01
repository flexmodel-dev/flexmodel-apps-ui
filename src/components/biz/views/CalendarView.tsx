import * as React from 'react'
import {CalendarClock, ChevronDown, ChevronLeft, ChevronRight, ChevronUp} from 'lucide-react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import zhCnLocale from '@fullcalendar/core/locales/zh-cn'
import type {DatesSetArg, EventClickArg, EventDropArg, EventInput} from '@fullcalendar/core'
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
import {moveAppViewRecord} from '@/services/appViews'
import type {AppRecord} from '@/services/appRecords'
import type {AppViewCalendarUnit} from '@/services/appForms'
import {toErrorMessage} from '@/lib/utils'

const UNIT_VIEWS: Record<AppViewCalendarUnit, string> = {
  MONTH: 'dayGridMonth',
  WEEK: 'timeGridWeek',
  DAY: 'timeGridDay',
}

const UNIT_LABELS: Record<AppViewCalendarUnit, string> = {
  MONTH: '月',
  WEEK: '周',
  DAY: '日',
}

const UNITS: AppViewCalendarUnit[] = ['MONTH', 'WEEK', 'DAY']
const PAGE_SIZE = 1000
const UNSCHEDULED_SIZE = 50

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateTime(date: Date): string {
  return `${formatDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function normalizeDateTime(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value)
  return match ? `${match[1]}T${match[2]}:${match[3]}:${match[4]}` : value.slice(0, 19)
}

function addOneDay(dateText: string): string {
  const [yearText, monthText, dayText] = dateText.split('-')
  const next = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)) + 86400000)
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

/** 日历视图：按可见窗口拉取 RANGE 数据，支持拖拽改期、周期导航与未排期记录。 */
export function CalendarView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick, onRecordChanged} = props
  const startField = view.config.startField || ''
  const endField = view.config.endField || ''
  const startFieldType = form.fields.find((field) => field.name === startField)?.type
  const allDay = startFieldType !== 'DATETIME'

  const calendarRef = React.useRef<FullCalendar>(null)
  const [unit, setUnit] = React.useState<AppViewCalendarUnit>(view.config.calendarUnit ?? 'MONTH')
  const [range, setRange] = React.useState<{ start: string; end: string } | null>(null)
  const [title, setTitle] = React.useState('')
  const [jumpDate, setJumpDate] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [records, setRecords] = React.useState<AppRecord[]>([])
  const [isMoving, setIsMoving] = React.useState(false)
  const [unscheduledOpen, setUnscheduledOpen] = React.useState(true)
  const [unscheduledDrawerOpen, setUnscheduledDrawerOpen] = React.useState(false)
  const [unscheduledPage, setUnscheduledPage] = React.useState(1)
  const [unscheduledRecords, setUnscheduledRecords] = React.useState<AppRecord[]>([])

  React.useEffect(() => {
    const next = view.config.calendarUnit ?? 'MONTH'
    setUnit(next)
    calendarRef.current?.getApi().changeView(UNIT_VIEWS[next])
  }, [view.config.calendarUnit])

  const rangeKey = `${range?.start ?? ''}|${range?.end ?? ''}|${search}|${JSON.stringify(advancedFilter ?? null)}`
  const unscheduledKey = `${search}|${JSON.stringify(advancedFilter ?? null)}`

  const rangeQuery = useViewQuery(appId, form.name, view.id, {
    scope: 'RANGE',
    rangeStart: range?.start,
    rangeEnd: range?.end,
    page,
    size: PAGE_SIZE,
    search,
    filter: advancedFilter,
  }, refreshTick, range != null)
  const unscheduledQuery = useViewQuery(appId, form.name, view.id, {
    scope: 'UNSCHEDULED',
    page: unscheduledPage,
    size: UNSCHEDULED_SIZE,
    search,
    filter: advancedFilter,
  }, refreshTick)

  const rangeData = rangeQuery.data
  const movable = rangeData?.movable ?? false
  const disabledReason = rangeData?.disabledReason
  const total = rangeData?.total ?? 0
  const hasMore = rangeData?.hasMore ?? false

  React.useEffect(() => {
    setRecords([])
    setPage(1)
  }, [rangeKey])

  React.useEffect(() => {
    setPage(1)
  }, [refreshTick])

  React.useEffect(() => {
    setUnscheduledRecords([])
    setUnscheduledPage(1)
  }, [unscheduledKey])

  React.useEffect(() => {
    setUnscheduledPage(1)
  }, [refreshTick])

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

  const events = React.useMemo<EventInput[]>(() => {
    if (!startField) return []
    const list: EventInput[] = []
    for (const record of records) {
      const rawStart = record[startField]
      if (isBlank(rawStart)) continue
      const event: EventInput = {
        id: String(record.id),
        title: viewTitleValue(form, view, record),
        start: allDay ? String(rawStart).slice(0, 10) : normalizeDateTime(String(rawStart)),
        allDay,
        extendedProps: {record},
      }
      if (endField) {
        const rawEnd = record[endField]
        if (!isBlank(rawEnd)) {
          event.end = allDay ? addOneDay(String(rawEnd).slice(0, 10)) : normalizeDateTime(String(rawEnd))
        }
      }
      list.push(event)
    }
    return list
  }, [records, startField, endField, allDay, form, view])

  const handleDatesSet = React.useCallback((arg: DatesSetArg) => {
    const nextStart = allDay ? formatDate(arg.start) : formatDateTime(arg.start)
    const nextEnd = allDay ? formatDate(arg.end) : formatDateTime(arg.end)
    setTitle(arg.view.title)
    setRange((previous) =>
      previous && previous.start === nextStart && previous.end === nextEnd
        ? previous
        : {start: nextStart, end: nextEnd})
  }, [allDay])

  const handleEventDrop = React.useCallback((info: EventDropArg) => {
    if (!startField || isMoving || !info.event.start) {
      info.revert()
      return
    }
    const record = info.oldEvent.extendedProps.record as AppRecord
    const rawFrom = record[startField]
    const from = isBlank(rawFrom) ? '' : allDay ? String(rawFrom).slice(0, 10) : normalizeDateTime(String(rawFrom))
    const to = allDay ? formatDate(info.event.start) : formatDateTime(info.event.start)
    setIsMoving(true)
    moveAppViewRecord(appId, form.name, view.id, String(info.event.id), {changes: {[startField]: {from, to}}})
      .then(() => {
        message.success('已调整日程')
        onRecordChanged()
      })
      .catch((caught: unknown) => {
        info.revert()
        message.error(toErrorMessage(caught, '调整失败'))
      })
      .finally(() => setIsMoving(false))
  }, [appId, form.name, view.id, startField, allDay, isMoving, onRecordChanged])

  const handleEventClick = React.useCallback((info: EventClickArg) => {
    props.onOpenRecord(String(info.event.id))
  }, [props.onOpenRecord])

  const changeUnit = (next: AppViewCalendarUnit) => {
    setUnit(next)
    calendarRef.current?.getApi().changeView(UNIT_VIEWS[next])
  }

  const goToday = () => calendarRef.current?.getApi().today()
  const goPrev = () => calendarRef.current?.getApi().prev()
  const goNext = () => calendarRef.current?.getApi().next()

  const startFieldLabel = form.layout.items.find((item) => item.type === 'FIELD' && item.name === startField)?.label?.trim()
    || form.fields.find((field) => field.name === startField)?.label
    || '开始时间'

  const unscheduledItems = unscheduledRecords.map<UnscheduledItem>((record) => ({
    record,
    title: viewTitleValue(form, view, record),
    hint: record._invalidRange === true ? '起止日期非法' : `${startFieldLabel}未设置`,
    invalid: record._invalidRange === true,
  }))
  const unscheduledTotal = unscheduledQuery.data?.total ?? 0
  const unscheduledHasMore = unscheduledItems.length < unscheduledTotal

  if (!startField) {
    return (
      <Empty className="min-h-[240px]" description="当前视图未配置开始字段，无法展示日历。">
        {props.onOpenViewSettings && (
          <Button size="sm" onClick={props.onOpenViewSettings}>去设置开始字段</Button>
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
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={isMoving} onClick={goPrev}
                  title="上一个周期" aria-label="上一个周期">
            <ChevronLeft className="h-4 w-4"/>
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={isMoving} onClick={goToday}>今天</Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={isMoving} onClick={goNext}
                  title="下一个周期" aria-label="下一个周期">
            <ChevronRight className="h-4 w-4"/>
          </Button>
        </div>
        <span className="min-w-[110px] text-center text-sm font-medium tabular-nums" aria-live="polite">
          {title || '日历'}
        </span>
        <Input
          type="date"
          value={jumpDate}
          onChange={(event) => {
            const value = event.target.value
            setJumpDate(value)
            if (value) calendarRef.current?.getApi().gotoDate(value)
          }}
          className="h-7 w-[132px] text-xs"
          aria-label="跳转到日期"
        />
        <div className="flex items-center gap-1">
          {UNITS.map((item) => (
            <Button
              key={item} size="sm" variant={unit === item ? 'default' : 'outline'}
              className="h-7 px-2 text-xs"
              disabled={isMoving}
              onClick={() => changeUnit(item)}
            >
              {UNIT_LABELS[item]}
            </Button>
          ))}
        </div>
        {disabledReason && <span className="text-xs text-muted-foreground">{disabledReason}</span>}
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
          未排期（{unscheduledTotal}）
        </Button>
        {hasMore && (
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
      {rangeQuery.error && !rangeQuery.data && rangeQuery.isLoading === false ? (
        <ViewErrorState message={rangeQuery.error} onRetry={rangeQuery.reload}/>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border p-2">
            <ViewFetchingBar active={rangeQuery.isFetching && !rangeQuery.isLoading}/>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              locale={zhCnLocale}
              headerToolbar={false}
              height="100%"
              initialView={UNIT_VIEWS[unit]}
              editable={movable && !isMoving}
              eventDurationEditable={false}
              eventDragMinDistance={4}
              events={events}
              datesSet={handleDatesSet}
              eventDrop={handleEventDrop}
              eventClick={handleEventClick}
              nowIndicator
              dayMaxEvents={3}
              eventTimeFormat={{hour: '2-digit', minute: '2-digit', hour12: false}}
            />
            {rangeQuery.isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <AppLoading/>
              </div>
            )}
          </div>
          <div className="hidden w-56 shrink-0 flex-col overflow-hidden rounded-lg border md:flex">
            <button
              type="button"
              className="flex shrink-0 items-center justify-between gap-1 px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
              onClick={() => setUnscheduledOpen((open) => !open)}
            >
              未排期（{unscheduledTotal}）
              {unscheduledOpen ? <ChevronDown className="h-3.5 w-3.5"/> : <ChevronRight className="h-3.5 w-3.5"/>}
            </button>
            {unscheduledOpen && (
              <div className="record-list-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
                {unscheduledList}
              </div>
            )}
          </div>
        </div>
      )}

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

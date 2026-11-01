import * as React from 'react'
import {ArrowLeft, ChevronLeft, ChevronRight} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Pagination} from '@/components/biz/Pagination'
import {Empty} from '@/components/ui/empty'
import {AppRecordPanel} from '@/components/biz/AppRecordPanel'
import {useViewQuery} from '@/components/biz/views/useViewQuery'
import {type ViewComponentProps, viewDisplayFields, viewTitleValue} from '@/components/biz/views/types'
import {
  DEFAULT_VIEW_PAGE_SIZE,
  layoutFieldLabel,
  recordFieldText,
  VIEW_PAGE_SIZE_OPTIONS,
} from '@/components/biz/views/viewUtils'
import {ViewErrorState, ViewFetchingBar, ViewInlineError, ViewSkeleton} from '@/components/biz/views/viewFeedback'
import type {AppFormField} from '@/services/appForms'
import {cn} from '@/lib/utils'

/** 详情视图：列表+详情 或 仅显示排序后的第一条详情。 */
export function DetailView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick, onRecordChanged} = props
  const isSingle = (view.config.detailMode ?? 'LIST') === 'SINGLE'
  const [page, setPage] = React.useState(1)
  const [size, setSize] = React.useState(DEFAULT_VIEW_PAGE_SIZE)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [mobileDetailOpen, setMobileDetailOpen] = React.useState(false)
  const pendingSelect = React.useRef<'first' | 'last' | null>(null)

  const query = useViewQuery(appId, form.name, view.id, {
    scope: 'RECORDS',
    page: isSingle ? 1 : page,
    size: isSingle ? 1 : size,
    search,
    filter: advancedFilter,
  }, refreshTick)

  const rows = query.data?.list ?? []
  const total = query.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / size))
  const isInitialLoading = query.isLoading && !query.data
  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const summaryFields = viewDisplayFields(form, view)
    .map((name) => fieldMap.get(name))
    .filter((field): field is AppFormField => Boolean(field))
    .slice(0, 3)
  const activeIndex = rows.findIndex((row) => String(row.id) === activeId)

  React.useEffect(() => {
    setPage(1)
    setActiveId(null)
    setMobileDetailOpen(false)
    pendingSelect.current = null
  }, [search, advancedFilter, view.filter])

  React.useEffect(() => {
    if (page > pages) setPage(pages)
  }, [page, pages])

  React.useEffect(() => {
    if (isSingle) {
      setActiveId(rows[0] ? String(rows[0].id) : null)
      return
    }
    if (!rows.length) {
      setActiveId(null)
      return
    }
    const pending = pendingSelect.current
    if (pending) {
      pendingSelect.current = null
      setActiveId(String(rows[pending === 'first' ? 0 : rows.length - 1].id))
      return
    }
    if (activeId && rows.some((row) => String(row.id) === activeId)) return
    setActiveId(String(rows[0].id))
    // activeId 变化后需重新校验，仅依赖查询结果
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, isSingle])

  const selectRecord = (recordId: string) => {
    setActiveId(recordId)
    setMobileDetailOpen(true)
  }

  const step = (direction: 1 | -1) => {
    const index = rows.findIndex((row) => String(row.id) === activeId)
    if (index >= 0) {
      const next = rows[index + direction]
      if (next) {
        setActiveId(String(next.id))
        return
      }
    }
    if (direction === 1 && page < pages) {
      pendingSelect.current = 'first'
      setPage((current) => current + 1)
    } else if (direction === -1 && page > 1) {
      pendingSelect.current = 'last'
      setPage((current) => current - 1)
    }
  }

  const emptyState = <Empty className="min-h-[240px]" description="暂无数据"/>

  if (query.error && !query.data) {
    return <ViewErrorState message={query.error} onRetry={query.reload}/>
  }

  if (isSingle) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <ViewFetchingBar active={query.isFetching && !query.isLoading}/>
          {query.error && <ViewInlineError message={query.error} onRetry={query.reload}/>}
          {isInitialLoading ? (
            <ViewSkeleton variant="panel" rows={6}/>
          ) : activeId ? (
            <AppRecordPanel
              appId={appId}
              form={form}
              recordId={activeId}
              onSaved={onRecordChanged}
              onDeleted={() => {
                setActiveId(null)
                onRecordChanged()
              }}
              onOpenRecord={props.onOpenLinkedRecord}
            />
          ) : emptyState}
        </div>
        {total > 1 && (
          <p className="mt-2 text-xs text-muted-foreground">共 {total} 条记录，当前仅显示排序后的第一条。</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div
          className={cn(
            'min-h-0 flex-col rounded-lg border lg:w-72 lg:shrink-0 lg:border-0 lg:border-r lg:rounded-none lg:pr-3',
            mobileDetailOpen ? 'hidden lg:flex' : 'flex',
          )}
        >
          <div className="relative min-h-0 flex-1 overflow-y-auto record-list-scroll">
            <ViewFetchingBar active={query.isFetching && !query.isLoading}/>
            {query.error && <ViewInlineError message={query.error} onRetry={query.reload}/>}
            {isInitialLoading ? (
              <ViewSkeleton variant="list" rows={6}/>
            ) : rows.length ? (
              <ul className="space-y-1">
                {rows.map((row) => {
                  const recordId = String(row.id)
                  return (
                    <li key={recordId}>
                      <button
                        type="button"
                        onClick={() => selectRecord(recordId)}
                        className={cn(
                          'w-full rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/40',
                          activeId === recordId ? 'border-primary bg-primary/5' : 'border-transparent',
                        )}
                      >
                        <div className="truncate text-sm font-medium text-foreground">
                          {viewTitleValue(form, view, row)}
                        </div>
                        {summaryFields.map((field) => {
                          const text = recordFieldText(field, row[field.name])
                          return (
                            <div key={field.name} className="mt-0.5 truncate text-xs text-muted-foreground"
                                 title={text}>
                              <span
                                className="text-muted-foreground/80">{layoutFieldLabel(form, field.name, field.label)}：</span>
                              {text}
                            </div>
                          )
                        })}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : emptyState}
          </div>
          <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
            <span>共 {total} 条</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="icon" className="h-7 w-7" title="上一页"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4"/>
              </Button>
              <span className="tabular-nums">第 {page} / {pages} 页</span>
              <Button
                variant="ghost" size="icon" className="h-7 w-7" title="下一页"
                disabled={page >= pages}
                onClick={() => setPage((current) => Math.min(pages, current + 1))}
              >
                <ChevronRight className="h-4 w-4"/>
              </Button>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
            mobileDetailOpen ? 'flex' : 'hidden lg:flex',
          )}
        >
          <div className="flex shrink-0 flex-wrap items-center gap-2 pb-2">
            <Button
              variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs lg:hidden"
              onClick={() => setMobileDetailOpen(false)}
            >
              <ArrowLeft className="h-3.5 w-3.5"/>返回列表
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost" size="icon" className="h-7 w-7" title="上一条"
                disabled={activeIndex <= 0 && page <= 1}
                onClick={() => step(-1)}
              >
                <ChevronLeft className="h-4 w-4"/>
              </Button>
              <span className="min-w-[72px] text-center text-xs tabular-nums text-muted-foreground">
                {activeId ? `${Math.max(1, (page - 1) * size + Math.max(activeIndex, 0) + 1)} / ${total}` : `0 / ${total}`}
              </span>
              <Button
                variant="ghost" size="icon" className="h-7 w-7" title="下一条"
                disabled={(activeIndex >= rows.length - 1 && page >= pages) || !rows.length}
                onClick={() => step(1)}
              >
                <ChevronRight className="h-4 w-4"/>
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {activeId ? (
              <AppRecordPanel
                appId={appId}
                form={form}
                recordId={activeId}
                onSaved={onRecordChanged}
                onDeleted={() => {
                  setActiveId(null)
                  setMobileDetailOpen(false)
                  onRecordChanged()
                }}
                onOpenRecord={props.onOpenLinkedRecord}
              />
            ) : (
              <div className="flex h-full min-h-[160px] items-center justify-center text-sm text-muted-foreground">
                {rows.length ? '从左侧选择一条记录查看详情' : ''}
              </div>
            )}
          </div>
        </div>
      </div>
      {total > 0 && (
        <Pagination
          page={page}
          pages={pages}
          total={total}
          size={size}
          sizeOptions={VIEW_PAGE_SIZE_OPTIONS}
          onChange={setPage}
          onSizeChange={(nextSize) => {
            setSize(nextSize)
            setPage(1)
          }}
          className="mt-2 w-full"
        />
      )}
    </div>
  )
}

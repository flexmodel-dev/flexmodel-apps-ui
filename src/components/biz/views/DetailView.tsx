import * as React from 'react'
import {ChevronLeft, ChevronRight} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Pagination} from '@/components/biz/Pagination'
import {Empty} from '@/components/ui/empty'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppRecordPanel} from '@/components/biz/AppRecordPanel'
import {useViewQuery} from '@/components/biz/views/useViewQuery'
import {type ViewComponentProps, viewDisplayFields, viewTitleValue} from '@/components/biz/views/types'
import type {AppFormField} from '@/services/appForms'
import {cn} from '@/lib/utils'

/** 详情视图：列表+详情 或 仅显示排序后的第一条详情。 */
export function DetailView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick, onRecordChanged} = props
  const isSingle = (view.config.detailMode ?? 'LIST') === 'SINGLE'
  const [page, setPage] = React.useState(1)
  const [size, setSize] = React.useState(30)
  const [activeId, setActiveId] = React.useState<string | null>(null)

  const query = useViewQuery(appId, form.name, view.id, {
    scope: 'RECORDS',
    page: isSingle ? 1 : page,
    size: isSingle ? 1 : size,
    search,
    filter: advancedFilter,
  }, refreshTick)

  const rows = query.data?.list ?? []
  const total = query.data?.total ?? 0
  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const summaryFields = viewDisplayFields(form, view)
    .map((name) => fieldMap.get(name))
    .filter((field): field is AppFormField => Boolean(field))
    .slice(0, 3)

  React.useEffect(() => {
    if (isSingle) {
      setActiveId(rows[0] ? String(rows[0].id) : null)
      return
    }
    if (activeId && rows.some((row) => String(row.id) === activeId)) return
    setActiveId(rows[0] ? String(rows[0].id) : null)
    // activeId 变化后需重新校验，仅依赖查询结果
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, isSingle])

  const step = (direction: 1 | -1) => {
    const index = rows.findIndex((row) => String(row.id) === activeId)
    const next = rows[index + direction]
    if (next) setActiveId(String(next.id))
  }
  const activeIndex = rows.findIndex((row) => String(row.id) === activeId)

  if (isSingle) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {query.isLoading ? (
          <AppLoading center className="min-h-[240px]"/>
        ) : query.error ? (
          <Empty description={query.error}/>
        ) : activeId ? (
          <AppRecordPanel
            appId={appId}
            form={form}
            recordId={activeId}
            onSaved={onRecordChanged}
            onDeleted={() => onRecordChanged()}
            onOpenRecord={props.onOpenLinkedRecord}
          />
        ) : (
          <Empty description="暂无匹配的记录"/>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 flex-col lg:w-72 lg:shrink-0 lg:border-r lg:pr-3">
          <div className="record-list-scroll min-h-0 flex-1 overflow-y-auto">
            {query.isLoading ? (
              <AppLoading center className="min-h-[240px]"/>
            ) : (
              <ul className="space-y-1">
                {rows.map((row) => {
                  const recordId = String(row.id)
                  return (
                    <li key={recordId}>
                      <button
                        type="button"
                        onClick={() => setActiveId(recordId)}
                        className={cn(
                          'w-full rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/40',
                          activeId === recordId ? 'border-primary bg-primary/5' : 'border-transparent',
                        )}
                      >
                        <div className="truncate text-sm font-medium text-foreground">
                          {viewTitleValue(form, view, row)}
                        </div>
                        {summaryFields.map((field) => (
                          <div key={field.name} className="mt-0.5 truncate text-xs text-muted-foreground">
                            {field.label}：{row[field.name] == null || row[field.name] === '' ? '-' : String(row[field.name])}
                          </div>
                        ))}
                      </button>
                    </li>
                  )
                })}
                {!query.isLoading && rows.length === 0 && <Empty description="暂无数据"/>}
              </ul>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <Button
              variant="ghost" size="icon" className="h-7 w-7" title="上一条"
              disabled={activeIndex <= 0}
              onClick={() => step(-1)}
            >
              <ChevronLeft className="h-4 w-4"/>
            </Button>
            <span className="text-xs text-muted-foreground">共 {total} 条</span>
            <Button
              variant="ghost" size="icon" className="h-7 w-7" title="下一条"
              disabled={activeIndex < 0 || activeIndex >= rows.length - 1}
              onClick={() => step(1)}
            >
              <ChevronRight className="h-4 w-4"/>
            </Button>
          </div>
        </div>
        <div className="record-list-scroll min-h-0 flex-1 overflow-y-auto">
          {activeId ? (
            <AppRecordPanel
              appId={appId}
              form={form}
              recordId={activeId}
              onSaved={onRecordChanged}
              onDeleted={() => onRecordChanged()}
              onOpenRecord={props.onOpenLinkedRecord}
            />
          ) : (
            !query.isLoading && <Empty description="暂无数据"/>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Pagination
          page={page}
          pages={Math.max(1, Math.ceil(total / size))}
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
  )
}

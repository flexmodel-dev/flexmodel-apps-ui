import * as React from 'react'
import {AlertTriangle, ChevronDown, ChevronRight, Loader2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Empty} from '@/components/ui/empty'
import {Pagination} from '@/components/biz/Pagination'
import {useViewQuery} from '@/components/biz/views/useViewQuery'
import {type ViewComponentProps, viewDisplayFields, viewTitleValue} from '@/components/biz/views/types'
import {layoutFieldLabel, recordFieldText, VIEW_PAGE_SIZE_OPTIONS,} from '@/components/biz/views/viewUtils'
import {ViewErrorState, ViewFetchingBar, ViewInlineError, ViewSkeleton} from '@/components/biz/views/viewFeedback'
import {queryAppView} from '@/services/appViews'
import type {AppFormField, AppViewHierarchyMode} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import {cn, toErrorMessage} from '@/lib/utils'

const ROOT_PAGE_SIZE = 50
const CHILD_PAGE_SIZE = 200

interface ChildState {
  records: AppRecord[]
  total: number
  page: number
  loading: boolean
  error: string | null
}

interface TreeRow {
  kind: 'record'
  record: AppRecord
  depth: number
  hasChildren: boolean
  loading: boolean
  error: string | null
}

interface MoreRow {
  kind: 'more'
  parentId: string
  depth: number
  loaded: number
  total: number
  loading: boolean
}

type Row = TreeRow | MoreRow

function recordIdOf(record: AppRecord): string {
  return String(record.id)
}

function buildRows(
  roots: AppRecord[],
  expanded: Set<string>,
  children: Record<string, ChildState>,
  childFlags: Record<string, boolean>,
): Row[] {
  const rows: Row[] = []
  const walk = (records: AppRecord[], depth: number) => {
    for (const record of records) {
      const id = recordIdOf(record)
      const state = children[id]
      rows.push({
        kind: 'record',
        record,
        depth,
        hasChildren: Boolean(childFlags[id]),
        loading: Boolean(state?.loading),
        error: state?.error ?? null,
      })
      if (!expanded.has(id)) continue
      if (state?.records.length) walk(state.records, depth + 1)
      if (state && state.records.length < state.total) {
        rows.push({
          kind: 'more',
          parentId: id,
          depth: depth + 1,
          loaded: state.records.length,
          total: state.total,
          loading: state.loading,
        })
      }
    }
  }
  walk(roots, 0)
  return rows
}

/** 层级视图：可展开的层级树或树形表格，子级按需加载并支持分支分页。 */
export function HierarchyView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick, onOpenRecord, onOpenViewSettings} = props
  const [mode, setMode] = React.useState<AppViewHierarchyMode>(view.config.hierarchyMode ?? 'TREE')
  const [page, setPage] = React.useState(1)
  const [size, setSize] = React.useState(ROOT_PAGE_SIZE)
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  const [children, setChildren] = React.useState<Record<string, ChildState>>({})
  const [childFlags, setChildFlags] = React.useState<Record<string, boolean>>({})
  const requestSequences = React.useRef<Record<string, number>>({})
  const loadedSequences = React.useRef<Record<string, number>>({})

  React.useEffect(() => {
    setMode(view.config.hierarchyMode ?? 'TREE')
  }, [view.config.hierarchyMode])

  const rootKey = `${view.id}|${view.config.parentField ?? ''}|${search}|${JSON.stringify(advancedFilter ?? null)}|${page}|${size}|${JSON.stringify(view.filter)}`
  const query = useViewQuery(appId, form.name, view.id, {
    scope: 'TREE_ROOTS',
    page,
    size,
    search,
    filter: advancedFilter,
  }, refreshTick)

  React.useEffect(() => {
    setExpanded(new Set())
    setChildren({})
    setChildFlags({})
    requestSequences.current = {}
    loadedSequences.current = {}
  }, [rootKey])

  React.useEffect(() => {
    const data = query.data
    if (!data) return
    setChildFlags((previous) => ({...previous, ...(data.childFlags ?? {})}))
  }, [query.data])

  const loadChildren = React.useCallback((parentId: string, nextPage: number): Promise<void> => {
    const sequence = (requestSequences.current[parentId] ?? 0) + 1
    requestSequences.current[parentId] = sequence
    setChildren((previous) => ({
      ...previous,
      [parentId]: {
        records: previous[parentId]?.records ?? [],
        total: previous[parentId]?.total ?? 0,
        page: previous[parentId]?.page ?? 0,
        loading: true,
        error: null,
      },
    }))
    return queryAppView(appId, form.name, view.id, {
      scope: 'TREE_CHILDREN',
      parentId,
      page: nextPage,
      size: CHILD_PAGE_SIZE,
      search,
      filter: advancedFilter,
    }).then((response) => {
      if (requestSequences.current[parentId] !== sequence) return
      loadedSequences.current[parentId] = nextPage
      setChildFlags((previous) => ({...previous, ...(response.childFlags ?? {})}))
      setChildren((previous) => {
        const existing = previous[parentId]
        const records = nextPage === 1
          ? response.list
          : (() => {
            const merged = new Map((existing?.records ?? []).map((record) => [recordIdOf(record), record]))
            for (const record of response.list) merged.set(recordIdOf(record), record)
            return Array.from(merged.values())
          })()
        return {
          ...previous,
          [parentId]: {
            records,
            total: response.total,
            page: nextPage,
            loading: false,
            error: null,
          },
        }
      })
    }).catch((caught: unknown) => {
      if (requestSequences.current[parentId] !== sequence) return
      setChildren((previous) => ({
        ...previous,
        [parentId]: {
          records: previous[parentId]?.records ?? [],
          total: previous[parentId]?.total ?? 0,
          page: previous[parentId]?.page ?? 0,
          loading: false,
          error: toErrorMessage(caught, '加载子级数据失败'),
        },
      }))
    })
  }, [appId, form.name, view.id, search, advancedFilter])

  React.useEffect(() => {
    if (page > Math.max(1, Math.ceil((query.data?.total ?? 0) / size))) setPage(1)
  }, [page, query.data?.total, size])

  const roots = query.data?.list ?? []
  const total = query.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / size))
  const isInitialLoading = query.isLoading && !query.data
  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const titleField = view.config.titleField || form.displayField || 'id'
  const columns = viewDisplayFields(form, view)
    .filter((name) => name !== titleField)
    .map((name) => fieldMap.get(name))
    .filter((field): field is AppFormField => Boolean(field))
  const summaryColumns = columns.slice(0, 2)

  const toggleRecord = (record: AppRecord) => {
    const id = recordIdOf(record)
    if (expanded.has(id)) {
      setExpanded((previous) => {
        const next = new Set(previous)
        next.delete(id)
        return next
      })
      return
    }
    setExpanded((previous) => new Set(previous).add(id))
    const state = children[id]
    if (childFlags[id] && (!state || state.error) && loadedSequences.current[id] == null) {
      void loadChildren(id, 1)
    }
  }

  const rowTitle = (record: AppRecord) => viewTitleValue(form, view, record)
  const rowSummary = (record: AppRecord) => summaryColumns.map((field) => ({
    field,
    text: recordFieldText(field, record[field.name]),
  }))

  if (!view.config.parentField) {
    return (
      <Empty className="min-h-[240px]" description="层级视图需要先在视图设置中选择父节点字段。">
        {onOpenViewSettings && <Button size="sm" onClick={onOpenViewSettings}>去设置父节点字段</Button>}
      </Empty>
    )
  }

  if (query.error && !query.data) {
    return <ViewErrorState message={query.error} onRetry={query.reload}/>
  }

  const emptyState = <Empty className="min-h-[240px]" description="暂无数据"/>

  const rows = buildRows(roots, expanded, children, childFlags)

  const renderChevron = (row: TreeRow) => {
    if (!row.hasChildren) return <span className="inline-block h-5 w-5"/>
    const isExpanded = expanded.has(recordIdOf(row.record))
    return (
      <button
        type="button"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={isExpanded ? '收起子级' : '展开子级'}
        aria-expanded={isExpanded}
        onClick={(event) => {
          event.stopPropagation()
          toggleRecord(row.record)
        }}
      >
        {row.loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin"/>
          : isExpanded ? <ChevronDown className="h-3.5 w-3.5"/> : <ChevronRight className="h-3.5 w-3.5"/>}
      </button>
    )
  }

  const renderRowFeedback = (row: TreeRow | MoreRow) => {
    if (row.kind === 'more') {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="ml-6 h-7 text-xs text-primary"
          disabled={row.loading}
          onClick={() => void loadChildren(row.parentId, (children[row.parentId]?.page ?? 0) + 1)}
        >
          {row.loading ? '加载中…' : `加载更多子级（已显示 ${row.loaded} / 共 ${row.total} 条）`}
        </Button>
      )
    }
    if (row.error) {
      return (
        <button
          type="button"
          className="ml-6 inline-flex items-center gap-1 text-xs text-destructive hover:underline"
          onClick={() => void loadChildren(recordIdOf(row.record), 1)}
        >
          <AlertTriangle className="h-3 w-3"/>{row.error}，点击重试
        </button>
      )
    }
    return null
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          {(['TREE', 'TABLE'] as AppViewHierarchyMode[]).map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                'rounded-md px-3 py-1 text-xs transition-colors',
                mode === item ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setMode(item)}
            >
              {item === 'TREE' ? '层级树' : '树形表格'}
            </button>
          ))}
        </div>
        <Button
          variant="outline" size="sm" className="h-7 text-xs"
          disabled={!expanded.size}
          onClick={() => setExpanded(new Set())}
        >
          收起全部
        </Button>
        <span className="text-xs text-muted-foreground">共 {total} 个根节点</span>
        {query.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground"/>}
      </div>

      {query.error && <ViewInlineError message={query.error} onRetry={query.reload}/>}

      <div
        className={cn('relative min-h-0 flex-1', mode === 'TREE' ? 'overflow-y-auto record-list-scroll' : 'overflow-hidden')}>
        <ViewFetchingBar active={query.isFetching && !query.isLoading}/>
        {isInitialLoading ? (
          mode === 'TREE' ? <ViewSkeleton variant="list" rows={8}/> : <ViewSkeleton variant="table" rows={8}/>
        ) : !rows.length ? (
          emptyState
        ) : mode === 'TREE' ? (
          <ul role="tree" aria-label="层级结构" className="space-y-0.5 py-1">
            {rows.map((row) => {
              if (row.kind === 'more') {
                return (
                  <li key={`more-${row.parentId}`} role="none" style={{paddingLeft: row.depth * 20}}>
                    {renderRowFeedback(row)}
                  </li>
                )
              }
              const id = recordIdOf(row.record)
              const isExpanded = expanded.has(id)
              return (
                <li key={id} role="treeitem" aria-level={row.depth + 1}
                    aria-expanded={row.hasChildren ? isExpanded : undefined}
                    data-hierarchy-record={id}>
                  <div
                    className={cn(
                      'flex items-center gap-1 rounded-md py-1 pr-2 transition-colors hover:bg-muted/50',
                      row.error && 'bg-destructive/5',
                    )}
                    style={{paddingLeft: row.depth * 20 + 4}}
                  >
                    {renderChevron(row)}
                    {row.record._anomaly === true && (
                      <span className="shrink-0" title="关联异常">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500"/>
                      </span>
                    )}
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground hover:text-primary hover:underline"
                      title={rowTitle(row.record)}
                      onClick={() => onOpenRecord(id)}
                    >
                      {rowTitle(row.record)}
                    </button>
                    <span className="hidden min-w-0 shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
                      {rowSummary(row.record).map(({field, text}) => (
                        <span key={field.name} className="max-w-[180px] truncate"
                              title={`${layoutFieldLabel(form, field.name, field.label)}：${text}`}>
                          {text}
                        </span>
                      ))}
                    </span>
                  </div>
                  {renderRowFeedback(row)}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="app-table-scroll record-list-scroll h-full overflow-auto">
            <table className="app-table record-list-table table-fixed bg-background"
                   style={{minWidth: 260 + columns.length * 160}}>
              <colgroup>
                <col style={{width: 260}}/>
                {columns.map((column) => <col key={column.name}/>)}
              </colgroup>
              <thead>
              <tr>
                <th>层级</th>
                {columns.map((column) => (
                  <th key={column.name}>{layoutFieldLabel(form, column.name, column.label)}</th>
                ))}
              </tr>
              </thead>
              <tbody>
              {rows.map((row) => {
                if (row.kind === 'more') {
                  return (
                    <tr key={`more-${row.parentId}`}>
                      <td colSpan={columns.length + 1}>
                        {renderRowFeedback(row)}
                      </td>
                    </tr>
                  )
                }
                const id = recordIdOf(row.record)
                return (
                  <tr key={id} className={cn('transition-colors hover:bg-muted/40', row.error && 'bg-destructive/5')}>
                    <td>
                      <div className="flex items-center gap-1" style={{paddingLeft: row.depth * 20}}>
                        {renderChevron(row)}
                        {row.record._anomaly === true && (
                          <span className="shrink-0" title="关联异常">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500"/>
                          </span>
                        )}
                        <button
                          type="button"
                          className="min-w-0 truncate text-left font-medium text-primary hover:underline"
                          title={rowTitle(row.record)}
                          onClick={() => onOpenRecord(id)}
                        >
                          {rowTitle(row.record)}
                        </button>
                      </div>
                      {renderRowFeedback(row)}
                    </td>
                    {columns.map((column) => (
                      <td key={column.name}>
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap"
                             title={recordFieldText(column, row.record[column.name])}>
                          {recordFieldText(column, row.record[column.name])}
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isInitialLoading && total > 0 && (
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

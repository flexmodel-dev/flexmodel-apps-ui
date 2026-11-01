import * as React from 'react'
import ReactECharts from 'echarts-for-react'
import 'echarts'
import {AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Network} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Empty} from '@/components/ui/empty'
import {AppLoading} from '@/components/biz/AppLoading'
import {useViewQuery} from '@/components/biz/views/useViewQuery'
import {type ViewComponentProps, viewDisplayFields, viewTitleValue} from '@/components/biz/views/types'
import {queryAppView} from '@/services/appViews'
import type {AppFormField} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import {formatFieldValue} from '@/lib/fieldConfig'
import {toErrorMessage} from '@/lib/utils'

interface HierarchyTreeNode {
  name: string
  recordId: string
  value: AppRecord
  children: HierarchyTreeNode[]
  itemStyle?: { color: string }
}

interface HierarchyRow {
  record: AppRecord
  depth: number
}

function recordIdOf(record: AppRecord): string {
  return String(record.id)
}

function toTreeNode(record: AppRecord, title: string): HierarchyTreeNode {
  const node: HierarchyTreeNode = {name: title, recordId: recordIdOf(record), value: record, children: []}
  if (record._anomaly === true) node.itemStyle = {color: '#f59e0b'}
  return node
}

function withChildrenInserted(
  nodes: HierarchyTreeNode[],
  parentId: string,
  children: HierarchyTreeNode[],
): HierarchyTreeNode[] {
  return nodes.map((node) => {
    if (node.recordId !== parentId) {
      return node.children.length
        ? {...node, children: withChildrenInserted(node.children, parentId, children)}
        : node
    }
    return {...node, children}
  })
}

function flattenRows(
  roots: AppRecord[],
  childrenByParent: Record<string, AppRecord[]>,
  expanded: Set<string>,
): HierarchyRow[] {
  const rows: HierarchyRow[] = []
  const walk = (records: AppRecord[], depth: number) => {
    for (const record of records) {
      rows.push({record, depth})
      const id = recordIdOf(record)
      if (expanded.has(id)) walk(childrenByParent[id] ?? [], depth + 1)
    }
  }
  walk(roots, 0)
  return rows
}

function cellText(field: AppFormField, value: unknown): string {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    const reference = value as { displayValue?: unknown; id?: unknown }
    if (reference.displayValue != null && reference.displayValue !== '') return String(reference.displayValue)
    return reference.id != null ? String(reference.id) : '-'
  }
  return formatFieldValue(field, value)
}

/** 层级视图：TREE 形态用 ECharts 树懒加载展开，TABLE 形态自绘树形表格。 */
export function HierarchyView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick, onOpenRecord} = props
  const isTable = (view.config.hierarchyMode ?? 'TREE') === 'TABLE'
  const size = isTable ? 50 : 200

  const [page, setPage] = React.useState(1)
  const [tree, setTree] = React.useState<HierarchyTreeNode[]>([])
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  const [childrenByParent, setChildrenByParent] = React.useState<Record<string, AppRecord[]>>({})
  const [childFlags, setChildFlags] = React.useState<Record<string, boolean>>({})
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const loadedParents = React.useRef<Set<string>>(new Set())
  const pendingParents = React.useRef<Set<string>>(new Set())

  const query = useViewQuery(appId, form.name, view.id, {
    scope: 'TREE_ROOTS',
    page,
    size,
    search,
    filter: advancedFilter,
  }, refreshTick)

  React.useEffect(() => {
    const data = query.data
    if (!data) return
    setChildFlags(data.childFlags ?? {})
    setTree(data.list.map((record) => toTreeNode(record, viewTitleValue(form, view, record))))
    setExpanded(new Set())
    setChildrenByParent({})
    setLoadError(null)
    loadedParents.current = new Set()
    pendingParents.current = new Set()
  }, [query.data, form, view])

  const loadChildren = React.useCallback((parentId: string): Promise<AppRecord[]> => {
    return queryAppView(appId, form.name, view.id, {
      scope: 'TREE_CHILDREN',
      parentId,
      page: 1,
      size: 200,
      search,
      filter: advancedFilter,
    }).then((response) => {
      setChildFlags((previous) => ({...previous, ...(response.childFlags ?? {})}))
      return response.list
    })
  }, [appId, form.name, view.id, search, advancedFilter])

  const fetchChildren = (parentId: string): Promise<AppRecord[]> => {
    if (pendingParents.current.has(parentId)) return Promise.resolve([])
    pendingParents.current.add(parentId)
    return loadChildren(parentId)
      .then((records) => {
        loadedParents.current.add(parentId)
        return records
      })
      .catch((caught: unknown) => {
        setLoadError(toErrorMessage(caught, '加载子级数据失败'))
        return []
      })
      .finally(() => {
        pendingParents.current.delete(parentId)
      })
  }

  const handleNodeClick = (params: Record<string, unknown>) => {
    const node = params.data as HierarchyTreeNode | undefined
    if (!node) return
    const id = node.recordId
    if (childFlags[id] && !loadedParents.current.has(id)) {
      fetchChildren(id).then((records) => {
        setTree((previous) => withChildrenInserted(
          previous,
          id,
          records.map((record) => toTreeNode(record, viewTitleValue(form, view, record))),
        ))
      })
    } else {
      onOpenRecord(id)
    }
  }

  const toggleRow = (record: AppRecord) => {
    const id = recordIdOf(record)
    if (!childFlags[id]) return
    if (expanded.has(id)) {
      setExpanded((previous) => {
        const next = new Set(previous)
        next.delete(id)
        return next
      })
      return
    }
    if (childrenByParent[id]) {
      setExpanded((previous) => new Set(previous).add(id))
      return
    }
    fetchChildren(id).then((records) => {
      if (!records.length) return
      setChildrenByParent((previous) => ({...previous, [id]: records}))
      setExpanded((previous) => new Set(previous).add(id))
    })
  }

  if (!view.config.parentField) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Empty
          image={<Network className="h-11 w-16"/>}
          description="层级视图需要先在视图设置中选择父节点字段"
        />
      </div>
    )
  }

  const errorMessage = query.error ?? loadError
  if (errorMessage) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4">
        <AlertTriangle className="h-5 w-5 text-destructive"/>
        <span className="text-sm text-destructive">{errorMessage}</span>
      </div>
    )
  }

  if (query.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <AppLoading center className="min-h-[240px]"/>
      </div>
    )
  }

  const roots = query.data?.list ?? []
  if (!roots.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Empty description="暂无数据"/>
      </div>
    )
  }

  if (!isTable) {
    const treeOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: Record<string, unknown>) => {
          const node = params.data as HierarchyTreeNode | undefined
          if (!node) return ''
          return node.value._anomaly === true ? `${node.name}（关联异常）` : node.name
        },
      },
      series: [{
        type: 'tree',
        data: tree,
        orient: 'LR',
        initialTreeDepth: 2,
        label: {position: 'left', fontSize: 12},
        leaves: {label: {position: 'right'}},
        expandAndCollapse: false,
        symbolSize: 8,
      }],
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="record-list-scroll min-h-0 flex-1 overflow-auto">
          <ReactECharts
            option={treeOption}
            style={{height: '100%', minHeight: 320}}
            opts={{renderer: 'svg'}}
            onEvents={{click: handleNodeClick}}
          />
        </div>
      </div>
    )
  }

  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const columns = viewDisplayFields(form, view)
    .map((name) => fieldMap.get(name))
    .filter((field): field is AppFormField => Boolean(field))
  const rows = flattenRows(roots, childrenByParent, expanded)
  const total = query.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / size))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="record-list-scroll min-h-0 flex-1 overflow-auto">
        <table
          className="app-table record-list-table table-fixed bg-background"
          style={{minWidth: 220 + columns.length * 160}}
        >
          <colgroup>
            <col style={{width: 220}}/>
            {columns.map((column) => (
              <col key={column.name}/>
            ))}
          </colgroup>
          <thead>
          <tr>
            <th>{form.layout.items.find((item) => item.type === 'FIELD' && item.name === view.config.titleField)?.label?.trim() || '标题'}</th>
            {columns.map((column) => (
              <th key={column.name}>
                {form.layout.items.find((item) => item.type === 'FIELD' && item.name === column.name)?.label?.trim() || column.label}
              </th>
            ))}
          </tr>
          </thead>
          <tbody>
          {rows.map((row) => {
            const id = recordIdOf(row.record)
            const hasChildren = Boolean(childFlags[id])
            const isExpanded = expanded.has(id)
            const title = viewTitleValue(form, view, row.record)
            return (
              <tr key={id} className="transition-colors hover:bg-muted/40">
                <td>
                  <div className="flex items-center gap-1" style={{paddingLeft: row.depth * 20}}>
                    <button
                      type="button"
                      className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-60"
                      disabled={!hasChildren}
                      onClick={() => toggleRow(row.record)}
                      title={hasChildren ? (isExpanded ? '收起' : '展开') : undefined}
                    >
                      {hasChildren
                        ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5"/> :
                          <ChevronRight className="h-3.5 w-3.5"/>)
                        : <span className="inline-block h-3.5 w-3.5"/>}
                    </button>
                    {row.record._anomaly === true && (
                      <span className="shrink-0" title="关联异常">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500"/>
                      </span>
                    )}
                    <button
                      type="button"
                      className="min-w-0 truncate text-left font-medium text-primary hover:underline"
                      title={title}
                      onClick={() => onOpenRecord(id)}
                    >
                      {title}
                    </button>
                  </div>
                </td>
                {columns.map((column) => (
                  <td key={column.name}>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                      {cellText(column, row.record[column.name])}
                    </div>
                  </td>
                ))}
              </tr>
            )
          })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5"/>上一页
        </Button>
        <span className="text-sm text-muted-foreground">第 {page} / {pages} 页</span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
          下一页<ChevronRight className="h-3.5 w-3.5"/>
        </Button>
      </div>
    </div>
  )
}

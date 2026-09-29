import * as React from 'react'
import { Search, X } from 'lucide-react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
import {Pagination} from '@/components/biz/Pagination'
import {AppNoData} from '@/components/biz/AppLoading'
import { cn, paginate } from '@/lib/utils'

export interface AdminColumn<T> {
  key: keyof T & string
  label: string
  render?: (row: T) => React.ReactNode
  width?: number
}

/** 管理中心通用列表页（分页卡片表格） */
export function AdminTablePage<T extends { id: string }>({
  title,
  desc,
  bare = false,
  rows,
  columns,
  toolbar,
  rowActions,
}: {
  title: string
  desc?: string
  bare?: boolean
  rows: T[]
  columns: AdminColumn<T>[]
  toolbar?: React.ReactNode
  rowActions?: (row: T) => React.ReactNode
}) {
  const [page, setPage] = React.useState(1)
  const [size, setSize] = React.useState(30)
  const [q, setQ] = React.useState('')
  const filtered = rows.filter((r) => Object.values(r).some((v) => String(v ?? '').includes(q)))
  const { rows: pageRows, pages, total } = paginate(filtered, page, size)

  const content = (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="m-0 truncate text-base font-semibold">{title}</h4>
            {desc && <p className="mb-0 mt-0.5 text-xs text-muted-foreground">{desc}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 w-full md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-9 w-full rounded-full border border-input bg-background pl-9 pr-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
                placeholder="搜索"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
              />
              {q && (
                <button
                  type="button"
                  onClick={() => {
                    setQ('')
                    setPage(1)
                  }}
                  className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title="清空搜索"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {toolbar && (
              <div className="flex shrink-0 items-center gap-2 [&>button]:h-9">
                {toolbar}
              </div>
            )}
          </div>
        </div>
      <div className="app-table-scroll overflow-x-auto p-4">
        <table className="app-table w-full min-w-[760px]">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                    {c.label}
                  </th>
                ))}
                {rowActions && <th className="w-[150px]">操作</th>}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : String(row[c.key] ?? '-')}</td>
                  ))}
                  {rowActions && <td>{rowActions(row)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        {pageRows.length === 0 && <AppNoData/>}
          <div className="mt-3 flex justify-end">
            <Pagination page={page} pages={pages} total={total} size={size} onChange={setPage} />
          </div>
        </div>
      </div>
  )

  if (bare) return content

  return (
    <AdminLayout>
      {content}
    </AdminLayout>
  )
}

export { Button, cn }

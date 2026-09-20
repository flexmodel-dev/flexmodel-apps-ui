import * as React from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/rb/Pagination'
import { RbNoData } from '@/components/rb/RbLoading'
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
  adminActive,
  bare = false,
  rows,
  columns,
  toolbar,
  rowActions,
}: {
  title: string
  desc?: string
  adminActive?: string
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h4 className="m-0 text-base font-medium">{title}</h4>
            {desc && <p className="mb-0 mt-0.5 text-xs text-muted-foreground">{desc}</p>}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="h-10 w-[200px] rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="搜索"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
            />
            {toolbar}
          </div>
        </div>
        <div className="rb-table-scroll overflow-x-auto p-4">
          <table className="rb-table w-full min-w-[760px]">
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
          {pageRows.length === 0 && <RbNoData />}
          <div className="mt-3 flex justify-end">
            <Pagination page={page} pages={pages} total={total} size={size} onChange={setPage} />
          </div>
        </div>
      </div>
  )

  if (bare) return content

  return (
    <AppLayout admin adminActive={adminActive}>
      {content}
    </AppLayout>
  )
}

export { Button, cn }

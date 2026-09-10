import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { UserAvatar } from '@/components/ui/avatar'
import { Pagination } from '@/components/rb/Pagination'
import { RbNoData } from '@/components/rb/RbLoading'
import { getEntity, getRecords } from '@/data/mock'
import { cn, paginate } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** 记录列表页（复刻 general/record-list.html + rb-datalist） */
export default function RecordList() {
  const { entity } = useParams<{ entity: string }>()
  const navigate = useNavigate()
  const meta = getEntity(entity ?? 'Customer')
  const [rows, setRows] = React.useState(() => getRecords(entity ?? 'Customer'))
  const [q, setQ] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [size] = React.useState(10)
  const [selected, setSelected] = React.useState<string[]>([])
  const [sortKey, setSortKey] = React.useState('')
  const [sortAsc, setSortAsc] = React.useState(true)
  const [filterName, setFilterName] = React.useState('全部数据')

  // 过滤 + 排序（hooks 须在条件返回之前）
  React.useEffect(() => {
    if (!meta) return
    const base = getRecords(meta.name)
    let f = q ? base.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q.toLowerCase()))) : base
    if (sortKey) {
      f = [...f].sort((a, b) => {
        const av = a[sortKey] ?? ''
        const bv = b[sortKey] ?? ''
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'zh')
        return sortAsc ? cmp : -cmp
      })
    }
    setRows(f)
    setPage(1)
  }, [q, sortKey, sortAsc, meta])

  if (!meta) return <AppLayout>未知实体</AppLayout>

  const columns = meta.fields.filter((f) => f.type !== 'DATETIME' || f.name.endsWith('On'))

  const { rows: pageRows, pages, total } = paginate(rows, page, size)

  const toggleAll = () => setSelected(selected.length === pageRows.length ? [] : pageRows.map((r) => r.id))
  const toggleOne = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const sortBy = (key: string) => {
    if (sortKey === key) setSortAsc((a) => !a)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const renderCell = (row: Record<string, unknown>, fieldName: string) => {
    const field = meta.fields.find((f) => f.name === fieldName)!
    const v = row[fieldName]
    if (v === undefined || v === null || v === '') return <span className="text-[#ccc]">-</span>
    if (field.type === 'REFERENCE' && field.refEntity === 'User') {
      return (
        <span className="flex items-center gap-1.5">
          <UserAvatar name={String(v)} size={20} />
          {String(v)}
        </span>
      )
    }
    if (field.type === 'SELECT') {
      const opt = field.options?.find((o) => o.text === v)
      return (
        <span
          className="inline-flex items-center gap-1"
        >
          <i className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: opt?.color ?? '#999' }} />
          {String(v)}
        </span>
      )
    }
    if (field.type === 'REFERENCE') {
      return <span className="text-primary">{String(v)}</span>
    }
    if (field.type === 'DECIMAL' || field.type === 'NUMBER') {
      return Number(v).toLocaleString()
    }
    if (field.type === 'EMAIL') {
      return <span className="text-primary">{String(v)}</span>
    }
    return String(v)
  }

  return (
    <AppLayout>
      {/* 实体页签 */}
      <ul className="nav nav-tabs-classic mb-0 flex list-none items-center gap-1 border-b border-[#e3e3e3] pb-0 dark:border-[#2e3340]">
        {['Customer', 'Opportunity', 'Product'].map((e) => {
          const m = getEntity(e)!
          return (
            <li key={e}>
              <Link
                to={`/app/${e}/list`}
                className={cn(
                  '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground',
                  e === meta.name ? 'border-primary text-foreground' : 'border-transparent'
                )}
              >
                <i className={cn('icon zmdi', `zmdi-${m.icon}`)} />
                {m.label}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="mt-[-1px] rounded-b-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-3">
          {/* 表头工具行 */}
          <div className="rb-datatable-header mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* 常用查询 */}
              <div className="flex">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="rounded-r-none !pr-2" title="常用查询">
                      <span className="max-w-[140px] truncate">{filterName}</span>
                      <i className="icon zmdi zmdi-caret-down text-[16px]" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setFilterName('全部数据')}>全部数据</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterName('我的数据')}>我的数据</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterName('本部门数据')}>本部门数据</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="secondary" className="rounded-l-none border-l border-[#d5d5d5]" title="高级查询">
                  <i className="icon mdi mdi-filter text-[17px]" />
                </Button>
              </div>
              {/* 快速查询 */}
              <div className="flex">
                <Input
                  placeholder={`快速查询${meta.label}`}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-[220px] rounded-r-none"
                />
                <Button variant="secondary" className="rounded-l-none border-l border-[#d5d5d5]">
                  <i className="icon zmdi zmdi-search" />
                </Button>
              </div>
            </div>

            {/* 右侧操作 */}
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={!selected.length} onClick={() => navigate(`/app/${meta.name}/view/${selected[0]}`)}>
                <i className="icon mdi mdi-folder-open text-[17px]" /> 打开
              </Button>
              <Button variant="secondary" disabled={!selected.length}>
                <i className="icon zmdi zmdi-edit text-[16px]" /> 编辑
              </Button>
              <Button onClick={() => navigate(`/app/${meta.name}/form`)}>
                <i className="icon zmdi zmdi-plus text-[16px]" /> 新建
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
                    更多 <i className="icon zmdi zmdi-more-vert text-[16px]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem><i className="icon zmdi zmdi-delete text-[16px]" /> 删除</DropdownMenuItem>
                  <DropdownMenuItem><i className="icon zmdi zmdi-mail-reply-all text-[16px]" /> 分配</DropdownMenuItem>
                  <DropdownMenuItem><i className="icon zmdi zmdi-portable-wifi text-[16px]" /> 共享</DropdownMenuItem>
                  <DropdownMenuItem><i className="icon zmdi zmdi-portable-wifi-off text-[16px]" /> 取消共享</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem><i className="icon mdi mdi-microsoft-excel text-[16px]" /> 数据导出</DropdownMenuItem>
                  <DropdownMenuItem><i className="icon mdi mdi-table-arrow-right text-[16px]" /> 数据导入</DropdownMenuItem>
                  <DropdownMenuItem><i className="icon mdi mdi-playlist-edit text-[16px]" /> 批量修改</DropdownMenuItem>
                  <DropdownMenuItem><i className="icon mdi mdi-view-column-outline text-[16px]" /> 列显示</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* 数据表格 */}
          <div className="data-list overflow-x-auto">
            <table className="rb-table w-full min-w-[900px] border-collapse bg-background">
              <thead>
                <tr>
                  <th className="w-[36px]">
                    <Checkbox checked={pageRows.length > 0 && selected.length === pageRows.length} onCheckedChange={toggleAll} />
                  </th>
                  {columns.map((c) => (
                    <th key={c.name} className="cursor-pointer select-none hover:text-primary" onClick={() => sortBy(c.name)}>
                      {c.label}
                      {sortKey === c.name && (
                        <i className={cn('zmdi ml-1 text-[12px] not-italic', sortAsc ? 'zmdi-long-arrow-down' : 'zmdi-long-arrow-up')} />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className={cn(selected.includes(row.id) && 'bg-primary/10')}>
                    <td>
                      <Checkbox checked={selected.includes(row.id)} onCheckedChange={() => toggleOne(row.id)} />
                    </td>
                    {columns.map((c, i) => (
                      <td key={c.name}>
                        {i === 0 ? (
                          <Link
                            to={`/app/${meta.name}/view/${row.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {renderCell(row, c.name)}
                          </Link>
                        ) : (
                          renderCell(row, c.name)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {pageRows.length === 0 && <RbNoData text="暂无数据" />}
          </div>

          {/* 分页 */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">已选择 {selected.length} 项</span>
            <Pagination page={page} pages={pages} total={total} size={size} onChange={setPage} />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

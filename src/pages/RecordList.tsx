import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Columns3,
  Edit,
  FileInput,
  FileSpreadsheet,
  Filter,
  FolderOpen,
  ListChecks,
  MoreVertical,
  Plus,
  ReplyAll,
  Search,
  Share,
  ScreenShareOff,
  Trash2,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { UserAvatar } from '@/components/ui/avatar'
import {Pagination} from '@/components/biz/Pagination'
import {AppNoData} from '@/components/biz/AppLoading'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { RecordDetailContent } from '@/pages/RecordView'
import {getAppMenuItem, getBusinessObject, getRecords} from '@/data/mock'
import { cn, paginate } from '@/lib/utils'
import {RecordFormModal} from '@/components/biz/RecordFormModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** 记录列表页（复刻 general/record-list.html + app-datalist） */
export default function RecordList() {
  const { appId, menuId } = useParams<{ appId: string; menuId: string }>()
  const menuItem = getAppMenuItem(appId, menuId)
  const meta = getBusinessObject(menuItem?.businessObjectId ?? '')
  const [rows, setRows] = React.useState(() => getRecords(menuItem?.businessObjectId ?? ''))
  const [q, setQ] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [size] = React.useState(30)
  const [selected, setSelected] = React.useState<string[]>([])
  const [sortKey, setSortKey] = React.useState('')
  const [sortAsc, setSortAsc] = React.useState(true)
  const [filterName, setFilterName] = React.useState('全部数据')
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [formRecordId, setFormRecordId] = React.useState<string | null>(null)
  const [refreshTick, setRefreshTick] = React.useState(0)

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
  }, [q, sortKey, sortAsc, meta, refreshTick])

  React.useEffect(() => {
    setSelected([])
    setDetailId(null)
    setFormOpen(false)
    setFormRecordId(null)
    setQ('')
    setSortKey('')
    setSortAsc(true)
  }, [appId, menuId])

  if (!meta) return <AppLayout>未知业务对象</AppLayout>

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
    if (field.type === 'REFERENCE' && field.refBusinessObject === 'User') {
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
    <AppLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
      {/* 业务对象页签 */}
      <ul className="nav nav-tabs-classic mb-0 flex list-none items-center gap-1 border-b border-[#e3e3e3] pb-0 dark:border-[#2e3340]">
        {(menuItem ? [menuItem] : []).map((item) => {
          const m = getBusinessObject(item.businessObjectId)!
          return (
            <li key={item.id}>
              <Link
                to={`/app/${appId}/${item.id}`}
                className={cn(
                  '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground',
                  item.businessObjectId === meta.name ? 'border-primary text-foreground' : 'border-transparent'
                )}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="mt-[-1px] flex min-h-0 flex-1 flex-col rounded-b-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex min-h-0 flex-1 flex-col p-3">
          {/* 表头工具行 */}
          <div className="app-datatable-header mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* 常用查询 */}
              <div className="flex">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="rounded-r-none !pr-2" title="常用查询">
                      <span className="max-w-[140px] truncate">{filterName}</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setFilterName('全部数据')}>全部数据</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterName('我的数据')}>我的数据</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterName('本部门数据')}>本部门数据</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="secondary" className="rounded-l-none border-l border-[#d5d5d5]" title="高级查询">
                  <Filter className="h-4 w-4" />
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
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 右侧操作 */}
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={!selected.length} onClick={() => setDetailId(selected[0])}>
                <FolderOpen className="h-4 w-4" /> 打开
              </Button>
              <Button
                variant="secondary"
                disabled={selected.length !== 1}
                title={selected.length === 1 ? '编辑选中记录' : '请选择一条记录'}
                onClick={() => {
                  setFormRecordId(selected[0] ?? null)
                  setFormOpen(true)
                }}
              >
                <Edit className="h-4 w-4" /> 编辑
              </Button>
              <Button
                onClick={() => {
                  setFormRecordId(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="h-4 w-4" /> 新建
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
                    更多 <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem><Trash2 className="h-4 w-4" /> 删除</DropdownMenuItem>
                  <DropdownMenuItem><ReplyAll className="h-4 w-4" /> 分配</DropdownMenuItem>
                  <DropdownMenuItem><Share className="h-4 w-4" /> 共享</DropdownMenuItem>
                  <DropdownMenuItem><ScreenShareOff className="h-4 w-4" /> 取消共享</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem><FileSpreadsheet className="h-4 w-4" /> 数据导出</DropdownMenuItem>
                  <DropdownMenuItem><FileInput className="h-4 w-4" /> 数据导入</DropdownMenuItem>
                  <DropdownMenuItem><ListChecks className="h-4 w-4" /> 批量修改</DropdownMenuItem>
                  <DropdownMenuItem><Columns3 className="h-4 w-4" /> 列显示</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* 数据表格 */}
          <div className="data-list app-table-scroll min-h-0 flex-1 overflow-x-auto">
            <table className="app-table w-full min-w-[900px] border-collapse bg-background">
              <thead>
                <tr>
                  <th className="w-[36px]">
                    <Checkbox checked={pageRows.length > 0 && selected.length === pageRows.length} onCheckedChange={toggleAll} />
                  </th>
                  {columns.map((c) => (
                    <th key={c.name} className="cursor-pointer select-none hover:text-primary" onClick={() => sortBy(c.name)}>
                      {c.label}
                      {sortKey === c.name && (
                        sortAsc ? <ArrowDown className="ml-1 h-3 w-3" /> : <ArrowUp className="ml-1 h-3 w-3" />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn('cursor-pointer transition-colors hover:bg-muted/40', selected.includes(row.id) && 'bg-primary/10')}
                    onClick={() => setDetailId(row.id)}
                  >
                    <td onClick={(event) => event.stopPropagation()}>
                      <Checkbox checked={selected.includes(row.id)} onCheckedChange={() => toggleOne(row.id)} />
                    </td>
                    {columns.map((c, i) => (
                      <td key={c.name}>
                        {renderCell(row, c.name)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {pageRows.length === 0 && <AppNoData text="暂无数据"/>}
          </div>

          {/* 分页 */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">已选择 {selected.length} 项</span>
            <Pagination page={page} pages={pages} total={total} size={size} onChange={setPage} />
          </div>
        </div>
      </div>

      <Drawer open={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)}>
        <DrawerContent className="w-full overflow-y-auto md:w-[calc(100vw-16rem)]">
          <div className="p-4 md:p-5">
            {detailId && (
              <RecordDetailContent
                businessObject={meta.name}
                id={detailId}
                onDeleted={() => setDetailId(null)}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <RecordFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        businessObject={meta.name}
        recordId={formRecordId}
        onSaved={() => setRefreshTick((tick) => tick + 1)}
      />
    </AppLayout>
  )
}

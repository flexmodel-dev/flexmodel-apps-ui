import * as React from 'react'
import {useParams} from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowRightLeft,
  Columns3,
  Edit,
  FileInput,
  FileSpreadsheet,
  Filter,
  ListChecks,
  Plus,
  Search,
  Share,
  Settings,
  Trash2,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {BizDialog} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { UserAvatar } from '@/components/ui/avatar'
import {Pagination} from '@/components/biz/Pagination'
import {Empty} from '@/components/ui/empty'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { RecordDetailContent } from '@/pages/RecordView'
import {getAppMenuItem, getBusinessObject, getRecords} from '@/data/mock'
import { cn, paginate } from '@/lib/utils'
import {RecordFormModal} from '@/components/biz/RecordFormModal'

const defaultViewTabs = ['全部']
const compactButtonClass = 'h-8 px-2.5 text-xs'

/** 记录列表页（复刻 general/record-list.html + app-datalist） */
export default function RecordList({businessObjectId}: { businessObjectId?: string }) {
  const { appId, menuId } = useParams<{ appId: string; menuId: string }>()
  const menuItem = getAppMenuItem(appId, menuId)
  const resolvedBusinessObjectId = businessObjectId ?? menuItem?.businessObjectId ?? ''
  const meta = getBusinessObject(resolvedBusinessObjectId)
  const [rows, setRows] = React.useState(() => getRecords(resolvedBusinessObjectId))
  const [q, setQ] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [size, setSize] = React.useState(20)
  const [selected, setSelected] = React.useState<string[]>([])
  const [sortKey, setSortKey] = React.useState('')
  const [sortAsc, setSortAsc] = React.useState(true)
  const [filterName, setFilterName] = React.useState('全部')
  const [viewTabs, setViewTabs] = React.useState(defaultViewTabs)
  const [tabsConfigOpen, setTabsConfigOpen] = React.useState(false)
  const [draftTabs, setDraftTabs] = React.useState(defaultViewTabs)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const searchAreaRef = React.useRef<HTMLDivElement>(null)
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [formRecordId, setFormRecordId] = React.useState<string | null>(null)
  const [refreshTick, setRefreshTick] = React.useState(0)

  React.useEffect(() => {
    if (!searchOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (searchAreaRef.current && !searchAreaRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [searchOpen])

  const openTabsConfig = () => {
    setDraftTabs(viewTabs)
    setTabsConfigOpen(true)
  }

  const updateDraftTab = (index: number, label: string) => {
    setDraftTabs((tabs) => tabs.map((tab, tabIndex) => (tabIndex === index ? label : tab)))
  }

  const addDraftTab = () => {
    setDraftTabs((tabs) => [...tabs, '新页签'])
  }

  const removeDraftTab = (index: number) => {
    setDraftTabs((tabs) => (tabs.length > 1 ? tabs.filter((_, tabIndex) => tabIndex !== index) : tabs))
  }

  const saveTabsConfig = () => {
    const nextTabs = Array.from(new Set(draftTabs.map((tab) => tab.trim()).filter(Boolean)))
    if (!nextTabs.length) return
    setViewTabs(nextTabs)
    if (!nextTabs.includes(filterName)) setFilterName(nextTabs[0])
    setTabsConfigOpen(false)
  }

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
      <div
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            {meta.icon ? <meta.icon className="h-5 w-5 shrink-0 text-primary"/> : null}
            <h1 className="truncate text-lg font-semibold text-foreground">{meta.label}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div ref={searchAreaRef} className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                title="搜索"
                aria-label="搜索"
                onClick={() => setSearchOpen((open) => !open)}
              >
                <Search className="h-4 w-4"/>
              </Button>
              {searchOpen && (
                <Input
                  value={q}
                  placeholder={`搜索${meta.label}`}
                  onChange={(event) => setQ(event.target.value)}
                  className="h-8 w-[160px]"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setQ('')
                      setSearchOpen(false)
                    }
                  }}
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                title="高级查询"
                aria-label="高级查询"
              >
                <Filter className="h-4 w-4"/>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                title="列显示"
                aria-label="列显示"
              >
                <Columns3 className="h-4 w-4"/>
              </Button>
            </div>
            <Button
              size="sm"
              className={compactButtonClass}
              onClick={() => {
                setFormRecordId(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4"/> 新建
            </Button>
            <Button variant="secondary" size="sm" className={compactButtonClass}>
              <FileInput className="h-4 w-4"/> 导入
            </Button>
            <Button variant="secondary" size="sm" className={compactButtonClass}>
              <FileSpreadsheet className="h-4 w-4"/> 导出
            </Button>
          </div>
        </div>

        {/* 视图切换 */}
        <div className="flex items-end justify-between border-b-2 border-[#e3e3e3] px-3 dark:border-[#2e3340]">
          <ul className="nav nav-tabs-classic mb-0 flex list-none items-center gap-1">
            {viewTabs.map((label) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => setFilterName(label)}
                  className={cn(
                    '-mb-0.5 inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
                    filterName === label ? 'border-primary text-foreground' : 'border-transparent',
                  )}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <div className="mb-1 flex items-center gap-1">
            <span className="block h-5 w-px shrink-0 bg-muted-foreground/40" aria-hidden="true"/>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="配置页签"
              aria-label="配置页签"
              onClick={openTabsConfig}
            >
              <Settings className="h-4 w-4"/>
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'overflow-hidden border-b bg-card transition-[max-height,opacity] duration-200',
            selected.length ? 'max-h-14 opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            共选择 {selected.length}/{rows.length} 条数据
          </span>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                className={compactButtonClass}
                disabled={selected.length !== 1}
                onClick={() => {
                  setFormRecordId(selected[0] ?? null)
                  setFormOpen(true)
                }}
              >
                <Edit className="h-4 w-4"/> 编辑
              </Button>
              <Button variant="secondary" size="sm" className={compactButtonClass}>
                <Trash2 className="h-4 w-4"/> 删除
              </Button>
              <Button variant="secondary" size="sm" className={compactButtonClass}>
                <Share className="h-4 w-4"/> 共享
              </Button>
              <Button variant="secondary" size="sm" className={compactButtonClass}>
                <ArrowRightLeft className="h-4 w-4"/> 移交
              </Button>
              <Button variant="secondary" size="sm" className={compactButtonClass}>
                <FileSpreadsheet className="h-4 w-4"/> 导出
              </Button>
              <Button variant="secondary" size="sm" className={compactButtonClass}>
                <ListChecks className="h-4 w-4"/> 批量编辑
              </Button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-3">
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
            {pageRows.length === 0 && <Empty description="暂无数据"/>}
          </div>

          {/* 分页 */}
          <div className="mt-2 flex items-center justify-between">
            <Pagination
              page={page}
              pages={pages}
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

      <BizDialog
        open={tabsConfigOpen}
        onOpenChange={setTabsConfigOpen}
        title="配置页签"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setTabsConfigOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={saveTabsConfig} disabled={!draftTabs.some((tab) => tab.trim())}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {draftTabs.map((label, index) => (
            <div key={`${label}-${index}`} className="flex items-center gap-2">
              <Input
                value={label}
                onChange={(event) => updateDraftTab(index, event.target.value)}
                className="h-8"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={draftTabs.length <= 1}
                onClick={() => removeDraftTab(index)}
              >
                <Trash2 className="h-4 w-4"/>
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" className={compactButtonClass} onClick={addDraftTab}>
            <Plus className="h-4 w-4"/> 新增页签
          </Button>
        </div>
      </BizDialog>
    </AppLayout>
  )
}

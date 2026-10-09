import * as React from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import {AppLoading} from '@/components/biz/AppLoading'
import {Empty} from '@/components/ui/empty'
import { approvals, currentUser } from '@/data/mock'
import { cn } from '@/lib/utils'
import {
  CheckCheck,
  ClipboardCheck,
  Inbox,
  RotateCcw,
  Search,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const TABS = [
  { type: 1, text: '待处理' },
  { type: 2, text: '已处理' },
  { type: 3, text: '我提交的' },
  { type: 4, text: '抄送我的' },
]

function statusBadge(status: string) {
  if (status === '待审批') {
    return (
      <Badge className="bg-primary/10 text-primary">待审批</Badge>
    )
  }
  if (status === '已通过') {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
        已通过
      </Badge>
    )
  }
  return (
    <Badge className="border border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
      已驳回
    </Badge>
  )
}

/** 审批中心（参考 approval/home.html 的分类列表布局） */
export default function ApprovalHome() {
  const [tab, setTab] = React.useState(1)
  const [businessObject, setBusinessObject] = React.useState('all')
  const [sort, setSort] = React.useState('newer')
  const [loading, setLoading] = React.useState(true)
  const [selected, setSelected] = React.useState<string[]>([])

  React.useEffect(() => {
    setLoading(true)
    setSelected([])
    const timer = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(timer)
  }, [tab, businessObject, sort])

  const businessObjectOptions = React.useMemo(
    () => Array.from(new Set(approvals.map((item) => item.entityLabel))),
    [],
  )

  const list = React.useMemo(() => {
    const matchesBusinessObject = (item: (typeof approvals)[number]) =>
      businessObject === 'all' || item.entityLabel === businessObject

    let next = approvals.filter(matchesBusinessObject)
    if (tab === 1) next = next.filter((item) => item.status === '待审批')
    if (tab === 2) next = next.filter((item) => item.status !== '待审批')
    if (tab === 3) next = next.filter((item) => item.applicant === currentUser.fullName)
    if (tab === 4) next = next.slice(0, 1)

    return [...next].sort((a, b) =>
      sort === 'newer'
        ? b.submittedOn.localeCompare(a.submittedOn)
        : a.submittedOn.localeCompare(b.submittedOn),
    )
  }, [tab, businessObject, sort])

  const counts = React.useMemo(
    () => ({
      1: approvals.filter((item) => item.status === '待审批').length,
      2: approvals.filter((item) => item.status !== '待审批').length,
      3: approvals.filter((item) => item.applicant === currentUser.fullName).length,
      4: 1,
    }),
    [],
  )

  const allSelected = list.length > 0 && selected.length === list.length
  const toggleAll = () =>
    setSelected(allSelected ? [] : list.map((item) => item.id))
  const toggleOne = (id: string) =>
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    )

  return (
    <AppLayout noPadding noOuterScroll contentClassName="h-full min-h-0">
      <div className="flex h-full min-h-0">
        <aside className="hidden w-[240px] shrink-0 flex-col border-r bg-card md:flex">
          <div className="border-b px-5 pb-5 pt-6">
            <h1 className="m-0 text-xl font-semibold">审批中心</h1>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              集中处理审批、查看进度与结果
            </p>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            {TABS.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => setTab(item.type)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                  tab === item.type
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <ClipboardCheck className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.text}</span>
                <span
                  className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs',
                    tab === item.type ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {counts[item.type as 1 | 2 | 3 | 4]}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-muted/30">
          <div className="shrink-0 border-b bg-card px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="全选/反选"
                />
                <Select value={businessObject} onValueChange={setBusinessObject}>
                  <SelectTrigger className="h-9 w-[176px]">
                    <SelectValue placeholder="业务对象" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部业务对象</SelectItem>
                    {businessObjectOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative hidden lg:block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="h-9 w-[200px] rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                    placeholder="搜索审批内容"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button disabled={!selected.length}>
                  <CheckCheck className="h-4 w-4" />
                  审批 {selected.length > 0 && `(${selected.length})`}
                </Button>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="h-9 w-[126px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newer">最近提交</SelectItem>
                    <SelectItem value="older">最早提交</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" title="重置筛选" onClick={() => {
                  setBusinessObject('all');
                  setSort('newer')
                }}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loading ? (
              <AppLoading center className="min-h-[320px]"/>
            ) : (
              <div className="mx-auto max-w-[1280px] space-y-3">
                {list.map((item) => {
                  const checked = selected.includes(item.id)
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleOne(item.id)}
                      className={cn(
                        'cursor-pointer rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm',
                        checked && 'border-primary/60 bg-primary/5 shadow-sm',
                      )}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(item.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label="选择审批"
                        />

                        <div className="flex min-w-[180px] items-center gap-3 xl:w-[210px]">
                          <UserAvatar name={item.applicant} size={36} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{item.applicant}</div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {item.submittedOn}
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-muted text-muted-foreground">{item.entityLabel}</Badge>
                            <span className="truncate text-sm font-medium text-foreground">
                              {item.recordName}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{item.content}</p>
                          <div className="mt-2 text-xs text-muted-foreground">
                            当前节点：<span className="text-foreground">{item.currentNode}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 xl:w-[180px] xl:flex-col xl:items-end xl:justify-center">
                          {statusBadge(item.status)}
                          <div className="flex items-center gap-2">
                            {item.status === '待审批' ? (
                              <Button
                                size="sm"
                                className="h-8 px-3"
                                onClick={(event) => event.stopPropagation()}
                              >
                                审批
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 px-3"
                                onClick={(event) => event.stopPropagation()}
                              >
                                查看
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {list.length === 0 && (
                  <div className="rounded-xl border bg-card">
                    <Empty
                      description={
                        <>
                          <p className="m-0 font-medium text-foreground">暂无审批</p>
                          <p className="mt-1">当前筛选条件下没有可展示的数据</p>
                        </>
                      }
                    />
                  </div>
                )}

                {list.length > 0 && (
                  <div className="pb-1 text-center text-xs text-muted-foreground">
                    已显示全部 {list.length} 条
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

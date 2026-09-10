import * as React from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { UserAvatar } from '@/components/ui/avatar'
import { RbLoading } from '@/components/rb/RbLoading'
import { approvals } from '@/data/mock'
import { cn } from '@/lib/utils'
import { CheckCheck, ChevronDown } from 'lucide-react'

const TABS = [
  { type: 1, text: '待处理', count: 5 },
  { type: 2, text: '已处理', count: 3 },
  { type: 3, text: '我提交的', count: 3 },
  { type: 4, text: '抄送我的', count: 1 },
]

/** 审批中心（复刻 approval/home.html） */
export default function ApprovalHome() {
  const [tab, setTab] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [selected, setSelected] = React.useState<string[]>([])

  React.useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [tab])

  const list = React.useMemo(() => {
    if (tab === 1) return approvals.filter((a) => a.status === '待审批')
    if (tab === 2) return approvals.filter((a) => a.status !== '待审批')
    if (tab === 3) return approvals.filter((a) => a.applicant === 'admin')
    return approvals.slice(0, 1)
  }, [tab])

  const statusBadge = (s: string) => {
    if (s === '待审批') return <span className="badge-primary">待审批</span>
    if (s === '已通过') return <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-700">已通过</span>
    return <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-600">已驳回</span>
  }

  return (
    <AppLayout noPadding>
      <div className="flex h-full">
        {/* 左侧栏 */}
        <aside className="hidden w-[220px] shrink-0 border-r bg-card md:block">
          <div className="aside-content flex h-full flex-col">
            <div className="content px-[22px] pb-[9px] pt-[17px]">
              <span className="m-0 block text-2xl font-light leading-[27px]">审批中心</span>
            </div>
            <div className="aside-nav py-0">
              <ul className="nav m-0 list-none p-0">
                {TABS.map((t) => (
                  <li key={t.type}>
                    <a
                      className={cn(
                        'flex cursor-pointer items-center justify-between px-[22px] py-[12px] text-[13px]',
                        tab === t.type ? 'font-medium text-primary' : 'text-muted-foreground hover:bg-accent'
                      )}
                      onClick={() => setTab(t.type)}
                    >
                      {t.text}
                      <span className="badge-primary">{t.count}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        {/* 主内容 */}
        <div className="main-content container-fluid min-w-0 flex-1">
          {/* 头部操作 */}
          <div className="file-header">
            <div className="border-b bg-card px-[20px] py-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center" title="全选/反选">
                    <Checkbox
                      checked={selected.length === list.length && list.length > 0}
                      onCheckedChange={() => setSelected(selected.length === list.length ? [] : list.map((a) => a.id))}
                    />
                  </label>
                  <select className="h-8 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
                    <option>业务实体</option>
                    <option>报销单</option>
                    <option>请假单</option>
                    <option>报价单</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button disabled={!selected.length}>
                    <CheckCheck className="h-4 w-4" /> 审批
                  </Button>
                  <Button variant="secondary">
                    默认排序 <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 审批列表 */}
          <div className="approval-viewport p-4">
            {loading ? (
              <RbLoading center />
            ) : (
              <div className="rb-table-scroll overflow-x-auto">
                <table className="rb-table w-full min-w-[760px]">
                  <thead>
                    <tr>
                      <th className="w-[36px]">
                        <Checkbox
                          checked={selected.length === list.length && list.length > 0}
                          onCheckedChange={() => setSelected(selected.length === list.length ? [] : list.map((a) => a.id))}
                        />
                      </th>
                      <th className="w-[90px]">类型</th>
                      <th>审批内容</th>
                      <th className="w-[120px]">申请人</th>
                      <th className="w-[150px]">提交时间</th>
                      <th className="w-[130px]">当前节点</th>
                      <th className="w-[80px]">状态</th>
                      <th className="w-[80px]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((a) => (
                      <tr key={a.id} className={cn(selected.includes(a.id) && 'bg-[#f0f6ff]')}>
                        <td><Checkbox checked={selected.includes(a.id)} onCheckedChange={() => setSelected((s) => (s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]))} /></td>
                        <td><span className="badge-secondary">{a.entityLabel}</span></td>
                        <td>
                          <span className="font-medium">{a.recordName}</span>
                          <div className="text-xs text-muted-foreground">{a.content}</div>
                        </td>
                        <td>
                          <span className="flex items-center gap-1.5">
                            <UserAvatar name={a.applicant} size={20} />
                            {a.applicant}
                          </span>
                        </td>
                        <td className="text-muted-foreground">{a.submittedOn}</td>
                        <td>{a.currentNode}</td>
                        <td>{statusBadge(a.status)}</td>
                        <td>
                          {a.status === '待审批' ? (
                            <Button size="sm" className="!h-8 !px-3">审批</Button>
                          ) : (
                            <Button size="sm" variant="secondary" className="!h-8 !px-3">查看</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {list.length === 0 && <div className="py-14 text-center text-sm text-muted-foreground">暂无数据</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

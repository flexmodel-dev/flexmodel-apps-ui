import * as React from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import {Empty} from '@/components/ui/empty'
import { UserAvatar } from '@/components/ui/avatar'
import { feeds } from '@/data/mock'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  Image,
  MessageSquare,
  Paperclip,
  Smile,
  ThumbsUp,
  UserPlus,
} from 'lucide-react'

/** 动态页（复刻 feeds/home.html：左侧动态流 + 右侧搜索/类型/用户折叠面板） */
export default function FeedsHome() {
  const [type, setType] = React.useState(0)
  const [q, setQ] = React.useState('')
  const [openPanel, setOpenPanel] = React.useState<string[]>(['search'])
  const [commentOpen, setCommentOpen] = React.useState<string[]>([])

  const list = feeds.filter((f) => (type === 0 ? true : f.type === type)).filter((f) => f.content.includes(q))

  const togglePanel = (id: string) => setOpenPanel((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  const Panel = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <button
        type="button"
        className="flex w-full items-center gap-1 px-3 py-2 text-[13px] text-[#555] dark:text-[#ccc]"
        onClick={() => togglePanel(id)}
      >
        {openPanel.includes(id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {openPanel.includes(id) && <div className="card-body px-3 pb-3">{children}</div>}
    </div>
  )

  return (
    <AppLayout>
      <div className="container-smart mx-auto w-full max-w-[1080px]">
        <div className="row flex flex-col gap-5 lg:flex-row">
          {/* 动态流 */}
          <div className="col-lg-8 min-w-0 flex-1">
            {/* 发布框 */}
            <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex gap-3">
                <UserAvatar name="超级管理员" />
                <div className="flex-1">
                  <textarea
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={3}
                    placeholder="分享一些想法吧 ..."
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex gap-3 text-muted-foreground">
                      <a className="cursor-pointer hover:text-primary" title="附件"><Paperclip className="h-4 w-4" /></a>
                      <a className="cursor-pointer hover:text-primary" title="表情"><Smile className="h-4 w-4" /></a>
                      <a className="cursor-pointer hover:text-primary" title="图片"><Image className="h-4 w-4" /></a>
                      <a className="cursor-pointer hover:text-primary" title="提及"><UserPlus className="h-4 w-4" /></a>
                    </div>
                    <Button size="sm">发布</Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 动态列表 */}
            {list.map((f) => (
              <div key={f.id} className="mb-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex gap-3">
                  <UserAvatar name={f.author} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium">{f.author}</span>
                      {f.type === 2 && <span className="badge-secondary">跟进</span>}
                      {f.type === 3 && <span className="badge-secondary">公告</span>}
                      {f.type === 4 && <span className="badge-secondary">日程</span>}
                      <span className="text-xs text-[#aaa]">{f.time}</span>
                      <span className="ml-auto text-xs text-[#bbb]">{f.scope}</span>
                    </div>
                    <div className="mt-1.5 text-[13px] leading-relaxed text-[#444] dark:text-[#ccc]" dangerouslySetInnerHTML={{ __html: f.contentHtml }} />
                    <div className="mt-2.5 flex gap-4 border-t pt-2 text-xs text-muted-foreground">
                      <a className="flex cursor-pointer items-center gap-1 hover:text-primary"><ThumbsUp className="h-3.5 w-3.5" />赞 {f.likes}</a>
                      <a
                        className="cursor-pointer hover:text-primary"
                        onClick={() => setCommentOpen((o) => (o.includes(f.id) ? o.filter((x) => x !== f.id) : [...o, f.id]))}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />评论 {f.comments.length}
                      </a>
                    </div>
                    {commentOpen.includes(f.id) && (
                      <div className="mt-3 border-t border-[#f5f5f5] pt-3 dark:border-[#2e3340]">
                        {f.comments.map((c, i) => (
                          <div key={i} className="mb-2 flex items-start gap-2">
                            <UserAvatar name={c.author} size={24} />
                            <div>
                              <div className="text-[12px]">
                                <span className="font-medium">{c.author}</span>
                                <span className="ml-2 text-[#bbb]">{c.time}</span>
                              </div>
                              <div className="text-[13px] text-[#555] dark:text-[#bbb]">{c.content}</div>
                            </div>
                          </div>
                        ))}
                        <div className="mt-2 flex gap-2">
                          <input className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="输入评论 ..." />
                          <Button size="sm" className="!h-[28px]">评论</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {list.length === 0 && <Empty description="暂无动态"/>}
          </div>

          {/* 右侧栏 */}
          <div className="side-wrapper-parent w-full lg:w-[330px] lg:shrink-0">
            <div className="side-wrapper space-y-3">
              <Panel id="search" title="搜索">
                <input
                  className="mb-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="搜索"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <input className="mb-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring" placeholder="发布日期 (起)" />
                <input className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring" placeholder="发布日期 (止)" />
              </Panel>
              <Panel id="type" title="类型">
                <ul className="list-unstyled m-0 list-none text-[13px]">
                  {[
                    { t: 0, label: '全部' },
                    { t: 1, label: '动态' },
                    { t: 2, label: '跟进' },
                    { t: 4, label: '日程' },
                    { t: 3, label: '公告' },
                  ].map((x) => (
                    <li key={x.t}>
                      <a
                        className={cn('block cursor-pointer rounded-md px-2 py-1.5', type === x.t ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent')}
                        onClick={() => setType(x.t)}
                      >
                        {x.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel id="user" title="用户">
                <div className="aside-tree text-[13px]">
                  {['赵云', '钱迅', '孙丽', '周武', '吴征'].map((u) => (
                    <div key={u} className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground">
                      <UserAvatar name={u} size={22} />
                      {u}
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

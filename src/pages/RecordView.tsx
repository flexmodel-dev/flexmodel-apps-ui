import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RbDialog } from '@/components/ui/dialog'
import { getEntity, getRecords, feeds } from '@/data/mock'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** 记录详情页（复刻 general/record-view.html：左侧详情 + 右侧操作/用户/日期/动态） */
export default function RecordView() {
  const { entity, id } = useParams<{ entity: string; id: string }>()
  const navigate = useNavigate()
  const meta = getEntity(entity ?? 'Customer')
  const record = React.useMemo(() => getRecords(entity ?? 'Customer').find((r) => r.id === id), [entity, id])
  const [showDelete, setShowDelete] = React.useState(false)
  const [feedText, setFeedText] = React.useState('')

  if (!meta) return <AppLayout>未知实体</AppLayout>

  const owningUser = String(record?.owningUser ?? '超级管理员')

  const fieldGroups = (() => {
    const fs = meta.fields.filter((f) => !['createdOn', 'modifiedOn'].includes(f.name))
    // 两列布局
    const rows: (typeof fs)[] = []
    for (let i = 0; i < fs.length; i += 2) rows.push(fs.slice(i, i + 2))
    return rows
  })()

  const renderValue = (fieldName: string) => {
    const f = meta.fields.find((x) => x.name === fieldName)!
    const v = record?.[fieldName]
    if (v === undefined || v === null || v === '') return <span className="text-[#ccc]">-</span>
    if (f.type === 'REFERENCE' && f.refEntity === 'User') {
      return (
        <span className="flex items-center gap-1.5">
          <UserAvatar name={String(v)} size={20} />
        <span className="text-primary">{String(v)}</span>
        </span>
      )
    }
    if (f.type === 'SELECT') {
      const opt = f.options?.find((o) => o.text === v)
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5" style={{ backgroundColor: `${opt?.color ?? '#999'}18`, color: opt?.color ?? '#999' }}>
          <i className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: opt?.color ?? '#999' }} />
          {String(v)}
        </span>
      )
    }
    if (f.type === 'DECIMAL' || f.type === 'NUMBER') return Number(v).toLocaleString()
    if (f.type === 'REFERENCE') return <span className="text-primary">{String(v)}</span>
    if (f.type === 'EMAIL') return <span className="text-primary">{String(v)}</span>
    return String(v)
  }

  return (
    <AppLayout>
      {/* 详情页签 */}
      <div className="tab-container">
        <Tabs defaultValue="detail">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className={cn('icon zmdi text-[26px] text-primary', `zmdi-${meta.icon}`)} />
              <h3 className="m-0 text-2xl font-normal">
                {meta.label}详情
                <span className="ml-2 text-sm font-normal text-muted-foreground">{record ? (record[meta.fields[1].name] as string) : id}</span>
              </h3>
            </div>
          </div>
          <TabsList className="mt-2">
            <TabsTrigger value="detail">
              详情
            </TabsTrigger>
            <TabsTrigger value="dynamic">动态 (2)</TabsTrigger>
            <TabsTrigger value="related">相关记录</TabsTrigger>
          </TabsList>

          <div className="row mt-4 flex gap-5">
            <div className="col-12 flex-1 min-w-0 md:w-2/3">
              <TabsContent value="detail">
                <div className="view-form rounded-xl border bg-card text-card-foreground p-4 shadow-sm">
                  {fieldGroups.map((group, gi) => (
                    <React.Fragment key={gi}>
                      <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                        {group.map((f) => (
                          <dl key={f.name}>
                            <dt>{f.label}</dt>
                            <dd>{renderValue(f.name)}</dd>
                          </dl>
                        ))}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="dynamic">
                <div className="rounded-xl border bg-card text-card-foreground p-4 shadow-sm">
                  {/* 发动态 */}
                  <div className="mb-4 flex gap-3 border-b border-dashed pb-4">
                    <UserAvatar name="超级管理员" />
                    <div className="flex-1">
                      <textarea
                        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        rows={2}
                        placeholder="发布一条跟进动态 ..."
                        value={feedText}
                        onChange={(e) => setFeedText(e.target.value)}
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex gap-2 text-muted-foreground">
                          <a className="cursor-pointer hover:text-primary" title="附件"><i className="zmdi zmdi-attachment-alt" /></a>
                          <a className="cursor-pointer hover:text-primary" title="表情"><i className="zmdi zmdi-mood" /></a>
                          <a className="cursor-pointer hover:text-primary" title="提及"><i className="zmdi zmdi-account-add" /></a>
                        </div>
                        <Button size="sm" className="!h-[28px]" disabled={!feedText.trim()}>发布</Button>
                      </div>
                    </div>
                  </div>
                  {/* 动态列表 */}
                  <div>
                    {feeds.slice(0, 2).map((f) => (
                      <div key={f.id} className="feed-item mb-4 flex gap-3">
                        <UserAvatar name={f.author} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium">{f.author}</span>
                            <span className="text-xs text-[#aaa]">{f.time}</span>
                          </div>
                          <div className="mt-1 text-[13px] leading-relaxed text-[#555] dark:text-[#bbb]" dangerouslySetInnerHTML={{ __html: f.contentHtml }} />
                          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                            <a className="cursor-pointer hover:text-primary"><i className="zmdi zmdi-favorite-outline mr-1" />赞 {f.likes}</a>
                            <a className="cursor-pointer hover:text-primary"><i className="zmdi zmdi-comment-outline mr-1" />评论 {f.comments.length}</a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="related">
                <div className="rounded-xl border bg-card text-card-foreground p-4 text-sm text-muted-foreground shadow-sm">
                  暂无相关记录
                </div>
              </TabsContent>
            </div>

            {/* 右侧操作栏 */}
            <div className="view-operating w-full shrink-0 md:w-[280px]">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary"><i className="icon zmdi zmdi-edit text-[16px]" /> 编辑</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary">更多 <i className="icon zmdi zmdi-more-vert text-[16px]" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowDelete(true)}><i className="icon zmdi zmdi-delete text-[16px]" /> 删除</DropdownMenuItem>
                    <DropdownMenuItem><i className="icon zmdi zmdi-mail-reply-all text-[16px]" /> 分配</DropdownMenuItem>
                    <DropdownMenuItem><i className="icon zmdi zmdi-portable-wifi text-[16px]" /> 共享</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem><i className="icon zmdi zmdi-print text-[16px]" /> 打印</DropdownMenuItem>
                    <DropdownMenuItem><i className="icon mdi mdi-microsoft-excel text-[16px]" /> 报表</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="secondary"><i className="icon mdi mdi-playlist-plus text-[16px]" /> 添加明细</Button>
                <Button variant="secondary"><i className="icon zmdi zmdi-plus text-[16px]" /> 新建相关</Button>
              </div>

              {/* 用户 */}
              <div className="view-user mt-5">
                <div className="form-line">
                  <fieldset><legend>用户</legend></fieldset>
                </div>
                <dl className="flex text-[13px]">
                  <dt className="w-[84px] text-[#8a8a8a]">所属用户</dt>
                  <dd className="flex items-center gap-1.5 text-primary">
                    <UserAvatar name={owningUser} size={20} />
                    {owningUser}
                  </dd>
                </dl>
                <dl className="flex text-[13px]">
                  <dt className="w-[84px] text-[#8a8a8a]">共享用户</dt>
                  <dd className="text-[#ccc]">-</dd>
                </dl>
              </div>

              {/* 日期 */}
              <div className="view-date mt-4">
                <div className="form-line">
                  <fieldset><legend>日期</legend></fieldset>
                </div>
                <dl className="flex text-[13px]">
                  <dt className="w-[84px] text-[#8a8a8a]">创建时间</dt>
                  <dd>{String(record?.createdOn ?? '-')}</dd>
                </dl>
                <dl className="flex text-[13px]">
                  <dt className="w-[84px] text-[#8a8a8a]">修改时间</dt>
                  <dd>{String(record?.modifiedOn ?? '-')}</dd>
                </dl>
              </div>

              {/* 修改历史 */}
              <div className="view-history mt-4">
                <div className="form-line">
                  <fieldset><legend>修改历史</legend></fieldset>
                </div>
                <ul className="m-0 list-none text-xs text-muted-foreground">
                  <li className="py-1.5 border-b border-dashed border-[#f0f0f0]">2026-09-05 14:20 由 钱迅 修改了「商机阶段」</li>
                  <li className="py-1.5 border-b border-dashed border-[#f0f0f0]">2026-09-02 09:12 由 超级管理员 创建了记录</li>
                </ul>
              </div>
            </div>
          </div>
        </Tabs>
      </div>

      {/* 删除确认框 */}
      <RbDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="删除确认"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDelete(false)}>取消</Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowDelete(false)
                navigate(`/app/${meta.name}/list`)
              }}
            >
              删除
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 py-2">
          <i className="zmdi zmdi-alert-circle-o mt-0.5 text-[22px] text-[#fbbc05]" />
          <div>
            确认删除这条「{meta.label}」记录吗？删除后可在回收站中找回。
          </div>
        </div>
      </RbDialog>
    </AppLayout>
  )
}

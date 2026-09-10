import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  Edit,
  FileSpreadsheet,
  ListPlus,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Plus,
  Printer,
  ReplyAll,
  Share,
  Smile,
  ThumbsUp,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RbDialog } from '@/components/ui/dialog'
import { getEntity, getRecords, feeds } from '@/data/mock'
import { cn } from '@/lib/utils'
import { RecordFormModal } from '@/components/rb/RecordFormModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function SectionLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 mt-6">
      <div className="text-sm text-muted-foreground">{children}</div>
      <div className="mt-1 h-px bg-border" />
    </div>
  )
}

/** 记录详情内容（供独立详情页和列表 Drawer 复用） */
export function RecordDetailContent({
  entity,
  id,
  onDeleted,
}: {
  entity: string
  id: string
  onDeleted?: () => void
}) {
  const meta = getEntity(entity)
  const [showDelete, setShowDelete] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [refreshTick, setRefreshTick] = React.useState(0)
  const [feedText, setFeedText] = React.useState('')

  const record = React.useMemo(
    () => getRecords(entity).find((r) => r.id === id),
    [entity, id, refreshTick],
  )

  if (!meta) return <div className="p-4 text-sm text-muted-foreground">未知实体</div>

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

  const recordName = record ? String(record[meta.nameField] ?? id) : id

  return (
    <div>
      {/* 详情页签 */}
        <div className="tab-container">
          <Tabs defaultValue="detail">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <meta.icon className="h-6 w-6 text-primary" />
              <h3 className="m-0 truncate text-2xl font-normal">
                {recordName}
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
                          <a className="cursor-pointer hover:text-primary" title="附件"><Paperclip className="h-4 w-4" /></a>
                          <a className="cursor-pointer hover:text-primary" title="表情"><Smile className="h-4 w-4" /></a>
                          <a className="cursor-pointer hover:text-primary" title="提及"><UserPlus className="h-4 w-4" /></a>
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
                            <a className="flex cursor-pointer items-center gap-1 hover:text-primary"><ThumbsUp className="h-3.5 w-3.5" />赞 {f.likes}</a>
                            <a className="flex cursor-pointer items-center gap-1 hover:text-primary"><MessageSquare className="h-3.5 w-3.5" />评论 {f.comments.length}</a>
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
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  <Edit className="h-4 w-4" /> 编辑
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary">更多 <MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowDelete(true)}><Trash2 className="h-4 w-4" /> 删除</DropdownMenuItem>
                    <DropdownMenuItem><ReplyAll className="h-4 w-4" /> 分配</DropdownMenuItem>
                    <DropdownMenuItem><Share className="h-4 w-4" /> 共享</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem><Printer className="h-4 w-4" /> 打印</DropdownMenuItem>
                    <DropdownMenuItem><FileSpreadsheet className="h-4 w-4" /> 报表</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="secondary"><ListPlus className="h-4 w-4" /> 添加明细</Button>
                <Button variant="secondary"><Plus className="h-4 w-4" /> 新建相关</Button>
              </div>

              <SectionLine>用户</SectionLine>
              <dl className="m-0 space-y-3 text-sm">
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
                  <dt className="text-muted-foreground">所属用户</dt>
                  <dd className="m-0 flex min-w-0 items-center gap-2 text-primary">
                    <UserAvatar name={owningUser} size={22} />
                    <span className="truncate">{owningUser}</span>
                  </dd>
                </div>
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
                  <dt className="text-muted-foreground">共享用户</dt>
                  <dd className="m-0 text-muted-foreground">-</dd>
                </div>
              </dl>

              <SectionLine>日期</SectionLine>
              <dl className="m-0 space-y-3 text-sm">
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
                  <dt className="text-muted-foreground">创建时间</dt>
                  <dd className="m-0 truncate">{String(record?.createdOn ?? '-')}</dd>
                </div>
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
                  <dt className="text-muted-foreground">修改时间</dt>
                  <dd className="m-0 truncate">{String(record?.modifiedOn ?? '-')}</dd>
                </div>
              </dl>

              <SectionLine>修改历史</SectionLine>
              <ul className="relative m-0 list-none space-y-3 border-l border-border pl-4">
                {[
                  '2026-09-05 14:20 由 钱迅 修改了「商机阶段」',
                  '2026-09-02 09:12 由 超级管理员 创建了记录',
                ].map((item) => (
                  <li key={item} className="relative text-xs leading-5 text-muted-foreground">
                    <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-card bg-primary/30" />
                    {item}
                  </li>
                ))}
              </ul>
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
                onDeleted?.()
              }}
            >
              删除
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 py-2">
          <AlertCircle className="mt-0.5 h-5 w-5 text-[#fbbc05]" />
          <div>
            确认删除这条「{meta.label}」记录吗？删除后可在回收站中找回。
          </div>
        </div>
      </RbDialog>

      <RecordFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        entity={meta.name}
        recordId={id}
        onSaved={() => setRefreshTick((tick) => tick + 1)}
      />
    </div>
  )
}

export default function RecordView() {
  const { entity, id } = useParams<{ entity: string; id: string }>()
  const navigate = useNavigate()

  return (
    <RecordDetailContent
      entity={entity ?? 'Customer'}
      id={id ?? ''}
      onDeleted={() => navigate(`/app/${entity ?? 'Customer'}/list`)}
    />
  )
}

import * as React from 'react'
import {
  ArrowRight,
  AlertCircle,
  Check,
  ListPlus,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {ConfirmDialog} from '@/components/ui/dialog'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from '@/components/ui/dropdown-menu'
import {message} from '@/components/ui/message'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {UserAvatar} from '@/components/ui/avatar'
import {DiscussionComposer} from '@/components/biz/DiscussionComposer'
import {useRecordDiscussions} from '@/components/biz/useRecordDiscussions'
import type {RecordDiscussionItem} from '@/services/recordDiscussions'
import {getDirectory} from '@/services/directory'
import {cn, toErrorMessage} from '@/lib/utils'

export type RecordAsideTab = 'flow' | 'discussion' | 'history'

export interface RecordHistoryChange {
  field: string
  from?: string
  to?: string
}

export type RecordHistoryKind =
  'created'
  | 'updated'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'attachment'
  | 'subrecord'

export interface RecordHistoryEntry {
  id: string
  actorName: string
  avatar?: string | null
  at: string
  kind: RecordHistoryKind
  action: string
  detail?: string
  changes?: RecordHistoryChange[]
}

const historyIcon: Record<RecordHistoryKind, LucideIcon> = {
  created: Plus,
  updated: Pencil,
  submitted: Send,
  approved: Check,
  rejected: X,
  attachment: Paperclip,
  subrecord: ListPlus,
}

const historyTone: Record<RecordHistoryKind, string> = {
  created: 'border-primary/25 bg-primary/10 text-primary',
  updated: 'border-border bg-muted text-muted-foreground',
  submitted: 'border-primary/25 bg-primary/10 text-primary',
  approved: 'border-green-600/25 bg-green-600/10 text-green-700 dark:text-green-400',
  rejected: 'border-destructive/25 bg-destructive/10 text-destructive',
  attachment: 'border-border bg-muted text-muted-foreground',
  subrecord: 'border-border bg-muted text-muted-foreground',
}

const dayKey = (value: string) => {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function dayLabel(value: string) {
  const date = new Date(value)
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = Math.round((start.getTime() - target.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  return date.toLocaleDateString('zh-CN', {month: 'long', day: 'numeric'})
}

const clock = (value: string) =>
  new Date(value).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', hour12: false})

function discussionTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function groupHistory(entries: RecordHistoryEntry[]) {
  return entries.reduce<Array<{ key: string; label: string; items: RecordHistoryEntry[] }>>((groups, entry) => {
    const key = dayKey(entry.at)
    const current = groups[groups.length - 1]
    if (current?.key === key) current.items.push(entry)
    else groups.push({key, label: dayLabel(entry.at), items: [entry]})
    return groups
  }, [])
}

function DiscussionContent({content}: { content: string }) {
  return <span
    className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{content
    .split(/(@[\p{L}\p{N}_-]+)/gu)
    .map((part, index) => part.startsWith('@')
      ? <span key={index} className="font-medium text-primary">{part}</span>
      : <React.Fragment key={index}>{part}</React.Fragment>)}</span>
}

const triggerClass = cn(
  'group relative h-full items-center gap-1.5 rounded-none bg-transparent px-0 pb-0 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors',
  'hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
  'after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:rounded-full after:bg-transparent after:transition-colors',
  'data-[state=active]:after:bg-primary',
)

function TabCount({value}: { value: number }) {
  return <span
    className="min-w-[18px] rounded-full bg-muted px-1.5 py-px text-[10px] font-medium leading-4 text-muted-foreground transition-colors group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary">{value}</span>
}

function EmptyState({icon: Icon, title, hint}: { icon: LucideIcon; title: string; hint: string }) {
  return <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
    <span
      className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon
      className="h-4 w-4" aria-hidden="true"/></span>
    <p className="text-sm font-medium">{title}</p>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
  </div>
}

function DiscussionItem({item, avatar, replyToName, onReply, onDelete, children}: {
  item: RecordDiscussionItem;
  avatar?: string | null;
  replyToName?: string;
  onReply: () => void;
  onDelete: (item: RecordDiscussionItem) => void;
  children?: React.ReactNode
}) {
  return <article className="flex gap-2.5">
    <UserAvatar name={item.authorName} src={avatar} size={32} className="mt-0.5"/>
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-medium text-foreground">
          {item.authorName}
          {item.parentId && replyToName &&
            <span className="ml-1 text-xs font-normal text-muted-foreground">回复 {replyToName}</span>}
        </p>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <button type="button" className="text-primary hover:underline" onClick={onReply}>回复</button>
          {item.canDelete && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="更多"
                      className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <MoreHorizontal className="h-4 w-4"/>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[1050]">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive dark:text-red-400 dark:focus:text-red-400"
                onSelect={() => onDelete(item)}>
                <Trash2 className="h-3.5 w-3.5"/>删除评论
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      </div>
      <div
        className="mt-1.5 whitespace-pre-wrap break-words rounded-md bg-muted/60 px-3 py-2 text-[13px] leading-6 text-foreground/90 [overflow-wrap:anywhere]">
        <DiscussionContent content={item.content}/>
      </div>
      <time dateTime={item.createdAt}
            className="mt-1 block text-[11px] tabular-nums text-muted-foreground">{discussionTimestamp(item.createdAt)}</time>
      {children}
    </div>
  </article>
}

function DiscussionPanel({
                           appId, roots, total, loading, error, submitting, loadingMore, hasMore,
                           onRetry, onLoadMore, onSubmit, onDelete
                         }: {
  appId: string;
  roots: RecordDiscussionItem[];
  total: number;
  loading: boolean;
  error: string;
  submitting: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
  onSubmit: (content: string, parentId?: string | null, mentionedUserIds?: string[], replyToId?: string | null) => Promise<unknown>;
  onDelete: (discussionId: string) => Promise<void>
}) {
  const [replyTo, setReplyTo] = React.useState<{ id: string; rootId: string; authorName: string } | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<RecordDiscussionItem | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [avatars, setAvatars] = React.useState<Record<string, string | null | undefined>>({})
  React.useEffect(() => {
    let active = true
    setAvatars({})
    getDirectory(appId).then(directory => {
      if (active) setAvatars(Object.fromEntries(directory.members.map(member => [member.id, member.avatar])))
    }).catch(() => {
      // 目录不可用时继续显示姓名首字，不影响讨论。
    })
    return () => {
      active = false
    }
  }, [appId])
  const timeline = React.useMemo(() => roots
    .flatMap(root => [
      root,
      ...root.replies.map(reply => ({...reply, replyToName: reply.replyToName || root.authorName})),
    ])
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt)), [roots])

  const submit = async (content: string, mentionedUserIds: string[], target?: typeof replyTo) => {
    try {
      await onSubmit(content, target?.rootId, mentionedUserIds, target?.id)
      if (target) setReplyTo(current => current?.id === target.id ? null : current)
      return true
    } catch (cause) {
      message.error(toErrorMessage(cause, '发送失败，请重试'))
      return false
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await onDelete(pendingDelete.id)
      setReplyTo(current => current && (current.id === pendingDelete.id || current.rootId === pendingDelete.id) ? null : current)
      setPendingDelete(null)
      message.success('已删除讨论')
    } catch (cause) {
      message.error(toErrorMessage(cause, '删除讨论失败'))
    } finally {
      setDeleting(false)
    }
  }

  return <div className="flex h-full min-h-0 flex-col">
    <div className="shrink-0 border-b pb-3">
      <DiscussionComposer appId={appId} submitting={submitting} onSubmit={submit}/>
    </div>
    <div className="mt-3 min-h-0 flex-1 lg:overflow-y-auto">
      {error && <div role="alert"
                     className="mb-3 flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
        <span className="min-w-0 break-words">{error}</span>
        <button type="button" className="shrink-0 underline-offset-2 hover:underline" onClick={onRetry}>重试</button>
      </div>}
      {loading && !roots.length
        ? <div role="status"
               className="flex items-center gap-2 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin"/>正在加载讨论…
        </div>
        : !roots.length ?
          <EmptyState icon={MessageSquare} title="还没有讨论" hint="发起第一条讨论，@ 同事一起推进这条记录"/>
          : <div className="space-y-5 pb-1">
            {timeline.map(item => <DiscussionItem
              key={item.id}
              item={item}
              avatar={avatars[item.authorId]}
              replyToName={item.replyToName || undefined}
              onReply={() => setReplyTo(current => current?.id === item.id ? null : {
                id: item.id,
                rootId: item.parentId ?? item.id,
                authorName: item.authorName,
              })}
              onDelete={setPendingDelete}>
              {replyTo?.id === item.id && <div className="mt-3">
                <DiscussionComposer appId={appId} replyTo={replyTo} submitting={submitting}
                                    onSubmit={(content, mentions) => submit(content, mentions, replyTo)}/>
              </div>}
            </DiscussionItem>)}
            {hasMore && <div className="pt-1 text-center">
              <Button size="xs" variant="ghost" disabled={loadingMore} onClick={onLoadMore}>
                {loadingMore ? '加载中…' : `加载更早的讨论（${total}）`}
              </Button>
            </div>}
          </div>}
    </div>
    <ConfirmDialog
      open={!!pendingDelete}
      onOpenChange={open => !open && setPendingDelete(null)}
      title="删除讨论"
      message={pendingDelete
        ? pendingDelete.parentId
          ? '确认删除这条回复吗？删除后不可恢复。'
          : pendingDelete.replyCount > 0
            ? `确认删除这条讨论吗？该讨论下的 ${pendingDelete.replyCount} 条回复会一并删除。`
            : '确认删除这条讨论吗？删除后不可恢复。'
        : ''}
      busy={deleting}
      confirmText="删除"
      onConfirm={() => void confirmDelete()}
    />
  </div>
}

function HistoryPanel({entries}: { entries: RecordHistoryEntry[] }) {
  if (!entries.length) return <EmptyState icon={Pencil} title="暂无变更记录"
                                          hint="字段修改、审批流转与附件变化都会记录在这里"/>
  return <div className="space-y-5 pb-1">
    {groupHistory(entries).map(group => <section key={group.key}>
      <h4 className="mb-3 text-[11px] font-medium tracking-wide text-muted-foreground">{group.label}</h4>
      <ol>
        {group.items.map((entry, index) => {
          const Icon = historyIcon[entry.kind]
          const last = index === group.items.length - 1
          return <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span aria-hidden="true" className="absolute bottom-0 left-3 top-7 w-px bg-border"/>}
            <span aria-hidden="true"
                  className={cn('relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border', historyTone[entry.kind])}>
              <Icon className="h-3 w-3"/>
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <p className="min-w-0 text-[13px] leading-5">
                  <span className="font-medium text-foreground">{entry.actorName}</span>
                  <span className="text-muted-foreground"> {entry.action}</span>
                </p>
                <time dateTime={entry.at}
                      className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{clock(entry.at)}</time>
              </div>
              {entry.detail && <p
                className="mt-1.5 break-words rounded-md bg-muted/60 px-2.5 py-2 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{entry.detail}</p>}
              {entry.changes && entry.changes.length > 0 && <div
                className="mt-2 overflow-hidden rounded-md border bg-muted/30">{entry.changes.map((change, changeIndex) =>
                <div key={`${change.field}-${changeIndex}`}
                     className={cn('grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-baseline gap-x-1.5 px-2.5 py-1.5', changeIndex > 0 && 'border-t border-border/70')}>
                  <span className="text-[11px] text-muted-foreground">{change.field}</span>
                  <span className="flex min-w-0 flex-wrap items-baseline gap-1 text-xs">
                    {change.from
                      ? <span
                        className="min-w-0 truncate text-muted-foreground line-through decoration-muted-foreground/40">{change.from}</span>
                      : <span className="text-muted-foreground">（空）</span>}
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden="true"/>
                    <span
                      className={cn('min-w-0 break-words font-medium [overflow-wrap:anywhere]', change.to ? 'text-foreground' : 'text-muted-foreground')}>{change.to || '（空）'}</span>
                  </span>
                </div>)}</div>}
            </div>
          </li>
        })}
      </ol>
    </section>)}
  </div>
}

/** 记录详情右侧栏：流程优先，讨论与变更历史通过下划线 Tab 切换。 */
export function RecordActivityAside({flow, appId, formName, recordId, history, initialTab, onTotalChange}: {
  flow?: React.ReactNode;
  appId: string;
  formName: string;
  recordId: string;
  history: RecordHistoryEntry[];
  initialTab?: RecordAsideTab;
  onTotalChange?: (total: number) => void
}) {
  const discussions = useRecordDiscussions({appId, formName, recordId})
  React.useEffect(() => {
    if (!discussions.loading && !discussions.error) onTotalChange?.(discussions.total)
  }, [discussions.loading, discussions.error, discussions.total, onTotalChange])
  const fallbackTab: RecordAsideTab = initialTab && (initialTab !== 'flow' || flow) ? initialTab : flow ? 'flow' : 'discussion'
  const [tab, setTab] = React.useState<RecordAsideTab>(fallbackTab)
  const tabTouched = React.useRef(!!initialTab)
  React.useEffect(() => {
    if (!flow) {
      if (tab === 'flow') setTab('discussion')
      return
    }
    if (!tabTouched.current && tab !== 'flow') setTab('flow')
  }, [flow, tab])
  const changeTab = (value: string) => {
    tabTouched.current = true
    setTab(value as RecordAsideTab)
  }
  return <Tabs value={tab} onValueChange={changeTab} className="flex flex-col lg:h-full lg:min-h-0">
    <TabsList
      className="flex h-11 w-full shrink-0 items-stretch justify-start gap-7 rounded-none border-b bg-transparent p-0 text-muted-foreground">
      {flow && <TabsTrigger value="flow" className={triggerClass}>流程</TabsTrigger>}
      <TabsTrigger value="discussion" className={triggerClass}>
        讨论{discussions.total > 0 && <TabCount value={discussions.total}/>}
      </TabsTrigger>
      <TabsTrigger value="history" className={triggerClass}>历史</TabsTrigger>
    </TabsList>
    {flow && <TabsContent value="flow" className="min-h-0 flex-1 pt-4 lg:overflow-y-auto">
      {flow}
    </TabsContent>}
    <TabsContent value="discussion" className="min-h-0 flex-1 pt-4">
      <DiscussionPanel
        appId={appId}
        roots={discussions.roots}
        total={discussions.total}
        loading={discussions.loading}
        error={discussions.error}
        submitting={discussions.submitting}
        loadingMore={discussions.loadingMore}
        hasMore={discussions.hasMore}
        onRetry={discussions.reload}
        onLoadMore={() => void discussions.loadMore()}
        onSubmit={discussions.submit}
        onDelete={discussions.remove}
      />
    </TabsContent>
    <TabsContent value="history" className="min-h-0 flex-1 pt-4 lg:overflow-y-auto">
      <HistoryPanel entries={history}/>
    </TabsContent>
  </Tabs>
}

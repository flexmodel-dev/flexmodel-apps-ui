import * as React from 'react'
import {Link} from 'react-router-dom'
import {
  Bell,
  Bot,
  CheckCheck,
  ChevronRight,
  Clock3,
  Inbox,
  LayoutGrid,
  MoreVertical,
  Plus,
  Send,
  Star,
  Table2,
  Workflow
} from 'lucide-react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {AppIcon} from '@/components/shared/AppIcon'
import {AppGrid} from '@/components/shared/AppGrid'
import {AppLoading} from '@/components/shared/AppLoading'
import {appIcons} from '@/data/appIcons'
import {Button} from '@/components/ui/button'
import {BizDialog} from '@/components/ui/dialog'
import {Empty} from '@/components/ui/empty'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from '@/components/ui/dropdown-menu'
import {AiComposer} from '@/pages/ai/AiChat'
import {useAiAssistant} from '@/pages/ai/AiProvider'
import {InstanceDrawer} from '@/pages/approvals/InstanceDrawer'
import {AppRecordDrawer} from '@/pages/records/AppRecordDrawer'
import {getAuthSession} from '@/services/auth'
import {type App, getApps} from '@/services/apps'
import {type ApprovalCounts, type ApprovalItem, getApprovalCounts, listPersonalApprovals} from '@/services/approvals'
import {listNotifications} from '@/services/notifications'
import {getRecentUses, type RecentUse} from '@/lib/recentUsage'
import {cn, toErrorMessage} from '@/lib/utils'

const cardClass = 'min-w-0 rounded-xl border bg-card p-4 sm:p-5'
const tileClass = 'group flex w-full min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-3 text-center transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const metricIcons = {pending: Inbox, handled: CheckCheck, initiated: Send, copied: Bell}

const FAVORITES_KEY = 'flexmodel-apps.workbench-favorites'
const PENDING_PREVIEW_SIZE = 5
const RECENT_PREVIEW_SIZE = 6

function loadFavoriteIds(apps: App[], recent: RecentUse[]): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    if (raw) {
      const ids = JSON.parse(raw)
      if (Array.isArray(ids)) return apps.filter(app => ids.includes(app.id)).map(app => app.id)
    }
  } catch {
    // 本地存储不可用时收藏退化为本次会话内生效。
  }
  // 首次进入没有收藏记录：以最近使用过的应用作为初始收藏，避免"收藏"与"所有"完全相同。
  return [...new Set(recent.map(item => item.appId))]
    .filter(id => apps.some(app => app.id === id))
    .slice(0, 8)
}

function saveFavoriteIds(ids: string[]): string[] {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))
  } catch {
    // 同上，忽略存储失败。
  }
  return ids
}

function formatRelativeTime(at: number): string {
  if (!Number.isFinite(at)) return ''
  const minutes = Math.max(1, Math.round((Date.now() - at) / 60000))
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.round(hours / 24)} 天前`
}

export default function AdminWorkbench() {
  const ai = useAiAssistant()
  const [apps, setApps] = React.useState<App[]>([])
  const [favorites, setFavorites] = React.useState<string[]>([])
  const [counts, setCounts] = React.useState<ApprovalCounts | null>(null)
  const [copiedCount, setCopiedCount] = React.useState<number | null>(null)
  const [pendingItems, setPendingItems] = React.useState<ApprovalItem[]>([])
  const [pendingLoaded, setPendingLoaded] = React.useState(false)
  const [recent] = React.useState<RecentUse[]>(() => getRecentUses())
  const [recentKind, setRecentKind] = React.useState('app')
  const [appsKind, setAppsKind] = React.useState('favorite')
  const [manageOpen, setManageOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<ApprovalItem | null>(null)
  const [linkedRecord, setLinkedRecord] = React.useState<{ formName: string; recordId: string } | null>(null)
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    mountedRef.current = true
    getApps()
      .then((loadedApps) => {
        if (!mountedRef.current) return
        setApps(loadedApps)
        setFavorites(loadFavoriteIds(loadedApps, recent))
      })
      .catch((caught: unknown) => {
        if (mountedRef.current) setError(toErrorMessage(caught, '加载工作台数据失败，请稍后重试。'))
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false)
      })
    return () => {
      mountedRef.current = false
    }
  }, [recent])

  // 待办数字、最近几条待办和知会总数共用一次刷新，审批抽屉处理后直接回调这里。
  const refreshApprovals = React.useCallback(() => {
    getApprovalCounts()
      .then((loaded) => mountedRef.current && setCounts(loaded))
      .catch(() => undefined)
    listNotifications({category: 'workflow', status: 'all', page: 1, size: 1})
      .then((result) => mountedRef.current && setCopiedCount(result.total))
      .catch(() => undefined)
    listPersonalApprovals('pending', undefined, '', 1)
      .then((result) => mountedRef.current && setPendingItems(result.list.slice(0, PENDING_PREVIEW_SIZE)))
      .catch(() => undefined)
      .finally(() => {
        if (mountedRef.current) setPendingLoaded(true)
      })
  }, [])

  React.useEffect(() => {
    refreshApprovals()
  }, [refreshApprovals])

  React.useEffect(() => {
    setLinkedRecord(null)
  }, [selected])

  const toggleFavorite = (id: string) => setFavorites(ids =>
    saveFavoriteIds(ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]))
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    hourCycle: 'h23'
  }).format(new Date()))
  const greeting = hour >= 6 && hour < 12 ? '上午好' : hour >= 12 && hour < 18 ? '下午好' : '晚上好'
  const userName = getAuthSession()?.user.name
  const favoriteApps = favorites
    .map(id => apps.find(app => app.id === id))
    .filter((app): app is App => Boolean(app))
  const visibleApps = appsKind === 'favorite' ? favoriteApps : apps
  const recentItems = recent
    .filter(item => item.kind === recentKind)
    .map(item => ({item, app: apps.find(app => app.id === item.appId)}))
    .filter((entry): entry is { item: RecentUse; app: App } => Boolean(entry.app))
  const metrics = [
    {id: 'pending', label: '待处理', count: counts?.pending},
    {id: 'handled', label: '已处理', count: counts?.handled},
    {id: 'initiated', label: '已发起', count: counts?.initiated},
    // 与审批中心"已知会"列表同源，取 workflow 通知总数，避免占位假数字。
    {id: 'copied', label: '已知会', count: copiedCount},
  ] as const

  return <AdminLayout noOuterScroll contentClassName="h-full">
    <div className="-mx-1.5 h-full overflow-y-auto px-1.5 pb-5">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <header className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{greeting}{userName && `，${userName}`}！</h1>
        </header>

        {isLoading ? <AppLoading center className="min-h-[50vh]"/> : error ? (
          <div role="alert"
               className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">{error}</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex min-w-0 flex-col gap-4">
              <section aria-label="流程待办" className={cardClass}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold"><Workflow
                    className="h-4 w-4 text-muted-foreground"/>流程待办</h2>
                  <Link to="/approval/home"
                        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">审批中心<ChevronRight
                    className="h-3.5 w-3.5"/></Link>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {metrics.map(metric => {
                    const Icon = metricIcons[metric.id]
                    return <Link key={metric.id} to={`/approval/home?view=${metric.id}`}
                                 aria-label={`${metric.label} ${metric.count ?? '加载中'}`}
                                 className="rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">{metric.label}</span>
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70"/>
                      </span>
                      <span
                        className={cn('mt-3 block text-3xl font-semibold tabular-nums tracking-tight', metric.id === 'pending' ? 'text-primary' : 'text-foreground')}>{metric.count ?? '—'}</span>
                    </Link>
                  })}
                </div>
                <div className="mt-4 border-t pt-3">
                  <h3 className="mb-1 text-xs font-medium text-muted-foreground">待我审批</h3>
                  {!pendingLoaded ? <AppLoading className="py-6" label="正在读取待办"/> : pendingItems.length ? (
                    <ul className="divide-y divide-border/60">
                      {pendingItems.map(item => <li key={item.taskId ?? item.id}>
                        <button type="button" onClick={() => setSelected(item)}
                                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                            <span
                              className="mt-1 block truncate text-xs text-muted-foreground">{item.appName} · {item.nodeTitle ?? item.formName}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-xs text-primary">待我审批</span>
                            <span
                              className="mt-1 block text-[11px] text-muted-foreground">{formatRelativeTime(new Date(item.createdAt).getTime())}</span>
                          </span>
                        </button>
                      </li>)}
                    </ul>
                  ) : <p className="py-4 text-sm text-muted-foreground">暂无待办事项，可以直接从下方应用开始工作。</p>}
                </div>
              </section>

              <section aria-label="我的应用" className={cardClass}>
                <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold"><LayoutGrid
                    className="h-4 w-4 text-muted-foreground"/>我的应用</h2>
                  <div role="group" aria-label="我的应用范围" className="flex gap-5">
                    {[['favorite', '收藏'], ['all', '所有']].map(([id, label]) => <button key={id}
                                                                                          aria-pressed={appsKind === id}
                                                                                          onClick={() => setAppsKind(id)}
                                                                                          className={cn('border-b-2 px-1 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', appsKind === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{label}</button>)}
                  </div>
                  <Button variant="ghost" size="xs" className="ml-auto text-muted-foreground"
                          onClick={() => setManageOpen(true)}><Plus className="h-3.5 w-3.5"/>收藏应用</Button>
                </div>
                <AppGrid apps={visibleApps}
                         onReorder={appsKind === 'favorite' ? next => setFavorites(saveFavoriteIds(next.map(app => app.id))) : undefined}
                         renderLeading={app => {
                           const isFavorite = favorites.includes(app.id)
                           return <button type="button" aria-label={`收藏星标：${app.name}`} aria-pressed={isFavorite}
                                          onClick={() => toggleFavorite(app.id)}
                                          className="flex items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:opacity-100">
                             <Star
                               className={cn('h-4 w-4', isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')}/>
                           </button>
                         }}
                         renderActions={app => <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="secondary" size="icon" aria-label={`更多操作：${app.name}`}
                                     className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100">
                               <MoreVertical className="h-3.5 w-3.5"/>
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                             <DropdownMenuItem onClick={() => toggleFavorite(app.id)}><Star
                               className="h-4 w-4"/>{favorites.includes(app.id) ? '取消收藏' : '收藏'}
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>}/>
                {appsKind === 'favorite' && !favorites.length &&
                  <Empty image={<Star className="h-7 w-7"/>} description="暂无收藏应用"><Button size="sm"
                                                                                                variant="outline"
                                                                                                onClick={() => setManageOpen(true)}>添加收藏</Button></Empty>}
                {appsKind === 'all' && !apps.length &&
                  <Empty image={<LayoutGrid className="h-7 w-7"/>} description="暂无可用应用"/>}
              </section>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <section aria-label="最近使用" className={cn(cardClass, 'order-1 xl:order-2')}>
                <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold"><Clock3
                    className="h-4 w-4 text-muted-foreground"/>最近使用</h2>
                  <div role="group" aria-label="最近使用类型" className="flex gap-5">
                    {[['app', '应用'], ['form', '应用项']].map(([id, label]) => <button key={id}
                                                                                        aria-pressed={recentKind === id}
                                                                                        onClick={() => setRecentKind(id)}
                                                                                        className={cn('border-b-2 px-1 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', recentKind === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{label}</button>)}
                  </div>
                </div>
                {recentItems.length ?
                  <ul className="space-y-1">
                    {recentItems.slice(0, RECENT_PREVIEW_SIZE).map(({item, app}) => {
                      const Icon = item.kind === 'form' ? Table2 : appIcons[app.iconName]
                      const time = formatRelativeTime(item.at)
                      return <li key={`${item.appId}:${item.navId ?? ''}`}>
                        <Link to={item.kind === 'form' ? `/apps/${item.appId}/${item.navId}` : `/apps/${item.appId}`}
                              title={`${app.name}${item.kind === 'form' ? ` / ${item.name}` : ''} · ${time}`}
                              className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <span data-primary={app.primaryColor}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon
                            className="h-4 w-4"/></span>
                          <span className="min-w-0 flex-1"><span
                            className="block truncate text-sm text-foreground">{item.name}</span><span
                            className="mt-1 block truncate text-xs text-muted-foreground">{item.kind === 'form' ? `${app.name} · ${time}` : time}</span></span>
                        </Link>
                      </li>
                    })}
                  </ul> : <p
                    className="text-sm text-muted-foreground">最近使用的{recentKind === 'form' ? '应用项' : '应用'}会显示在这里。</p>}
              </section>

              <section aria-label="AI 助手" className={cn(cardClass, 'order-2 xl:order-1')}>
                <h2 className="flex items-center gap-2 text-sm font-semibold"><Bot
                  className="h-4 w-4 text-muted-foreground"/>AI 助手</h2>
                <div className="mt-4">
                  <AiComposer placeholder="向 AI 助手提问，@ 可选择要操作的应用" busy={false}
                              onSend={async content => {
                                ai.openAssistant({prompt: content})
                                return true
                              }}/>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">发送后在右侧助手面板中继续对话，支持多轮上下文与历史会话；输入
                  @
                  可指定要操作的应用。</p>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>

    {selected && !selected.recordId &&
      <InstanceDrawer item={selected} onClose={() => setSelected(null)} onChanged={refreshApprovals}/>}
    {selected && !!selected.recordId &&
      <AppRecordDrawer
        open
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        appId={selected.appId}
        formName={selected.formName}
        recordId={selected.recordId}
        approvalInstanceId={selected.id}
        onSaved={refreshApprovals}
        onOpenRecord={(formName, recordId) => setLinkedRecord({formName, recordId})}
      />}
    {selected && linkedRecord &&
      <AppRecordDrawer
        open
        onOpenChange={(open) => {
          if (!open) setLinkedRecord(null)
        }}
        appId={selected.appId}
        formName={linkedRecord.formName}
        recordId={linkedRecord.recordId}
        onSaved={refreshApprovals}
        onOpenRecord={(formName, recordId) => setLinkedRecord({formName, recordId})}
        onDeleted={() => {
          setLinkedRecord(null)
          refreshApprovals()
        }}
      />}

    <BizDialog open={manageOpen} onOpenChange={setManageOpen} title="收藏应用" width={720}
               footer={<Button size="sm" onClick={() => setManageOpen(false)}>完成</Button>}>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{apps.map(app => <button key={app.id}
                                                                                      aria-label={`${favorites.includes(app.id) ? '取消收藏' : '收藏'}：${app.name}`}
                                                                                      aria-pressed={favorites.includes(app.id)}
                                                                                      onClick={() => toggleFavorite(app.id)}
                                                                                      className={cn(tileClass, 'relative text-foreground', favorites.includes(app.id) && 'bg-primary/5')}>
        <AppIcon iconName={app.iconName} primaryColor={app.primaryColor}/><span
        className="w-full break-words text-sm">{app.name}</span>
        <Star
          className={cn('absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground', favorites.includes(app.id) && 'fill-primary text-primary')}/>
      </button>)}</div>
    </BizDialog>
  </AdminLayout>
}

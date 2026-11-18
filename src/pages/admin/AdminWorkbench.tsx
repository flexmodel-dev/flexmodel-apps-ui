import * as React from 'react'
import {Link} from 'react-router-dom'
import {
  Bell,
  CheckCheck,
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
import {getAuthSession} from '@/services/auth'
import {type App, getApps} from '@/services/apps'
import {type ApprovalCounts, getApprovalCounts} from '@/services/approvals'
import {getRecentUses, type RecentUse} from '@/lib/recentUsage'
import {cn, toErrorMessage} from '@/lib/utils'

const cardClass = 'min-w-0 rounded-xl border bg-card p-4 sm:p-5'
const tileClass = 'group flex w-full min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-3 text-center transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const metricIcons = {pending: Inbox, handled: CheckCheck, initiated: Send, copied: Bell}

const FAVORITES_KEY = 'flexmodel-apps.workbench-favorites'

function loadFavoriteIds(apps: App[]): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    if (raw) {
      const ids = JSON.parse(raw)
      if (Array.isArray(ids)) return apps.filter(app => ids.includes(app.id)).map(app => app.id)
    }
  } catch {
    // 本地存储不可用时收藏退化为本次会话内生效。
  }
  return apps.map(app => app.id)
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
  const minutes = Math.max(1, Math.round((Date.now() - at) / 60000))
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.round(hours / 24)} 天前`
}

export default function AdminWorkbench() {
  const [apps, setApps] = React.useState<App[]>([])
  const [favorites, setFavorites] = React.useState<string[]>([])
  const [counts, setCounts] = React.useState<ApprovalCounts | null>(null)
  const [recent] = React.useState<RecentUse[]>(() => getRecentUses())
  const [recentKind, setRecentKind] = React.useState('app')
  const [appsKind, setAppsKind] = React.useState('favorite')
  const [manageOpen, setManageOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    getApps()
      .then((loadedApps) => {
        if (cancelled) return
        setApps(loadedApps)
        setFavorites(loadFavoriteIds(loadedApps))
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(toErrorMessage(caught, '加载工作台数据失败，请稍后重试。'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    getApprovalCounts()
      .then((loaded) => !cancelled && setCounts(loaded))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

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
    // shortcut: 后端暂无已知会计数接口，先用固定值占位，接口就绪后替换为真实数字。
    {id: 'copied', label: '已知会', count: 8},
  ] as const

  return <AdminLayout noOuterScroll contentClassName="h-full">
    <div className="h-full space-y-4 overflow-y-auto pb-5 pr-1">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{greeting}{userName && `，${userName}`}！</h1>
      </header>

      {isLoading ? <AppLoading center className="min-h-[50vh]"/> : error ? (
        <div role="alert"
             className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">{error}</div>
      ) : <>
        <section aria-label="流程待办" className={cardClass}>
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Workflow
            className="h-4 w-4 text-muted-foreground"/>流程待办</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map(metric => {
              const Icon = metricIcons[metric.id]
              return <Link key={metric.id} to={`/approval/home?view=${metric.id}`}
                           aria-label={`${metric.label} ${metric.count ?? 0}`}
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
        </section>

        <section aria-label="我的应用" className={cardClass}>
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
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
                         className="h-4 w-4"/>{favorites.includes(app.id) ? '取消收藏' : '收藏'}</DropdownMenuItem>
                     </DropdownMenuContent>
                   </DropdownMenu>}/>
          {appsKind === 'favorite' && !favorites.length &&
            <Empty image={<Star className="h-7 w-7"/>} description="暂无收藏应用"><Button size="sm" variant="outline"
                                                                                          onClick={() => setManageOpen(true)}>添加收藏</Button></Empty>}
        </section>

        <section aria-label="最近使用" className={cardClass}>
          <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2">
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
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
              {recentItems.map(({item, app}) => {
                const Icon = item.kind === 'form' ? Table2 : appIcons[app.iconName]
                const time = formatRelativeTime(item.at)
                return <Link key={`${item.appId}:${item.navId ?? ''}`}
                             to={item.kind === 'form' ? `/apps/${item.appId}/${item.navId}` : `/apps/${item.appId}`}
                             title={`${app.name}${item.kind === 'form' ? ` / ${item.name}` : ''} · ${time}`}
                             className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span data-primary={app.primaryColor}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon
                    className="h-4 w-4"/></span>
                  <span className="min-w-0"><span
                    className="block truncate text-sm text-foreground">{item.name}</span><span
                    className="mt-1 block truncate text-xs text-muted-foreground">{item.kind === 'form' ? app.name : '应用'}</span></span>
                </Link>
              })}
            </div> : <p
              className="text-sm text-muted-foreground">最近使用的{recentKind === 'form' ? '应用项' : '应用'}会显示在这里。</p>}
        </section>
      </>}
    </div>

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

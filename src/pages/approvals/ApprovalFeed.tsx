import {InstanceDrawer} from './InstanceDrawer'
import * as React from 'react'
import {useParams, useSearchParams} from 'react-router-dom'
import {Bell, ClipboardCheck, RefreshCw} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Pagination} from '@/components/shared/Pagination'
import {SearchInput} from '@/components/shared/SearchInput'
import {type ApprovalItem, approvalStatus, listPersonalApprovals} from '@/services/approvals'
import {getApprovalMemberNames} from '@/services/workflows'
import {type App, getApps} from '@/services/apps'
import {AppRecordDrawer} from '@/pages/records/AppRecordDrawer'
import {AppLoading} from '@/components/shared/AppLoading'
import {type AppNotification, listNotifications} from '@/services/notifications'
import {useNotifications} from '@/pages/notifications/NotificationProvider'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {cn, toErrorMessage} from '@/lib/utils'

export function ApprovalFeed({appId, compact = false, showAppFilter = false}: {
  appId?: string;
  compact?: boolean;
  showAppFilter?: boolean
}) {
  const params = useParams()
  const [query, setQuery] = useSearchParams()
  const {revision: notificationRevision, openNotification} = useNotifications()
  const tabs = [['pending', '待处理'], ['handled', '已处理'], ['initiated', '已发起'], ['copied', '已知会']] as const
  const tab = tabs.find(([value]) => value === query.get('view'))?.[0] ?? 'pending'
  const [selectedAppId, setSelectedAppId] = React.useState('')
  const [apps, setApps] = React.useState<App[]>([])
  const effectiveAppId = appId ?? params.appId ?? (showAppFilter ? selectedAppId : '')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [items, setItems] = React.useState<ApprovalItem[]>([])
  const [notifications, setNotifications] = React.useState<AppNotification[]>([])
  const [total, setTotal] = React.useState(0)
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [selected, setSelected] = React.useState<ApprovalItem | null>(null)
  const [linkedRecord, setLinkedRecord] = React.useState<{ formName: string; recordId: string } | null>(null)
  const [names, setNames] = React.useState<Record<string, string>>({})
  const [revision, refresh] = React.useReducer(value => value + 1, 0)

  React.useEffect(() => {
    setPage(1)
    setSelected(null)
  }, [tab, effectiveAppId])

  React.useEffect(() => {
    setLinkedRecord(null)
  }, [selected])
  React.useEffect(() => {
    if (!showAppFilter) return
    let active = true
    getApps()
      .then(value => active && setApps(value.filter(app => app.enabled)))
      .catch(() => {
      })
    return () => {
      active = false
    }
  }, [showAppFilter])
  React.useEffect(() => {
    let active = true
    const load = async () => {
      try {
        if (tab === 'copied') {
          const result = await listNotifications({
            category: 'workflow',
            status: 'all',
            appId: effectiveAppId,
            page,
            size: 30
          })
          if (active) {
            setNotifications(result.list);
            setTotal(result.total)
          }
        } else {
          const result = await listPersonalApprovals(tab, effectiveAppId, search, page)
          if (active) {
            setItems(result.list);
            setTotal(result.total)
          }
        }
        if (active) setError('')
      } catch (cause) {
        if (active) setError(toErrorMessage(cause, '加载失败'))
      } finally {
        if (active) setLoading(false)
      }
    }
    setLoading(true);
    const debounce = window.setTimeout(load, 180);
    const timer = tab === 'copied' ? undefined : window.setInterval(load, 5000)
    return () => {
      active = false;
      window.clearTimeout(debounce);
      window.clearInterval(timer)
    }
  }, [tab, effectiveAppId, search, page, revision, tab === 'copied' ? notificationRevision : 0])
  const appKey = [...new Set(items.map(item => item.appId))].sort().join(',')
  React.useEffect(() => {
    if (!appKey || tab === 'copied') return
    let cancelled = false
    Promise.all(appKey.split(',').filter(Boolean).map(appId =>
      getApprovalMemberNames(appId).then(map => ({appId, map}))))
      .then(entries => {
        if (cancelled) return
        setNames(Object.assign({}, ...entries.map(entry => entry.map)))
      })
      .catch(() => {
      })
    return () => {
      cancelled = true
    }
  }, [appKey, tab])
  return <Tabs value={tab} onValueChange={value => {
    setQuery(previous => {
      const next = new URLSearchParams(previous);
      next.set('view', value);
      return next
    })
  }} className="flex h-full min-h-0 flex-col">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <TabsList aria-label="流程分类"
                className="h-auto max-w-full justify-start gap-4 overflow-x-auto rounded-none bg-transparent p-0">
        {tabs.map(([value, label]) => <TabsTrigger key={value} value={value}
                                                   className="shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 font-normal data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-primary data-[state=active]:shadow-none">{label}</TabsTrigger>)}
      </TabsList>
      {!compact && <div className="flex max-w-full flex-wrap items-center gap-2">
        {showAppFilter &&
          <select aria-label="所属应用" className="h-10 max-w-48 rounded-md border bg-background px-3 text-sm"
                  value={selectedAppId} onChange={event => {
            setSelectedAppId(event.target.value);
            setPage(1)
          }}>
            <option value="">全部应用</option>
            {apps.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>}
        {tab !== 'copied' &&
          <SearchInput aria-label="搜索审批" className="w-48 max-w-full sm:w-56" placeholder="搜索流程或当前节点"
                       value={search}
                     onChange={event => {
                       setSearch(event.target.value);
                       setPage(1)
                     }}/>}
        <Button variant="ghost" size="sm" aria-label="刷新审批" onClick={refresh}><RefreshCw
          className="h-4 w-4"/></Button></div>}</div>
    <TabsContent value={tab} className="min-h-0 flex-1 overflow-auto">{error ?
      <div role="alert" className="p-6 text-sm text-destructive">{error}<Button variant="link"
                                                                                onClick={refresh}>重试</Button>
      </div> : loading ?
        <AppLoading center label="正在读取审批"/> : !(tab === 'copied' ? notifications.length : items.length) ?
        <div className="py-12 text-center text-sm text-muted-foreground"><ClipboardCheck
          className="mx-auto mb-3 h-8 w-8 opacity-40"/>{tab === 'copied' ? '暂无知会消息' : '暂无审批记录'}
        </div> : tab === 'copied' ? notifications.map(item => <button
            key={item.id} onClick={() => openNotification(item.id)}
            className="flex w-full items-center gap-3 border-b px-2 py-4 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
            <Bell className="h-4 w-4 shrink-0 text-primary"/>
            <span className="min-w-0 flex-1"><span
              className="block truncate text-sm font-medium text-foreground">{item.title}</span><span
              className="mt-1 block truncate text-xs text-muted-foreground">{item.appName} · {item.content}</span></span>
            <span className="shrink-0 text-right"><span
              className={cn('block text-xs', item.readAt ? 'text-muted-foreground' : 'text-primary')}>{item.readAt ? '已读' : '未读'}</span><span
              className="mt-1 block text-[11px] text-muted-foreground">{new Date(item.receivedAt).toLocaleDateString()}</span></span>
          </button>) : items.map(item => <button
          key={item.taskId ?? item.id} onClick={() => setSelected(item)}
          className="flex w-full items-center justify-between gap-4 border-b px-2 py-4 text-left">
            <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{item.title}</p><p
            className="mt-1 truncate text-xs text-muted-foreground">{item.nodeTitle ?? item.formName}{!compact && ` · ${item.appName}`} · {names[item.initiator] ?? item.initiator}</p>
          </div>
          <div className="shrink-0 text-right"><p
            className="text-xs text-primary">{tab === 'pending' ? '待我审批' : approvalStatus[item.status] ?? item.status}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>
          </div>
          </button>)}</TabsContent>
    {!compact &&
      <div className="border-t py-3"><Pagination page={page} pages={Math.max(1, Math.ceil(total / 30))} total={total}
                                                 size={30} onChange={setPage}/></div>}
    {selected && !selected.recordId &&
      <InstanceDrawer item={selected} onClose={() => setSelected(null)} onChanged={refresh}/>}
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
        onSaved={refresh}
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
        onSaved={refresh}
        onOpenRecord={(formName, recordId) => setLinkedRecord({formName, recordId})}
        onDeleted={() => {
          setLinkedRecord(null)
          refresh()
        }}
      />}
  </Tabs>
}

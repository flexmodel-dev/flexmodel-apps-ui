import {InstanceDrawer} from './InstanceDrawer'
import * as React from 'react'
import {useParams} from 'react-router-dom'
import {ClipboardCheck, RefreshCw} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Pagination} from '@/components/biz/Pagination'
import {SearchInput} from '@/components/biz/SearchInput'
import {type ApprovalItem, approvalStatus, getApprovalMemberNames, listPersonalApprovals} from '@/services/approvals'
import {type App, getApps} from '@/services/apps'
import {AppRecordDrawer} from '@/components/biz/AppRecordDrawer'
import {AppLoading} from '@/components/biz/AppLoading'
import {cn, toErrorMessage} from '@/lib/utils'

export function ApprovalFeed({appId, compact = false, showAppFilter = false}: {
  appId?: string;
  compact?: boolean;
  showAppFilter?: boolean
}) {
  const params = useParams()
  const [selectedAppId, setSelectedAppId] = React.useState('')
  const [apps, setApps] = React.useState<App[]>([])
  const effectiveAppId = appId ?? params.appId ?? (showAppFilter ? selectedAppId : '')
  const [tab, setTab] = React.useState<'pending' | 'handled' | 'initiated'>('pending')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [items, setItems] = React.useState<ApprovalItem[]>([])
  const [total, setTotal] = React.useState(0)
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [selected, setSelected] = React.useState<ApprovalItem | null>(null)
  const [linkedRecord, setLinkedRecord] = React.useState<{ formName: string; recordId: string } | null>(null)
  const [names, setNames] = React.useState<Record<string, string>>({})
  const [revision, refresh] = React.useReducer(value => value + 1, 0)

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
        const result = await listPersonalApprovals(tab, effectiveAppId, search, page);
        if (active) {
          setItems(result.list);
          setTotal(result.total);
          setError('')
        }
      } catch (cause) {
        if (active) setError(toErrorMessage(cause, '加载失败'))
      } finally {
        if (active) setLoading(false)
      }
    }
    setLoading(true);
    const debounce = window.setTimeout(load, 180);
    const timer = window.setInterval(load, 5000)
    return () => {
      active = false;
      window.clearTimeout(debounce);
      window.clearInterval(timer)
    }
  }, [tab, effectiveAppId, search, page, revision])
  const appKey = [...new Set(items.map(item => item.appId))].sort().join(',')
  React.useEffect(() => {
    if (!appKey) return
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
  }, [appKey])
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div
        className="flex gap-4">{([['pending', '待处理'], ['handled', '已处理'], ['initiated', '我提交的']] as const).map(([value, label]) =>
        <button key={value}
                className={cn('border-b-2 pb-2 text-sm', tab === value ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground')}
                onClick={() => {
                  setTab(value);
                  setPage(1);
                  setSelected(null)
                }}>{label}</button>)}</div>
      {!compact && <div className="flex items-center gap-2">
        {showAppFilter &&
          <select aria-label="所属应用" className="h-10 max-w-48 rounded-md border bg-background px-3 text-sm"
                  value={selectedAppId} onChange={event => {
            setSelectedAppId(event.target.value);
            setPage(1)
          }}>
            <option value="">全部应用</option>
            {apps.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>}
        <SearchInput aria-label="搜索审批" className="w-56" placeholder="搜索流程或当前节点" value={search}
                     onChange={event => {
                       setSearch(event.target.value);
                       setPage(1)
                     }}/>
        <Button variant="ghost" size="sm" aria-label="刷新审批" onClick={refresh}><RefreshCw
          className="h-4 w-4"/></Button></div>}</div>
    <div className="min-h-0 flex-1 overflow-auto">{error ?
      <div role="alert" className="p-6 text-sm text-destructive">{error}<Button variant="link"
                                                                                onClick={refresh}>重试</Button>
      </div> : loading ? <AppLoading center label="正在读取审批"/> : !items.length ?
        <div className="py-12 text-center text-sm text-muted-foreground"><ClipboardCheck
          className="mx-auto mb-3 h-8 w-8 opacity-40"/>暂无审批记录</div> : items.map(item => <button
          key={item.taskId ?? item.id} onClick={() => setSelected(item)}
          className="flex w-full items-center justify-between gap-4 border-b px-2 py-4 text-left">
          <div className="min-w-0"><p className="truncate text-sm font-medium">{item.title}</p><p
            className="mt-1 truncate text-xs text-muted-foreground">{item.nodeTitle ?? item.formName}{!compact && ` · ${item.appName}`} · {names[item.initiator] ?? item.initiator}</p>
          </div>
          <div className="shrink-0 text-right"><p
            className="text-xs text-primary">{tab === 'pending' ? '待我审批' : approvalStatus[item.status] ?? item.status}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>
          </div>
        </button>)}</div>
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
  </div>
}

import * as React from 'react'
import {Link, useSearchParams} from 'react-router-dom'
import {Bell, CheckCheck, RefreshCw} from 'lucide-react'
import {AppLayout} from '@/components/layout/AppLayout'
import {Button} from '@/components/ui/button'
import {Drawer, DrawerContent, DrawerTitle, DrawerDescription} from '@/components/ui/drawer'
import {Pagination} from '@/components/biz/Pagination'
import {useNotifications} from '@/components/notifications/NotificationProvider'
import {
  listNotifications,
  notificationDetail,
  readNotification,
  readAllNotifications,
  type AppNotification
} from '@/services/notifications'
import {AppRecordDrawer} from '@/components/biz/AppRecordDrawer'
import {message} from '@/components/ui/message'
import {cn, toErrorMessage} from '@/lib/utils'

export default function Notifications() {
  const [params, setParams] = useSearchParams()
  const {summary, revision, status: connection, error: summaryError, refresh} = useNotifications()
  const [status, setStatus] = React.useState('unread'), [category, setCategory] = React.useState(''), [appId, setAppId] = React.useState(''), [page, setPage] = React.useState(1)
  const [items, setItems] = React.useState<AppNotification[]>([]), [total, setTotal] = React.useState(0), [error, setError] = React.useState(''), [loading, setLoading] = React.useState(true)
  const [detail, setDetail] = React.useState<AppNotification | null>(null), [detailError, setDetailError] = React.useState(''), [showApproval, setShowApproval] = React.useState(false), [busy, setBusy] = React.useState(false)
  const [permission, setPermission] = React.useState(() => 'Notification' in window ? Notification.permission : 'unsupported')
  const [localRevision, reload] = React.useReducer(value => value + 1, 0)
  const [detailRevision, reloadDetail] = React.useReducer(value => value + 1, 0)
  const open = params.get('open')
  React.useEffect(() => {
    let active = true;
    setLoading(true)
    listNotifications({status, category, appId, page, size: 30}).then(value => {
      if (active) {
        setItems(value.list);
        setTotal(value.total);
        setError('');
        if (page > 1 && !value.list.length) setPage(page - 1)
      }
    }).catch(cause => {
      if (active) setError(toErrorMessage(cause, '加载失败'))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [status, category, appId, page, revision, localRevision])
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setDetail(null);
    setDetailError('');
    setShowApproval(false)
    void notificationDetail(open).then(async value => {
      if (!active) return;
      setDetail(value);
      if (!value.readAt) {
        try {
          await readNotification(open);
          if (active) {
            refresh();
            reload()
          }
        } catch {
          if (active) message.error('标记已读失败，请重试')
        }
      }
    }).catch(cause => {
      if (active) setDetailError(toErrorMessage(cause, '读取通知失败'))
    })
    return () => {
      active = false
    }
  }, [open, detailRevision])
  const mark = async (id?: string) => {
    setBusy(true);
    try {
      if (id) await readNotification(id); else await readAllNotifications({appId, category});
      refresh();
      reload()
    } catch (cause) {
      message.error(toErrorMessage(cause, '操作失败'))
    } finally {
      setBusy(false)
    }
  }
  const requestPermission = async () => {
    if ('Notification' in window && window.isSecureContext) {
      try {
        setPermission(await Notification.requestPermission())
      } catch {
        message.error('浏览器提醒授权失败')
      }
    }
  }
  const select = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1)
  }
  return <AppLayout hideNavigation showBack noOuterScroll contentClassName="h-full">
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold">通知中心</h1><p
          className="mt-1 text-xs text-muted-foreground">{connection === 'connected' ? '实时连接已建立' : connection === 'reconnecting' ? '连接中断，正在重新连接…' : '正在连接实时通知…'}</p>
        </div>
        <div className="flex gap-2"><Button variant="outline" size="sm" asChild><Link
          to="/approval/home">待办工作</Link></Button><Button variant="outline" size="sm" disabled={busy}
                                                              onClick={() => void mark()}><CheckCheck
          className="h-4 w-4"/>全部标为已读</Button></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm"><span
        className="text-muted-foreground">{permission === 'granted' ? '浏览器提醒已开启，页面在后台时显示系统通知' : permission === 'denied' ? '浏览器已禁用提醒，请在站点设置中开启' : permission === 'unsupported' || !window.isSecureContext ? '当前环境不支持系统提醒，仍可接收站内通知' : '开启浏览器提醒，在使用其他应用时也能获知新消息'}</span>{permission === 'default' && window.isSecureContext &&
        <Button size="sm" variant="outline" onClick={() => void requestPermission()}><Bell className="h-4 w-4"/>开启浏览器提醒</Button>}
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1">{[['unread', '未读'], ['all', '全部']].map(([value, label]) => <Button key={value}
                                                                                                           size="sm"
                                                                                                           variant={status === value ? 'default' : 'ghost'}
                                                                                                           onClick={() => select(setStatus, value)}>{label}{value === 'unread' && summary ? ` ${summary.unread}` : ''}</Button>)}</div>
        <select aria-label="通知分类" className="rounded-md border bg-background px-3 text-sm" value={category}
                onChange={e => select(setCategory, e.target.value)}>
          <option value="">全部分类</option>
          <option value="approval">审批</option>
          <option value="workflow">流程通知</option>
        </select><select aria-label="所属应用" className="max-w-48 rounded-md border bg-background px-3 text-sm"
                         value={appId} onChange={e => select(setAppId, e.target.value)}>
        <option value="">全部应用</option>
        {summary?.apps.map(app => <option key={app.appId} value={app.appId}>{app.name}</option>)}</select><Button
        variant="ghost" size="sm" aria-label="刷新通知" onClick={() => {
        reload();
        refresh()
      }}><RefreshCw className="h-4 w-4"/></Button></div>
      <p className="text-xs text-muted-foreground">“全部标为已读”作用于当前应用和分类下的全部通知</p>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-card">{error || summaryError ?
        <div role="alert" className="p-6 text-sm text-destructive">{error || summaryError}<Button variant="link"
                                                                                                  onClick={() => {
                                                                                                    reload();
                                                                                                    refresh()
                                                                                                  }}>重试</Button>
        </div> : loading ? <p className="p-6 text-sm text-muted-foreground">正在加载通知…</p> : !items.length ?
          <p className="p-12 text-center text-sm text-muted-foreground">暂无通知</p> : items.map(item => <div
            key={item.id}
            className={cn('flex items-start gap-3 border-b p-4', !item.readAt && 'border-l-2 border-l-primary')}><Bell
            className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"/>
            <button className="min-w-0 flex-1 text-left" onClick={() => setParams({open: item.id}, {replace: true})}><p
              className="text-sm font-medium">{item.title}</p><p
              className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.content}</p><p
              className="mt-2 text-xs text-muted-foreground">{item.appName} · {new Date(item.receivedAt).toLocaleString()}{!item.readAt && ' · 未读'}</p>
            </button>
            {!item.readAt &&
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void mark(item.id)}>标记已读</Button>}
          </div>)}</div>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / 30))} size={30} total={total} onChange={setPage}/>
      <Drawer open={!!open} onOpenChange={value => {
        if (!value) setParams({}, {replace: true})
      }}><DrawerContent className="w-[min(96vw,600px)]">
        <div className="border-b p-6 pr-12"><DrawerTitle>{detail?.title ?? '通知详情'}</DrawerTitle><DrawerDescription
          className="mt-2">{detail ? `${detail.appName} · ${new Date(detail.receivedAt).toLocaleString()}` : '查看消息内容'}</DrawerDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-6">{detailError ?
          <p role="alert" className="text-sm text-destructive">{detailError}<Button variant="link"
                                                                                    onClick={reloadDetail}>重试</Button>
          </p> : !detail ? <p className="text-sm text-muted-foreground">正在加载…</p> :
            <p className="whitespace-pre-wrap break-words text-sm leading-7">{detail.content}</p>}</div>
        {detail && <div className="border-t p-4">{detail.canNavigate && detail.approval ?
          <Button onClick={() => setShowApproval(true)}>查看审批</Button> : detail.instanceId ?
            <p className="text-xs text-muted-foreground">关联审批已不可用或暂无查看权限</p> : null}</div>}
      </DrawerContent></Drawer>
      {showApproval && detail?.approval &&
        <AppRecordDrawer
          open
          onOpenChange={(open) => {
            if (!open) setShowApproval(false)
          }}
          appId={detail.approval.appId}
          formName={detail.approval.formName}
          recordId={detail.approval.recordId}
          approvalInstanceId={detail.approval.id}
          stacked={false}
          onSaved={reload}
        />}
    </div>
  </AppLayout>
}

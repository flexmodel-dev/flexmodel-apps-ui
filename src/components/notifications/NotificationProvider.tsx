import * as React from 'react'
import {createPortal} from 'react-dom'
import {useNavigate} from 'react-router-dom'
import {Bell, X} from 'lucide-react'
import {clearAuthSession, getAuthSession} from '@/services/auth'
import {connectNotifications} from '@/services/notificationConnection'
import {
  type AppNotification,
  listNotifications,
  notificationSummary,
  type NotificationSummary
} from '@/services/notifications'
import {NotificationDetailDrawer} from '@/components/notifications/NotificationDetailDrawer'
import {toErrorMessage} from '@/lib/utils'

interface NotificationState {
  summary: NotificationSummary | null;
  recent: AppNotification[];
  revision: number
  status: string;
  error: string;
  refresh: () => void
  openNotification: (id: string) => void
}

const Context = React.createContext<NotificationState | null>(null)
export const useNotifications = () => {
  const value = React.useContext(Context)
  if (!value) throw new Error('缺少通知上下文')
  return value
}

export function NotificationProvider({children}: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const navigateRef = React.useRef(navigate)
  navigateRef.current = navigate
  const [summary, setSummary] = React.useState<NotificationSummary | null>(null)
  const [recent, setRecent] = React.useState<AppNotification[]>([])
  const [revision, bump] = React.useReducer(value => value + 1, 0)
  const [status, setStatus] = React.useState('connecting')
  const [error, setError] = React.useState('')
  const [toasts, setToasts] = React.useState<AppNotification[]>([])
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const openNotification = React.useCallback((id: string) => setDetailId(id), [])
  const refreshRef = React.useRef<() => void>(() => {
  })
  React.useEffect(() => {
    const session = getAuthSession()
    if (!session) return
    let active = true, version = -1n, timer: number | undefined
    const load = async () => {
      try {
        const [next, list] = await Promise.all([notificationSummary(), listNotifications({status: 'unread', size: 5})])
        if (!active || BigInt(next.version) < version) return
        version = BigInt(next.version);
        setSummary(next);
        setRecent(list.list);
        setError('')
      } catch (cause) {
        if (active) setError(toErrorMessage(cause, '通知加载失败'))
      }
    }
    const refresh = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 100)
    }
    refreshRef.current = refresh
    void load()
    const stop = connectNotifications({
      session, onStatus: setStatus, onAlert: item => setToasts(current => [...current, item].slice(-3)),
      onUnauthorized: () => {
        clearAuthSession();
        navigateRef.current('/login', {replace: true})
      },
      onEvent: (type, data) => {
        if (type === 'ready' || BigInt(data.version) < version) return
        version = BigInt(data.version)
        if (data.unread !== undefined) setSummary(value => value ? {
          ...value,
          version: data.version,
          unread: data.unread!
        } : null)
        bump();
        refresh()
      },
    })
    const storage = (event: StorageEvent) => {
      if (event.key?.startsWith('flexmodel-apps.auth.')) window.location.reload()
    }
    window.addEventListener('storage', storage)
    return () => {
      active = false;
      clearTimeout(timer);
      stop();
      window.removeEventListener('storage', storage)
    }
  }, [])
  React.useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => setToasts(current => current.slice(1)), 6000);
    return () => clearTimeout(timer)
  }, [toasts])
  // 弹层（Drawer/Dialog）打开时 Radix 会给 body 设置 pointer-events: none，
  // 因此浮层需通过 Portal 挂到 body 并显式恢复 pointer-events，才能保持可点击。
  const toastLayer = <div
    className="pointer-events-none fixed right-4 top-20 z-[1200] flex w-[min(92vw,360px)] flex-col gap-2">{toasts.map(toast =>
    <div
      key={toast.id} role="status" data-app-toast
      className="pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-4 shadow-lg">
      <Bell className="mt-1 h-4 w-4 shrink-0 text-primary"/>
      <button className="min-w-0 flex-1 text-left" onClick={() => {
        openNotification(toast.id)
        setToasts(current => current.filter(item => item.id !== toast.id))
      }}><p className="text-sm font-medium">{toast.title}</p><p
        className="mt-1 text-xs text-muted-foreground">{toast.appName} · 点击查看</p></button>
      <button aria-label="关闭提醒" onClick={() => setToasts(current => current.filter(item => item.id !== toast.id))}>
        <X className="h-4 w-4 text-muted-foreground"/></button>
    </div>)}</div>
  return <Context.Provider
    value={{summary, recent, revision, status, error, refresh: () => refreshRef.current(), openNotification}}>{children}
    {createPortal(toastLayer, document.body)}
    <NotificationDetailDrawer
      notificationId={detailId}
      open={Boolean(detailId)}
      onOpenChange={(open) => {
        if (!open) setDetailId(null)
      }}
      onRead={() => refreshRef.current()}
    />
  </Context.Provider>
}

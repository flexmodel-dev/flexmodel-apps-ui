import {Link} from 'react-router-dom'
import {Bell} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {AppLoading} from '@/components/biz/AppLoading'
import {useNotifications} from './NotificationProvider'

export function NotificationBell({className}: { className?: string }) {
  const {summary, recent, error, refresh} = useNotifications()
  return <DropdownMenu onOpenChange={open => open && refresh()}><DropdownMenuTrigger asChild><Button variant="ghost"
                                                                                                     size="icon"
                                                                                                     title="通知"
                                                                                                     aria-label={`通知${summary ? `，${summary.unread} 条未读` : ''}`}
                                                                                                     className={className}>
    <Bell className="h-5 w-5"/>{!!summary?.unread && <span
    className="absolute -right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{summary.unread > 99 ? '99+' : summary.unread}</span>}
  </Button></DropdownMenuTrigger><DropdownMenuContent align="end"
                                                      className="w-[min(92vw,360px)]"><DropdownMenuLabel>通知{summary && ` · ${summary.unread} 条未读`}</DropdownMenuLabel><DropdownMenuSeparator/>
    {error ? <DropdownMenuItem onSelect={event => {
      event.preventDefault();
      refresh()
    }}>加载失败，点击重试</DropdownMenuItem> : !summary ?
      <AppLoading size="sm" className="p-4" label="正在加载通知"/> : recent.length ? recent.map(item =>
        <DropdownMenuItem key={item.id} asChild><Link to={`/notifications?open=${encodeURIComponent(item.id)}`}
                                                      className="block"><p className="truncate text-sm">{item.title}</p>
          <p
            className="mt-1 text-xs text-muted-foreground">{item.appName} · {new Date(item.receivedAt).toLocaleString()}</p>
        </Link></DropdownMenuItem>) : <p className="p-4 text-sm text-muted-foreground">暂无未读通知</p>}
    <DropdownMenuSeparator/><DropdownMenuItem asChild><Link to="/notifications">查看全部</Link></DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>
}

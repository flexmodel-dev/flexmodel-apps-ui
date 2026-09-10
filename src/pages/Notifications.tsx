import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { notifications } from '@/data/mock'
import { cn } from '@/lib/utils'
import { AlarmCheck, Bell, CheckCheck } from 'lucide-react'

const TYPE_TABS = [
  { t: 1, label: '未读通知' },
  { t: 3, label: '全部通知' },
  { t: 30, label: '动态' },
  { t: 40, label: '项目' },
  { t: 20, label: '审批' },
  { t: 10, label: '分配与共享' },
]

/** 通知中心（复刻 notification/messages.html） */
export default function Notifications() {
  const [params] = useSearchParams()
  const [type, setType] = React.useState(Number(params.get('type')) || 1)
  const [readAll, setReadAll] = React.useState(false)

  const list = notifications
    .filter((n) => (type === 1 ? n.unread : type === 3 ? true : n.type === type))
    .map((n) => (readAll ? { ...n, unread: false } : n))

  return (
    <AppLayout>
      <div className="container-smart mx-auto w-full max-w-[1080px]">
        <div className="tab-container">
          <div className="notification-tab relative mb-0 flex list-none items-center gap-1 border-b border-[#e3e3e3] dark:border-[#2e3340]">
            <Link
              to="/notifications"
              className="-mb-px inline-flex items-center gap-1.5 border-b-2 border-primary px-3 py-2.5 text-sm"
            >
              <Bell className="h-4 w-4" /> 通知
            </Link>
            <Link
              to="/notifications/todo"
              className="-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <AlarmCheck className="h-4 w-4" /> 待办
            </Link>
            <Button variant="secondary" size="sm" className="absolute right-0 top-1.5" onClick={() => setReadAll(true)}>
              <CheckCheck className="h-4 w-4" /> 已读全部
            </Button>
          </div>

          <div className="tab-content pt-4">
            <div className="row flex flex-col gap-4 md:flex-row">
              {/* 类型侧栏 */}
              <div className="notification-type w-full md:w-[25%]">
                <div className="mb-2 overflow-hidden rounded-xl border bg-card shadow-sm">
                  <a
                    className={cn('block px-4 py-2.5 text-sm', type === 1 ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent')}
                    onClick={() => setType(1)}
                  >
                    未读通知
                  </a>
                  <a
                    className={cn('block px-4 py-2.5 text-sm', type === 3 ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent')}
                    onClick={() => setType(3)}
                  >
                    全部通知
                  </a>
                </div>
                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                  {TYPE_TABS.slice(2).map((t) => (
                    <a
                      key={t.t}
                      className={cn('block px-4 py-2.5 text-sm', type === t.t ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent')}
                      onClick={() => setType(t.t)}
                    >
                      {t.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* 消息列表 */}
              <div className="min-w-0 flex-1" id="message-list">
                {list.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'mb-2 flex items-start gap-3 rounded-xl border bg-card p-3 shadow-sm',
                      n.unread && 'border-l-[3px] border-l-primary'
                    )}
                  >
                    <UserAvatar name={n.fromUser} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] leading-relaxed text-[#444] dark:text-[#ccc]">
                        <b className="font-medium">{n.fromUser}</b> {n.message}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-[#aaa]">
                        <span>{n.time}</span>
                        {n.unread && <span className="badge-primary">未读</span>}
                      </div>
                    </div>
                    <a className="mt-1 cursor-pointer text-xs text-muted-foreground hover:text-primary">标记已读</a>
                  </div>
                ))}
                {list.length === 0 && <div className="py-14 text-center text-sm text-muted-foreground">暂无通知</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

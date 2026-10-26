import { AppLayout } from '@/components/layout/AppLayout'
import { UserAvatar } from '@/components/ui/avatar'
import {getAuthSession} from '@/services/auth'

/** 个人设置：仅展示当前登录账号的真实信息，左侧应用菜单隐藏。 */
export default function UserSettings() {
  const session = getAuthSession()
  const user = session?.user
  const rows = [
    {label: '用户名', value: user?.name || '—'},
    {label: '邮箱', value: user?.email || '—'},
    {label: '用户 ID', value: user?.id || '—'},
  ]

  return (
    <AppLayout hideNavigation showBack>
      <div className="mx-auto w-full max-w-[760px] space-y-4">
        <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <div className="flex items-center gap-4 border-b pb-5">
            <UserAvatar name={user?.name || '?'} size={64}/>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{user?.name || '未登录'}</h1>
              <p className="mt-1 truncate text-sm text-muted-foreground">{user?.email || '未设置邮箱'}</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="mt-1 truncate text-sm font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-muted-foreground">账号信息由管理员维护。</p>
        </div>
      </div>
    </AppLayout>
  )
}

import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Menu, Moon, Plus, Search, Settings, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { RbDialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { topNavs } from '@/data/mock'

const notificationItems = [
  { id: 1, from: '钱迅', text: '提交的《华辰科技 - ERP 报价》需要你审批', time: '10 分钟前' },
  { id: 2, from: '超级管理员', text: '分配了 2 条客户记录给你', time: '32 分钟前' },
]

const createItems = [
  { label: '客户', to: '/app/Customer/list' },
  { label: '商机', to: '/app/Opportunity/list' },
  { label: '产品', to: '/app/Product/list' },
]

type PrimaryColor = 'indigo' | 'blue' | 'green' | 'amber' | 'rose'

const primaryColors = [
  { value: 'blue', label: '蓝', swatch: 'hsl(217 91% 60%)' },
  { value: 'indigo', label: '靛', swatch: 'hsl(243 75% 59%)' },
  { value: 'green', label: '绿', swatch: 'hsl(160 84% 39%)' },
  { value: 'amber', label: '橙', swatch: 'hsl(38 92% 50%)' },
  { value: 'rose', label: '玫', swatch: 'hsl(350 89% 60%)' },
] as const

export function TopHeader({
  activeTopId,
  onTopNavChange,
  onToggleSidebar,
}: {
  activeTopId: string
  onTopNavChange: (id: string) => void
  onToggleSidebar: () => void
}) {
  const navigate = useNavigate()
  const [adminOpen, setAdminOpen] = React.useState(false)
  const [isDark, setIsDark] = React.useState(() => {
    const stored = window.localStorage.getItem('night')
    if (stored === 'true' || stored === 'false') return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const [primary, setPrimary] = React.useState<PrimaryColor>(() => {
    const stored = window.localStorage.getItem('primary')
    return primaryColors.some((item) => item.value === stored) ? (stored as PrimaryColor) : 'blue'
  })

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.style.colorScheme = isDark ? 'dark' : 'light'
    window.localStorage.setItem('night', String(isDark))
  }, [isDark])

  React.useEffect(() => {
    const root = document.documentElement
    root.dataset.primary = primary
    window.localStorage.setItem('primary', primary)
  }, [primary])

  const submitAdminPassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAdminOpen(false)
    navigate('/admin/systems')
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/80 shadow-[0_1px_0_0] shadow-primary/10 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} title="展开/收起">
          <Menu className="h-5 w-5" />
        </Button>
        <Link to="/dashboard/home" className="mr-2 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            N
          </span>
          <span className="text-lg font-semibold text-primary">newbuild</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {topNavs.map((nav) => (
            <Link
              key={nav.id}
              to={nav.to}
              onClick={() => onTopNavChange(nav.id)}
              className={
                activeTopId === nav.id
                  ? 'rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary shadow-sm'
                  : 'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary'
              }
            >
              {nav.text}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="新建">
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {createItems.map((item) => (
                <DropdownMenuItem key={item.label} asChild>
                  <Link to={item.to}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" title="搜索">
            <Search className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" title="后台设置" onClick={() => setAdminOpen(true)}>
            <Settings className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" title={isDark ? '切换到浅色模式' : '切换到夜间模式'} onClick={() => setIsDark((value) => !value)}>
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="通知" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[320px]">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>通知</span>
                <Badge>2</Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notificationItems.map((item) => (
                <DropdownMenuItem key={item.id} className="block items-start">
                  <div className="flex items-start gap-3">
                    <UserAvatar name={item.from} size={28} />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{item.text}</p>
                      <p className="text-xs text-muted-foreground">{item.time}</p>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/notifications" className="w-full justify-center">
                  查看全部
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium transition-colors hover:bg-accent">
                <UserAvatar name="超级管理员" size={30} />
                <span className="hidden text-sm md:inline">超级管理员</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-2">
                <p className="text-sm font-medium">超级管理员</p>
                <p className="text-xs text-muted-foreground">admin@example.com</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/login">个人设置</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/login">退出登录</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-2">
                <p className="text-xs font-medium text-muted-foreground">主色</p>
                <div className="mt-2 flex items-center gap-2">
                  {primaryColors.map(({ value, label, swatch }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPrimary(value)}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full border border-border/60 transition-all hover:scale-105',
                        primary === value && 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background',
                      )}
                      style={{ backgroundColor: swatch }}
                      title={label}
                    >
                    </button>
                  ))}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <RbDialog
        open={adminOpen}
        onOpenChange={setAdminOpen}
        title="后台设置"
        footer={
          <>
            <Button variant="outline" onClick={() => setAdminOpen(false)}>
              取消
            </Button>
            <Button form="admin-password-form" type="submit">
              进入后台
            </Button>
          </>
        }
      >
        <form id="admin-password-form" className="space-y-2" onSubmit={submitAdminPassword}>
          <label htmlFor="admin-password" className="text-sm font-medium text-foreground">
            管理员密码
          </label>
          <Input
            id="admin-password"
            type="password"
            placeholder="请输入管理员密码"
            autoComplete="current-password"
          />
        </form>
      </RbDialog>
    </header>
  )
}

import * as React from 'react'
import {Link} from 'react-router-dom'
import {Bell, Menu, Moon, Sun, type LucideIcon} from 'lucide-react'
import {cn} from '@/lib/utils'
import {Button} from '@/components/ui/button'
import {UserAvatar} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type {NavItem, TopNavItem} from '@/data/mock'
import {clearAuthSession, getAuthSession} from '@/services/auth'
import {MobileNavDrawer} from './MobileNavDrawer'

export const headerActionClass =
  'text-white/80 hover:bg-white/15 hover:text-white data-[state=open]:bg-white/20 data-[state=open]:text-white dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white dark:data-[state=open]:bg-white/10 dark:data-[state=open]:text-white'

const notificationItems = [
  {id: 1, from: '钱迅', text: '提交的《华辰科技 - ERP 报价》需要你审批', time: '10 分钟前'},
  {id: 2, from: '超级管理员', text: '分配了 2 条客户记录给你', time: '32 分钟前'},
]

function TopHeaderShell({
                          brand,
                          logoIcon,
                          mobileTitle,
                          mobileNavs,
                          topNavs,
                          activeTopId,
                          onTopNavChange,
                          extraActions,
                        }: {
  brand: string
  mobileTitle: string
  mobileNavs: NavItem[]
  topNavs?: TopNavItem[]
  activeTopId?: string
  onTopNavChange?: (id: string) => void
  extraActions?: React.ReactNode
  logoIcon?: LucideIcon
}) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const [authUser, setAuthUser] = React.useState(() => getAuthSession()?.user ?? null)
  const LogoIcon = logoIcon
  const [isDark, setIsDark] = React.useState(() => {
    const stored = window.localStorage.getItem('night')
    if (stored === 'true' || stored === 'false') return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.style.colorScheme = isDark ? 'dark' : 'light'
    window.localStorage.setItem('night', String(isDark))
  }, [isDark])

  const logout = () => {
    clearAuthSession()
    setAuthUser(null)
  }

  React.useEffect(() => {
    document.documentElement.dataset.primary = 'indigo'
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b shadow-sm',
        isDark
          ? 'border-white/10 bg-[#0f172a] text-white'
          : 'border-black/10 bg-primary text-primary-foreground',
      )}
    >
      <div className="flex h-16 min-w-0 items-center gap-2 px-4">
        <Button
          variant="ghost"
          size="icon"
          title="打开导航菜单"
          className={cn('shrink-0 md:hidden', headerActionClass)}
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="h-5 w-5"/>
        </Button>
        <Link to="/dashboard/home" className="mr-2 flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold shadow-sm',
              isDark ? 'bg-primary/20 text-primary' : 'bg-white/20 text-primary-foreground',
            )}
          >
            {LogoIcon ? <LogoIcon className="h-5 w-5"/> : 'N'}
          </span>
          <span className="max-w-[34vw] truncate text-base font-semibold sm:text-lg">{brand}</span>
        </Link>

        {topNavs && (
          <nav className="ml-2 hidden h-16 items-stretch md:flex">
            {topNavs.map((nav) => (
              <Link
                key={nav.id}
                to={nav.to}
                onClick={() => onTopNavChange?.(nav.id)}
                className={cn(
                  'relative flex h-16 items-center px-3 text-sm transition-colors',
                  activeTopId === nav.id
                    ? isDark
                      ? 'bg-white/10 font-medium text-white'
                      : 'bg-black/20 font-medium text-primary-foreground'
                    : isDark
                      ? 'text-white/65 hover:bg-white/5 hover:text-white'
                      : 'text-primary-foreground/75 hover:bg-primary-foreground/15 hover:text-primary-foreground',
                )}
              >
                {nav.text}
                <span
                  className={cn(
                    'absolute bottom-0 left-1/2 h-[3px] w-3.5 -translate-x-1/2 rounded-full transition-opacity',
                    isDark ? 'bg-primary/90' : 'bg-primary-foreground/90',
                    activeTopId === nav.id ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          {extraActions}
          <Button
            variant="ghost"
            size="icon"
            title={isDark ? '切换到浅色模式' : '切换到夜间模式'}
            onClick={() => setIsDark((value) => !value)}
            className={headerActionClass}
          >
            {isDark ? <Sun className="h-5 w-5"/> : <Moon className="h-5 w-5"/>}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="通知" className={cn('relative', headerActionClass)}>
                <Bell className="h-5 w-5"/>
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive"/>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[320px]">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>通知</span>
                <Badge>2</Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator/>
              {notificationItems.map((item) => (
                <DropdownMenuItem key={item.id} className="block items-start">
                  <div className="flex items-start gap-3">
                    <UserAvatar name={item.from} size={28}/>
                    <div className="min-w-0">
                      <p className="truncate text-sm">{item.text}</p>
                      <p className="text-xs text-muted-foreground">{item.time}</p>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator/>
              <DropdownMenuItem asChild>
                <Link to="/notifications" className="w-full justify-center">
                  查看全部
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-white/80 transition-colors',
                  'hover:bg-white/15 hover:text-white data-[state=open]:bg-white/20 data-[state=open]:text-white',
                  'dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white dark:data-[state=open]:bg-white/10 dark:data-[state=open]:text-white',
                )}
              >
                <UserAvatar name={authUser?.name ?? '未登录'} size={30}/>
                <span className="hidden text-sm md:inline">{authUser?.name ?? '未登录'}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-2">
                <p className="text-sm font-medium">{authUser?.name ?? '未登录'}</p>
                <p className="text-xs text-muted-foreground">{authUser?.email ?? ''}</p>
              </div>
              <DropdownMenuSeparator/>
              <DropdownMenuItem asChild>
                <Link to="/settings/user">个人设置</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/login" onClick={logout}>退出登录</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <MobileNavDrawer
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        title={mobileTitle}
        navs={mobileNavs}
        topNavs={topNavs}
        activeTopId={activeTopId}
        onTopNavChange={onTopNavChange}
      />
    </header>
  )
}

export {TopHeaderShell}

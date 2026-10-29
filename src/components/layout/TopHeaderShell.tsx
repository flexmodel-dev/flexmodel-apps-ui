import * as React from 'react'
import {Link} from 'react-router-dom'
import {Menu, Moon, Sun, type LucideIcon} from 'lucide-react'
import {cn} from '@/lib/utils'
import {Button} from '@/components/ui/button'
import {UserAvatar} from '@/components/ui/avatar'
import {NotificationBell} from '@/components/notifications/NotificationBell'
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
import {useDarkMode} from '@/lib/useDarkMode'
import {MobileNavDrawer} from './MobileNavDrawer'

export const headerActionClass =
  'text-white/80 hover:bg-white/15 hover:text-white data-[state=open]:bg-white/20 data-[state=open]:text-white dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white dark:data-[state=open]:bg-white/10 dark:data-[state=open]:text-white'


function TopHeaderShell({
                          brand, brandTo,
                          logoIcon,
                          mobileTitle,
                          mobileNavs,
                          topNavs,
                          activeTopId,
                          onTopNavChange,
                          leading,
                          extraActions,
                        }: {
  brand: string
  brandTo?: string
  mobileTitle: string
  mobileNavs: NavItem[]
  topNavs?: TopNavItem[]
  activeTopId?: string
  onTopNavChange?: (id: string) => void
  leading?: React.ReactNode
  extraActions?: React.ReactNode
  logoIcon?: LucideIcon
}) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const [authUser, setAuthUser] = React.useState(() => getAuthSession()?.user ?? null)
  React.useEffect(() => {
    const syncUser = () => setAuthUser(getAuthSession()?.user ?? null)
    window.addEventListener('auth-user-updated', syncUser)
    window.addEventListener('storage', syncUser)
    return () => {
      window.removeEventListener('auth-user-updated', syncUser)
      window.removeEventListener('storage', syncUser)
    }
  }, [])
  const LogoIcon = logoIcon
  const [isDark, setIsDark] = useDarkMode()

  const logout = () => {
    clearAuthSession()
    setAuthUser(null)
  }
  const hasNavigation = mobileNavs.length > 0 || (topNavs?.length ?? 0) > 0

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
        {hasNavigation && (
          <Button
            variant="ghost"
            size="icon"
            title="打开导航菜单"
            className={cn('shrink-0 md:hidden', headerActionClass)}
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5"/>
          </Button>
        )}
        {leading}
        {brandTo ? (
          <Link to={brandTo} className="mr-2 flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold shadow-sm',
                isDark ? 'bg-primary/20 text-primary' : 'bg-white/20 text-primary-foreground',
              )}
            >
              {LogoIcon ? <LogoIcon className="h-5 w-5"/> : 'F'}
            </span>
            <span className="max-w-[34vw] truncate text-base font-semibold sm:text-lg">{brand}</span>
          </Link>
        ) : (
          <div className="mr-2 flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold shadow-sm',
                isDark ? 'bg-primary/20 text-primary' : 'bg-white/20 text-primary-foreground',
              )}
            >
              {LogoIcon ? <LogoIcon className="h-5 w-5"/> : 'F'}
            </span>
            <span className="max-w-[34vw] truncate text-base font-semibold sm:text-lg">{brand}</span>
          </div>
        )}

        {topNavs && topNavs.length > 0 && (
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

          <NotificationBell className={cn('relative', headerActionClass)}/>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-white/80 transition-colors',
                  'hover:bg-white/15 hover:text-white data-[state=open]:bg-white/20 data-[state=open]:text-white',
                  'dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white dark:data-[state=open]:bg-white/10 dark:data-[state=open]:text-white',
                )}
              >
                <UserAvatar name={authUser?.name ?? '未登录'} src={authUser?.avatar} size={30}/>
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

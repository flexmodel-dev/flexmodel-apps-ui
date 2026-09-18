import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Menu, Moon, Plus, Search, Settings, Sun, X } from 'lucide-react'
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
import { entities, topNavs } from '@/data/mock'
import { MobileNavDrawer } from './MobileNavDrawer'
import type { NavItem } from '@/data/mock'

const notificationItems = [
  { id: 1, from: '钱迅', text: '提交的《华辰科技 - ERP 报价》需要你审批', time: '10 分钟前' },
  { id: 2, from: '超级管理员', text: '分配了 2 条客户记录给你', time: '32 分钟前' },
]

const createItems = [
  { label: '客户', to: '/app/Customer/list' },
  { label: '商机', to: '/app/Opportunity/list' },
  { label: '产品', to: '/app/Product/list' },
]

const searchSuggestions = [
  { label: '工作台', to: '/dashboard/home' },
  ...entities.map((entity) => ({ label: entity.label, to: `/app/${entity.name}/list` })),
  { label: '审批中心', to: '/approval/home' },
  { label: '动态', to: '/feeds/home' },
  { label: '文件', to: '/files/home' },
  { label: '通知', to: '/notifications' },
]

const headerActionClass =
  'text-white/80 hover:bg-white/15 hover:text-white data-[state=open]:bg-white/20 data-[state=open]:text-white dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white dark:data-[state=open]:bg-white/10 dark:data-[state=open]:text-white'

type PrimaryColor = 'indigo' | 'blue' | 'green' | 'amber' | 'rose' | 'black'

const primaryColorVersion = 'v2'
const defaultPrimaryColor: PrimaryColor = 'indigo'

const primaryColors = [
  { value: 'indigo', label: '靛', swatch: 'hsl(243 75% 59%)' },
  { value: 'blue', label: '蓝', swatch: 'hsl(217 91% 60%)' },
  { value: 'green', label: '绿', swatch: 'hsl(160 84% 39%)' },
  { value: 'amber', label: '橙', swatch: 'hsl(38 92% 50%)' },
  { value: 'rose', label: '玫', swatch: 'hsl(350 89% 60%)' },
  { value: 'black', label: '黑', swatch: 'hsl(0 0% 9%)' },
] as const

export function TopHeader({
  activeTopId,
  onTopNavChange,
  isAdmin = false,
  mobileNavs = [],
}: {
  activeTopId: string
  onTopNavChange: (id: string) => void
  isAdmin?: boolean
  mobileNavs?: NavItem[]
}) {
  const navigate = useNavigate()
  const [adminOpen, setAdminOpen] = React.useState(false)
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState('')
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const searchWrapperRef = React.useRef<HTMLDivElement>(null)
  const [isDark, setIsDark] = React.useState(() => {
    const stored = window.localStorage.getItem('night')
    if (stored === 'true' || stored === 'false') return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const [primary, setPrimary] = React.useState<PrimaryColor>(() => {
    const storedVersion = window.localStorage.getItem('primaryVersion')
    const stored = window.localStorage.getItem('primary')
    if (storedVersion === primaryColorVersion) {
      return primaryColors.some((item) => item.value === stored)
        ? (stored as PrimaryColor)
        : defaultPrimaryColor
    }
    return stored && stored !== 'blue'
      ? (stored as PrimaryColor)
      : defaultPrimaryColor
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
    window.localStorage.setItem('primaryVersion', primaryColorVersion)
  }, [primary])

  React.useEffect(() => {
    if (!searchOpen) return
    searchInputRef.current?.focus()
  }, [searchOpen])

  React.useEffect(() => {
    if (!searchOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
        setSearchValue('')
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [searchOpen])

  const filteredSuggestions = searchValue.trim()
    ? searchSuggestions.filter((item) => item.label.toLowerCase().includes(searchValue.trim().toLowerCase()))
    : searchSuggestions

  const submitAdminPassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAdminOpen(false)
    navigate('/admin/systems')
  }

  React.useEffect(() => {
    if (isAdmin) {
      setSearchOpen(false)
      setSearchValue('')
    }
  }, [isAdmin])

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchValue('')
  }

  const navigateToSearchResult = (to: string) => {
    navigate(to)
    closeSearch()
  }

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
          <Menu className="h-5 w-5" />
        </Button>
        <Link to="/dashboard/home" className="mr-2 flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold shadow-sm',
              isDark ? 'bg-primary/20 text-primary' : 'bg-white/20 text-primary-foreground',
            )}
          >
            N
          </span>
          <span className="max-w-[34vw] truncate text-base font-semibold sm:text-lg">
            {isAdmin ? 'NEWBUILD管理后台' : 'NEWBUILD'}
          </span>
        </Link>

        {!isAdmin && (
          <nav className="ml-2 hidden h-16 items-stretch md:flex">
            {topNavs.map((nav) => (
              <Link
                key={nav.id}
                to={nav.to}
                onClick={() => onTopNavChange(nav.id)}
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
          {!isAdmin && searchOpen && (
            <div ref={searchWrapperRef} className="relative mr-1 w-[min(18rem,46vw)]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchValue}
                placeholder="搜索菜单或业务"
                className="h-9 rounded-full border-transparent bg-white/90 pl-8 text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:ring-primary/30 focus-visible:ring-offset-primary"
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') closeSearch()
                  if (event.key === 'Enter' && filteredSuggestions.length > 0) {
                    navigate(filteredSuggestions[0].to)
                    closeSearch()
                  }
                }}
              />
              {searchValue && filteredSuggestions.length > 0 && (
                <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
                  {filteredSuggestions.slice(0, 6).map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                      onClick={() => {
                        navigate(item.to)
                        closeSearch()
                      }}
                    >
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {!isAdmin && (
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="新建" className={headerActionClass}>
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
          )}

          {!isAdmin && !searchOpen && (
            <Button
              variant="ghost"
              size="icon"
              title="搜索"
              className={headerActionClass}
              onClick={() => setSearchOpen(true)}
            >
            <Search className="h-5 w-5" />
          </Button>
          )}

          {!isAdmin && (
            <Button variant="ghost" size="icon" title="后台设置" onClick={() => setAdminOpen(true)} className={headerActionClass}>
              <Settings className="h-5 w-5" />
            </Button>
          )}

          <Button variant="ghost" size="icon" title={isDark ? '切换到浅色模式' : '切换到夜间模式'} onClick={() => setIsDark((value) => !value)} className={headerActionClass}>
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="通知" className={cn('relative', headerActionClass)}>
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
              <button
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-white/80 transition-colors',
                  'hover:bg-white/15 hover:text-white data-[state=open]:bg-white/20 data-[state=open]:text-white',
                  'dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white dark:data-[state=open]:bg-white/10 dark:data-[state=open]:text-white',
                )}
              >
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
                <Link to="/settings/user">个人设置</Link>
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

      <MobileNavDrawer
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        title={isAdmin ? '后台菜单' : '菜单'}
        navs={mobileNavs}
        topNavs={isAdmin ? undefined : topNavs}
        activeTopId={isAdmin ? undefined : activeTopId}
        onTopNavChange={isAdmin ? undefined : onTopNavChange}
      />

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

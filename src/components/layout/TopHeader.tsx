import * as React from 'react'
import { Link } from 'react-router-dom'
import { Bell, HelpCircle, Menu, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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

const themes = [
  { name: '默认', className: 'bg-primary' },
  { name: '浅色', className: 'bg-secondary' },
  { name: '深色', className: 'bg-zinc-800' },
  { name: '蓝色', className: 'bg-blue-600' },
  { name: '绿色', className: 'bg-emerald-600' },
]

export function TopHeader({
  activeTopId,
  onTopNavChange,
  onToggleSidebar,
}: {
  activeTopId: string
  onTopNavChange: (id: string) => void
  onToggleSidebar: () => void
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/80 shadow-[0_1px_0_0] shadow-primary/10 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} title="展开/收起">
          <Menu className="h-5 w-5" />
        </Button>
        <Link to="/dashboard/home" className="mr-2 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary via-primary to-cyan-500 text-sm font-bold text-primary-foreground shadow-sm">
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

          <Button variant="ghost" size="icon" title="管理中心" asChild>
            <Link to="/admin/systems">
              <HelpCircle className="h-5 w-5" />
            </Link>
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
                <p className="text-xs font-medium text-muted-foreground">主题</p>
                <div className="mt-2 flex items-center gap-2">
                  {themes.map((theme) => (
                    <span key={theme.name} title={theme.name} className={`h-5 w-5 rounded-full border ${theme.className}`} />
                  ))}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

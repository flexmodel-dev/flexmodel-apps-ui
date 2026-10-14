import * as React from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {Plus, Search, Settings} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  appIcons,
  businessObjects,
  getAppMenuForBusinessObject,
  topNavs,
  type NavItem,
  type TopNavItem,
} from '@/data/mock'
import {type App} from '@/services/apps'
import {TopHeaderShell, headerActionClass} from './TopHeaderShell'

const searchSuggestions = [
  {label: '工作台', to: '/dashboard/home'},
  ...businessObjects.flatMap((businessObject) => {
    const menu = getAppMenuForBusinessObject(businessObject.name)
    return menu ? [{label: businessObject.label, to: `/apps/${menu.appId}/${menu.menuId}`}] : []
  }),
  {label: '审批中心', to: '/approval/home'},
  {label: '动态', to: '/feeds/home'},
  {label: '文件', to: '/files/home'},
  {label: '通知', to: '/notifications'},
]

export function AppTopHeader({
                               activeTopId,
                               onTopNavChange,
                               mobileNavs,
                               app,
                               topNavItems = topNavs,
                               isAppLoading = false,
                               isMenusLoading = false,
                               createRecordItems,
                               onCreateRecord,
                             }: {
  activeTopId: string
  onTopNavChange: (id: string) => void
  mobileNavs: NavItem[]
  app?: App
  topNavItems?: TopNavItem[]
  isAppLoading?: boolean
  isMenusLoading?: boolean
  createRecordItems: Array<{ id: string; label: string }>
  onCreateRecord: (formName: string) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState('')
  const [createOpen, setCreateOpen] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const searchWrapperRef = React.useRef<HTMLDivElement>(null)

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

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchValue('')
  }

  const currentApp = app
  const brand = currentApp?.name ?? (isAppLoading ? '…' : '应用')
  const LogoIcon = appIcons[currentApp?.iconName ?? 'Boxes'] ?? appIcons.Boxes

  const filteredSuggestions = searchValue.trim()
    ? searchSuggestions.filter((item) => item.label.toLowerCase().includes(searchValue.trim().toLowerCase()))
    : searchSuggestions

  return (
    <TopHeaderShell
      brand={brand} brandTo={currentApp ? `/apps/${currentApp.id}` : undefined}
      logoIcon={LogoIcon}
      mobileTitle="菜单"
      mobileNavs={mobileNavs}
      topNavs={topNavItems}
      activeTopId={activeTopId}
      onTopNavChange={onTopNavChange}
      extraActions={
        <>
          {searchOpen && (
            <div ref={searchWrapperRef} className="relative mr-1 w-[min(18rem,46vw)]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"/>
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
                <div
                  className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
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
                      <Search className="h-3.5 w-3.5 text-muted-foreground"/>
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <DropdownMenu open={createOpen} onOpenChange={setCreateOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="新增记录" className={headerActionClass}>
                <Plus className="h-5 w-5"/>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>选择表单</DropdownMenuLabel>
              {isAppLoading || isMenusLoading ? (
                <DropdownMenuItem disabled>加载中…</DropdownMenuItem>
              ) : createRecordItems.length === 0 ? (
                <DropdownMenuItem disabled>当前应用菜单暂未绑定表单</DropdownMenuItem>
              ) : (
                createRecordItems.map((item) => (
                  <DropdownMenuItem key={item.id} onClick={() => onCreateRecord(item.id)}>
                    {item.label}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {!searchOpen && (
            <Button
              variant="ghost"
              size="icon"
              title="搜索"
              className={headerActionClass}
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-5 w-5"/>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            title="后台设置"
            onClick={() => navigate('/admin/apps')}
            className={headerActionClass}
          >
            <Settings className="h-5 w-5"/>
          </Button>
        </>
      }
    />
  )
}

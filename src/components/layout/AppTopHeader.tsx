import * as React from 'react'
import {Link, useLocation, useNavigate} from 'react-router-dom'
import {Plus, Search, Settings} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

const createItems = businessObjects.flatMap((businessObject) => {
  const menu = getAppMenuForBusinessObject(businessObject.name)
  return menu ? [{label: businessObject.label, to: `/apps/${menu.appId}/${menu.menuId}`}] : []
})

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
                             }: {
  activeTopId: string
  onTopNavChange: (id: string) => void
  mobileNavs: NavItem[]
  app?: App
  topNavItems?: TopNavItem[]
  isAppLoading?: boolean
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState('')
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="新建" className={headerActionClass}>
                <Plus className="h-5 w-5"/>
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

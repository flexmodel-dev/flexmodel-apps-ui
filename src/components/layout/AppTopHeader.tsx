import * as React from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {ArrowLeft, Plus, Search, Settings} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {cn} from '@/lib/utils'
import {AppLoading} from '@/components/biz/AppLoading'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {type NavItem, type TopNavItem} from '@/data/mock'
import {appIcons} from '@/data/appIcons'
import {type App} from '@/services/apps'
import {type AppNav} from '@/services/appNavigation'
import {headerActionClass, TopHeaderShell} from './TopHeaderShell'

interface SearchSuggestion {
  label: string
  to: string
  hint?: string
  keywords: string
}

function collectNavSearchItems(navs: AppNav[], appId: string, parentPath: string[] = []): SearchSuggestion[] {
  return navs.flatMap((nav) => {
    const path = [...parentPath, nav.name]
    const item = nav.type === 'ENTRY'
      ? [{
        label: nav.name,
        to: nav.pageRoute ?? `/apps/${appId}/${nav.id}`,
        hint: parentPath.length ? parentPath.join(' / ') : undefined,
        keywords: path.join(' '),
      }]
      : []
    return [...item, ...collectNavSearchItems(nav.children ?? [], appId, path)]
  })
}

export function AppTopHeader({
                               activeTopId,
                               onTopNavChange,
                               mobileNavs,
                               app,
                               appId,
                               navs = [],
                               topNavItems,
                               showSearch = true,
                               showBack = false,
                               isAppLoading = false,
                               isNavsLoading = false,
                               createRecordItems,
                               onCreateRecord,
                             }: {
  activeTopId: string
  onTopNavChange: (id: string) => void
  mobileNavs: NavItem[]
  app?: App
  appId?: string
  navs?: AppNav[]
  topNavItems?: TopNavItem[]
  showSearch?: boolean
  showBack?: boolean
  isAppLoading?: boolean
  isNavsLoading?: boolean
  createRecordItems: Array<{ id: string; label: string }>
  onCreateRecord: (formName: string) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState('')
  const [activeSuggestion, setActiveSuggestion] = React.useState(-1)
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

  const goBack = () => {
    if (location.key === 'default') {
      navigate('/admin/apps')
      return
    }
    navigate(-1)
  }

  const currentApp = app
  const brand = currentApp?.name ?? (isAppLoading ? '…' : '应用')
  const LogoIcon = appIcons[currentApp?.iconName ?? 'Boxes'] ?? appIcons.Boxes

  const navSuggestions = React.useMemo(
    () => collectNavSearchItems(navs, appId ?? currentApp?.id ?? ''),
    [navs, appId, currentApp?.id],
  )
  const searchQuery = searchValue.trim().toLowerCase()
  const filteredSuggestions = (searchQuery
      ? navSuggestions.filter((item) => item.keywords.toLowerCase().includes(searchQuery))
      : navSuggestions
  ).slice(0, 8)

  React.useEffect(() => {
    setActiveSuggestion(-1)
  }, [searchQuery, filteredSuggestions.length, searchOpen])

  const moveActiveSuggestion = (step: number) => {
    if (!filteredSuggestions.length) return
    setActiveSuggestion((current) => {
      const next = current + step
      if (next < 0) return filteredSuggestions.length - 1
      if (next >= filteredSuggestions.length) return 0
      return next
    })
  }

  const openSuggestion = (index: number) => {
    const item = filteredSuggestions[index] ?? filteredSuggestions[0]
    if (!item) return
    navigate(item.to)
    closeSearch()
  }

  return (
    <TopHeaderShell
      brand={brand} brandTo={currentApp ? `/apps/${currentApp.id}` : undefined}
      logoIcon={LogoIcon}
      mobileTitle="菜单"
      mobileNavs={mobileNavs}
      topNavs={topNavItems}
      activeTopId={activeTopId}
      onTopNavChange={onTopNavChange}
      leading={showBack ? (
        <Button
          variant="ghost"
          size="icon"
          title="返回上一页"
          className={cn('shrink-0', headerActionClass)}
          onClick={goBack}
        >
          <ArrowLeft className="h-5 w-5"/>
        </Button>
      ) : undefined}
      extraActions={
        <>
          {showSearch && searchOpen && (
            <div ref={searchWrapperRef} className="relative mr-1 w-[min(18rem,46vw)]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"/>
              <Input
                ref={searchInputRef}
                value={searchValue}
                placeholder="搜索菜单"
                className="h-9 rounded-full border-transparent bg-white/90 pl-8 text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:ring-primary/30 focus-visible:ring-offset-primary"
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') closeSearch()
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    moveActiveSuggestion(1)
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    moveActiveSuggestion(-1)
                  }
                  if (event.key === 'Enter' && filteredSuggestions.length > 0) {
                    event.preventDefault()
                    openSuggestion(activeSuggestion < 0 ? 0 : activeSuggestion)
                  }
                }}
              />
              {searchOpen && (
                <div
                  className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
                  {isNavsLoading ? (
                    <AppLoading size="sm" className="px-3 py-2" label="正在加载菜单"/>
                  ) : filteredSuggestions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {searchQuery ? '没有匹配的菜单' : '当前应用暂无菜单'}
                    </div>
                  ) : filteredSuggestions.map((item, index) => (
                    <button
                      key={`${item.to}-${item.label}-${index}`}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                        index === activeSuggestion && 'bg-accent',
                      )}
                      onMouseEnter={() => setActiveSuggestion(index)}
                      onClick={() => openSuggestion(index)}
                    >
                      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint && <span
                        className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">{item.hint}</span>}
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
              {isAppLoading || isNavsLoading ? (
                <DropdownMenuItem disabled><AppLoading size="sm" className="p-0"/></DropdownMenuItem>
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

          {showSearch && !searchOpen && (
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

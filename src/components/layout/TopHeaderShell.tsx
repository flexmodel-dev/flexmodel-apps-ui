import * as React from 'react'
import {Link} from 'react-router-dom'
import {Menu, Moon, Sun, type LucideIcon} from 'lucide-react'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {arrayMove, horizontalListSortingStrategy, SortableContext, useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {cn} from '@/lib/utils'
import {Button} from '@/components/ui/button'
import {UserAvatar} from '@/components/ui/avatar'
import {NotificationBell} from '@/components/notifications/NotificationBell'
import {AiHeaderButton} from '@/components/ai/AiHeaderButton'
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
import {NavMenuActions, type OnNavMenuAction} from './NavMenuActions'

export const headerActionClass =
  'text-white/80 hover:bg-white/15 hover:text-white data-[state=open]:bg-white/20 data-[state=open]:text-white dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white dark:data-[state=open]:bg-white/10 dark:data-[state=open]:text-white'


interface SortableLinkProps {
  ref?: (node: HTMLElement | null) => void
  style?: React.CSSProperties
  dragAttributes?: Record<string, unknown>
  listeners?: Record<string, unknown>
  isDragging?: boolean
}

function TopNavLink({
                      nav,
                      activeTopId,
                      isDark,
                      onTopNavChange,
                      sortable,
                      onNavAction,
                    }: {
  nav: TopNavItem
  activeTopId?: string
  isDark: boolean
  onTopNavChange?: (id: string) => void
  sortable?: SortableLinkProps
  onNavAction?: OnNavMenuAction
}) {
  const active = activeTopId === nav.id
  return (
    <div
      ref={sortable?.ref}
      style={sortable?.style}
      className={cn(
        'relative flex h-16 shrink-0 items-center text-sm transition-colors',
        active
          ? isDark
            ? 'bg-white/10 font-medium text-white'
            : 'bg-black/20 font-medium text-primary-foreground'
          : isDark
            ? 'text-white/65 hover:bg-white/5 hover:text-white'
            : 'text-primary-foreground/75 hover:bg-primary-foreground/15 hover:text-primary-foreground',
        sortable?.isDragging && 'z-10 opacity-60',
      )}
    >
      <Link to={nav.to} draggable={false} onClick={() => onTopNavChange?.(nav.id)}
            {...(sortable?.dragAttributes ?? {})} {...(sortable?.listeners ?? {})}
            className={cn('flex h-full items-center justify-center whitespace-nowrap', onNavAction ? 'px-6' : 'px-3')}>
        <span>{nav.text}</span>
      </Link>
      {active && onNavAction && <NavMenuActions id={nav.id} name={nav.text} group topLevel onAction={onNavAction}>
        <span role="button" tabIndex={0} aria-label={`更多操作：${nav.text}`}
              className={cn(
                'absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center transition-colors',
                isDark
                  ? 'text-white/65 hover:text-white'
                  : 'text-primary-foreground/75 hover:text-primary-foreground',
              )}>
          <span aria-hidden="true"
                className="h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-current"/>
        </span>
      </NavMenuActions>}
      <span
        className={cn(
          'absolute bottom-0 left-1/2 h-[3px] w-3.5 -translate-x-1/2 rounded-full transition-opacity',
          isDark ? 'bg-primary/90' : 'bg-primary-foreground/90',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}

function SortableTopNavLink(props: Omit<Parameters<typeof TopNavLink>[0], 'sortable'>) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: props.nav.id})
  const {role: _attributeRole, tabIndex: _attributeTabIndex, ...dragAttributes} = attributes
  return (
    <TopNavLink
      {...props}
      sortable={{
        ref: setNodeRef,
        style: {transform: CSS.Translate.toString(transform), transition},
        dragAttributes,
        listeners,
        isDragging,
      }}
    />
  )
}


function TopHeaderShell({
                          brand, brandTo,
                          logoIcon,
                          mobileTitle,
                          mobileNavs,
                          topNavs,
                          activeTopId,
                          onTopNavChange,
                          onTopNavsReorder,
                          onNavAction,
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
  onTopNavsReorder?: (orderedIds: string[]) => void
  onNavAction?: OnNavMenuAction
  leading?: React.ReactNode
  extraActions?: React.ReactNode
  logoIcon?: LucideIcon
}) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const [authUser, setAuthUser] = React.useState(() => getAuthSession()?.user ?? null)
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}))
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

  const handleTopDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || !onTopNavsReorder || !topNavs) return
    const ids = topNavs.map((nav) => nav.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
    onTopNavsReorder(arrayMove(ids, oldIndex, newIndex))
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
            {onTopNavsReorder ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTopDragEnd}>
                <SortableContext items={topNavs.map((nav) => nav.id)} strategy={horizontalListSortingStrategy}>
                  {topNavs.map((nav) => (
                    <SortableTopNavLink
                      key={nav.id}
                      nav={nav}
                      activeTopId={activeTopId}
                      isDark={isDark}
                      onTopNavChange={onTopNavChange}
                      onNavAction={onNavAction}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              topNavs.map((nav) => (
                <TopNavLink
                  key={nav.id}
                  nav={nav}
                  activeTopId={activeTopId}
                  isDark={isDark}
                  onTopNavChange={onTopNavChange}
                  onNavAction={onNavAction}
                />
              ))
            )}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          {extraActions}
          <AiHeaderButton className={headerActionClass}/>
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
                <UserAvatar name={authUser?.name ?? ''} src={authUser?.avatar} size={30}
                            className="bg-white/20 text-white"/>
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

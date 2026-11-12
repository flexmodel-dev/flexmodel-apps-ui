import * as React from 'react'
import {Link, useLocation} from 'react-router-dom'
import {ChevronDown, ChevronsLeft, ChevronsRight} from 'lucide-react'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {cn} from '@/lib/utils'
import {Button} from '@/components/ui/button'
import {Popover, PopoverAnchor, PopoverContent} from '@/components/ui/popover'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import type {NavItem} from '@/data/mock'
import {AppLauncher} from './AppLauncher'
import {NavMenuActions, type OnNavMenuAction} from './NavMenuActions'
import {NewNavMenu} from './NewNavMenu'
import type {NavEditorDraft} from './NavEditorDialog'

function getActiveMenuIds(navs: NavItem[], pathname: string) {
  return navs
    .filter((nav) => nav.sub?.some((sub) => sub.to && pathname.startsWith(sub.to.replace(/\/tasks.*/, ''))))
    .map((nav) => nav.id)
}

interface DragProps {
  dragAttributes?: Record<string, unknown>
  listeners?: Record<string, unknown>
}

function SidebarChildItem({
                            parentId,
                            child,
                            active,
                            sortable,
                            onNavAction,
                          }: {
  parentId: string
  child: NavItem
  active: boolean
  sortable: boolean
  onNavAction?: OnNavMenuAction
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
    id: `child-${parentId}__${child.id}`,
    disabled: !sortable,
  })
  const {role: _attributeRole, tabIndex: _attributeTabIndex, ...dragAttributes} = attributes
  const dragProps: DragProps = sortable ? {dragAttributes, listeners} : {}
  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Translate.toString(transform), transition}}
      className={cn('group/nav flex items-center rounded-md hover:bg-primary/10', active && 'bg-primary/10', isDragging && 'z-10 opacity-60')}
    >
    <Link
      to={child.to!}
      draggable={false}
      {...dragProps.dragAttributes}
      {...dragProps.listeners}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm',
        active
          ? 'font-medium text-primary'
          : 'text-muted-foreground transition-colors hover:text-primary',
      )}
    >
      {child.icon ? <child.icon className="h-4 w-4 shrink-0"/> : null}
      <span className="truncate">{child.text}</span>
    </Link>
      {onNavAction && <NavMenuActions id={child.id} name={child.text} onAction={onNavAction}/>}
    </div>
  )
}

function SidebarTopItem({
                          nav,
                          isOpen,
                          collapsed,
                          sortable,
                          isActive,
                          onToggleOpen,
                          onNavAction,
                        }: {
  nav: NavItem
  isOpen: boolean
  collapsed?: boolean
  sortable: boolean
  isActive: (nav: NavItem) => boolean
  onToggleOpen: (id: string) => void
  onNavAction?: OnNavMenuAction
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
    id: `left-${nav.id}`,
    disabled: !sortable,
  })
  const {role: _attributeRole, tabIndex: _attributeTabIndex, ...dragAttributes} = attributes
  const dragProps: DragProps = sortable ? {dragAttributes, listeners} : {}

  const groupTrigger = (
    <button
      type="button"
      aria-label={nav.text}
      aria-expanded={collapsed ? undefined : isOpen}
      onClick={() => onToggleOpen(nav.id)}
      draggable={false}
      {...dragProps.dragAttributes}
      {...dragProps.listeners}
      className={cn('flex min-w-0 flex-1 items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary', collapsed && 'hover:bg-primary/10')}
    >
      <span className="flex min-w-0 items-center gap-3">
        {nav.icon ? <nav.icon className="h-4 w-4"/> : null}
        {!collapsed && <span className="truncate">{nav.text}</span>}
      </span>
    </button>
  )

  const link = (
    <Link
      to={nav.to!}
      aria-label={nav.text}
      draggable={false}
      {...dragProps.dragAttributes}
      {...dragProps.listeners}
      className={cn(
        isActive(nav)
          ? 'flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-primary'
          : 'flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary',
        collapsed && (isActive(nav) ? 'bg-primary/10' : 'hover:bg-primary/10'),
      )}
    >
      {nav.icon ? <nav.icon className="h-4 w-4"/> : null}
      {!collapsed && <span className="truncate">{nav.text}</span>}
    </Link>
  )

  return (
    <li
      ref={setNodeRef}
      style={{transform: CSS.Translate.toString(transform), transition}}
      className={cn(isDragging && 'z-10 opacity-60')}
    >
      {nav.sub ? (
        <>
          {collapsed ? (
            <CollapsedGroupMenu nav={nav} trigger={groupTrigger} isActive={isActive} onNavAction={onNavAction}/>
          ) : <div className="group/nav flex items-center rounded-md hover:bg-primary/10">
            {groupTrigger}
            {onNavAction && <NavMenuActions id={nav.id} name={nav.text} group onAction={onNavAction}/>}
            <Button type="button" variant="ghost" size="icon"
                    aria-label={`${isOpen ? '折叠' : '展开'}分组：${nav.text}`} aria-expanded={isOpen}
                    className="mr-1 h-7 w-7 shrink-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    onClick={() => onToggleOpen(nav.id)}>
              <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}/>
            </Button>
          </div>}
          {isOpen && !collapsed && (
            <div className="mt-1 space-y-1 pl-9">
              <SortableContext
                items={nav.sub.map((child) => `child-${nav.id}__${child.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {nav.sub.map((child) => (
                  <SidebarChildItem
                    key={child.id}
                    parentId={nav.id}
                    child={child}
                    active={isActive(child)}
                    sortable={sortable}
                    onNavAction={onNavAction}
                  />
                ))}
              </SortableContext>
            </div>
          )}
        </>
      ) : (
        collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{nav.text}</TooltipContent>
          </Tooltip>
        ) : <div
          className={cn('group/nav flex items-center rounded-md hover:bg-primary/10', isActive(nav) && 'bg-primary/10')}>
          {link}
          {onNavAction && <NavMenuActions id={nav.id} name={nav.text} onAction={onNavAction}/>}
        </div>
      )}
    </li>
  )
}

function CollapsedGroupMenu({
                              nav,
                              trigger,
                              isActive,
                              onNavAction,
                            }: {
  nav: NavItem
  trigger: React.ReactNode
  isActive: (nav: NavItem) => boolean
  onNavAction?: OnNavMenuAction
}) {
  const [open, setOpen] = React.useState(false)
  const closeTimeoutRef = React.useRef<number>()
  const actionsOpenRef = React.useRef(false)

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = undefined
    }
  }
  const openMenu = () => {
    clearCloseTimeout()
    setOpen(true)
  }
  const closeMenu = () => {
    clearCloseTimeout()
    if (actionsOpenRef.current) return
    closeTimeoutRef.current = window.setTimeout(() => setOpen(false), 100)
  }
  const handleActionsOpenChange = (next: boolean) => {
    actionsOpenRef.current = next
    clearCloseTimeout()
    if (!next) setOpen(false)
  }

  React.useEffect(() => clearCloseTimeout, [])

  if (!nav.sub) return null

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !actionsOpenRef.current) {
          clearCloseTimeout()
          setOpen(false)
        }
      }}
    >
      <PopoverAnchor asChild>
        <span
          className="flex"
          onMouseEnter={openMenu}
          onMouseLeave={closeMenu}
        >
          {trigger}
        </span>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={6}
        className="w-48 p-2"
        onMouseEnter={openMenu}
        onMouseLeave={closeMenu}
      >
        <div className="group/nav mb-1 flex items-center justify-between">
          <p className="px-3 text-xs font-medium text-muted-foreground">{nav.text}</p>
          {onNavAction && <NavMenuActions id={nav.id} name={nav.text} group onAction={onNavAction}
                                          onOpenChange={handleActionsOpenChange}/>}
        </div>
        <div className="space-y-1">
          {nav.sub.map((child) => (
            <div key={child.id} className="group/nav flex items-center rounded-md hover:bg-primary/10">
            <Link
              to={child.to!}
              onClick={() => setOpen(false)}
              className={
                isActive(child)
                  ? 'flex min-w-0 flex-1 items-center gap-3 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary'
                  : 'flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary'
              }
            >
              {child.icon ? <child.icon className="h-4 w-4 shrink-0"/> : null}
              <span className="truncate">{child.text}</span>
            </Link>
              {onNavAction && <NavMenuActions id={child.id} name={child.text} onAction={onNavAction}
                                              onOpenChange={handleActionsOpenChange}/>}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function AppLeftSidebar({
                                 navs,
                                 sectionKey,
                                 collapsed,
                                 headerHidden,
                                 onToggleCollapsed,
                                 onMenusReorder,
                                 onNavAction,
                                 onCreateNav,
                               }: {
  navs: NavItem[]
  sectionKey?: string
  collapsed?: boolean
  headerHidden?: boolean
  onToggleCollapsed?: () => void
  onMenusReorder?: (parentId: string, orderedChildIds: string[]) => void
  onNavAction?: OnNavMenuAction
  onCreateNav?: (draft: NavEditorDraft) => void
}) {
  const location = useLocation()
  const currentAppId = location.pathname.match(/^\/apps\/([^/]+)/)?.[1]
  const [openMenus, setOpenMenus] = React.useState<string[]>(() =>
    getActiveMenuIds(navs, location.pathname),
  )
  const previousSectionKeyRef = React.useRef(sectionKey)
  const sortable = Boolean(onMenusReorder)
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}))

  React.useEffect(() => {
    const activeMenuIds = getActiveMenuIds(navs, location.pathname)
    const sectionChanged = previousSectionKeyRef.current !== sectionKey
    previousSectionKeyRef.current = sectionKey

    setOpenMenus((current) => {
      if (sectionChanged) return activeMenuIds
      return activeMenuIds.reduce(
        (ids, id) => (ids.includes(id) ? ids : [...ids, id]),
        current,
      )
    })
  }, [location.pathname, navs, sectionKey])

  const isActive = (nav: NavItem) => {
    if (!nav.to) return false
    return location.pathname === nav.to || (nav.to !== '/workbench/home' && location.pathname.startsWith(nav.to))
  }

  const handleMenuDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || !onMenusReorder) return
    const activeValue = String(active.id)
    const overValue = String(over.id)
    if (activeValue === overValue) return

    if (activeValue.startsWith('left-')) {
      const activeId = activeValue.slice(5)
      const overTopId = overValue.startsWith('left-')
        ? overValue.slice(5)
        : overValue.startsWith('child-')
          ? overValue.slice(6).split('__')[0]
          : undefined
      if (!overTopId || !sectionKey) return
      const ids = navs.map((item) => item.id)
      const oldIndex = ids.indexOf(activeId)
      const newIndex = ids.indexOf(overTopId)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      onMenusReorder(sectionKey, arrayMove(ids, oldIndex, newIndex))
      return
    }

    if (activeValue.startsWith('child-')) {
      const [parentId, activeChildId] = activeValue.slice(6).split('__')
      if (!overValue.startsWith(`child-${parentId}__`)) return
      const overChildId = overValue.slice(6).split('__')[1]
      const group = navs.find((item) => item.id === parentId)
      const ids = group?.sub?.map((child) => child.id) ?? []
      const oldIndex = ids.indexOf(activeChildId)
      const newIndex = overChildId ? ids.indexOf(overChildId) : -1
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      onMenusReorder(parentId, arrayMove(ids, oldIndex, newIndex))
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'fixed left-0 z-30 border-r bg-background transition-[width] duration-200',
          headerHidden ? 'block top-0 h-screen' : 'hidden top-16 h-[calc(100vh-4rem)] md:block',
          headerHidden ? 'top-0 h-screen' : 'top-16 h-[calc(100vh-4rem)]',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <nav className="flex h-full flex-col overflow-hidden p-3">
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMenuDragEnd}>
              <SortableContext
                items={navs.map((nav) => `left-${nav.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {navs.map((nav) => (
                  <SidebarTopItem
                    key={nav.id}
                    nav={nav}
                    isOpen={openMenus.includes(nav.id)}
                    collapsed={collapsed}
                    sortable={sortable}
                    isActive={isActive}
                    onNavAction={onNavAction}
                    onToggleOpen={(id) => setOpenMenus((open) =>
                      open.includes(id) ? open.filter((openId) => openId !== id) : [...open, id])}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </ul>
          <div
            role="toolbar" aria-label="duck栏"
            className={cn('mt-2 flex shrink-0 items-center border-t pt-2', collapsed ? 'flex-col gap-1' : 'justify-between')}>
            <AppLauncher collapsed={collapsed} currentAppId={currentAppId}/>
            {currentAppId && onCreateNav && <NewNavMenu appId={currentAppId}
                                                        hasParent={Boolean(sectionKey)} onCreate={onCreateNav}/>}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={onToggleCollapsed}
                >
                  {collapsed ? <ChevronsRight className="h-4 w-4"/> : <ChevronsLeft className="h-4 w-4"/>}
                </Button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? 'right' : 'top'}>{collapsed ? '展开菜单' : '折叠菜单'}</TooltipContent>
            </Tooltip>
          </div>
        </nav>
      </aside>
    </TooltipProvider>
  )
}

import * as React from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {Folder, GripVertical, Pencil, Plus, Trash2} from 'lucide-react'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Empty} from '@/components/ui/empty'
import {MenuAuthorizationButton, MenuAuthorizationDialog} from '@/components/biz/MenuAuthorizationDialog'
import {OptionalIconPicker} from '@/components/biz/IconPicker'
import {NavDestinationPicker} from '@/components/biz/NavDestinationPicker'
import {cn, toErrorMessage} from '@/lib/utils'
import {
  type AppNav,
  type AppNavInput,
  createAppNav,
  deleteAppNav,
  findNavById,
  getAppNavigation,
  isValidHttpUrl,
  moveNavNode,
  type NavDestinationType,
  navOrderInput,
  reorderAppNavigation,
  reorderNavChildren,
  toTopNavigationItem,
  updateAppNav,
} from '@/services/appNavigation'
import {
  createLeftMenu,
  createLeftSubmenu,
  createTopMenu,
  deleteLeftMenu,
  deleteLeftSubmenu,
  deleteTopMenu,
  getLeftMenuGroup,
  type LeftMenuItemType,
  type NavItem,
  reorderLeftMenus,
  reorderLeftSubmenus,
  reorderTopMenus,
  type TopMenuItemInput,
  type TopNavItem,
  topNavs,
  updateLeftMenu,
  updateLeftSubmenu,
  updateTopMenu,
} from '@/data/mock'
import {type AppIconName, appIconOptions, appIcons, isAppIconName,} from '@/data/appIcons'

type EditorForm =
  | { kind: 'top'; id?: string; text: string }
  | {
  kind: 'left';
  id?: string;
  text: string;
  link?: string;
  workbenchId?: string | null;
  icon: AppIconName | 'none';
  type: LeftMenuItemType
}
  | {
  kind: 'sub';
  id?: string;
  parentId: string;
  text: string;
  link?: string;
  workbenchId?: string | null;
  icon: AppIconName | 'none'
}

export interface MenuEditorDraft {
  text?: string
  link?: string
}

type DeleteTarget =
  | { kind: 'top'; item: TopNavItem }
  | { kind: 'left'; item: NavItem }
  | { kind: 'sub'; item: NavItem; parentId: string }

const sensorsOptions = {
  activationConstraint: {distance: 4},
}

const rowActionsClass = 'flex shrink-0 items-center gap-0.5'

function iconName(icon?: NavItem['icon']) {
  return appIconOptions.find((name) => appIcons[name] === icon) ?? 'none'
}

function toIconValue(name?: string | null): AppIconName | 'none' {
  return isAppIconName(name) ? name : 'none'
}

function LeftMenuDropArea({
                            droppableId,
                            children,
                          }: {
  droppableId: string
  children: React.ReactNode
}) {
  const {setNodeRef} = useDroppable({id: droppableId})
  return (
    <div ref={setNodeRef} className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      {children}
    </div>
  )
}

function TopMenuRow({
                      menu,
                      selected,
                      canDelete,
                      authorization,
                      onSelect,
                      onEdit,
                      onDelete,
                    }: {
  menu: TopNavItem
  selected: boolean
  canDelete: boolean
  authorization?: React.ReactNode
  onSelect: (menu: TopNavItem) => void
  onEdit: (menu: TopNavItem) => void
  onDelete: (menu: TopNavItem) => void
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
    id: `top-${menu.id}`,
  })

  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      className={cn(
        'relative flex items-center gap-2 rounded-lg border bg-card px-2 py-2 shadow-sm',
        selected && 'border-primary/60 bg-primary/5',
        isDragging && 'z-10 opacity-80',
      )}
    >
      <span
        className={cn(
          'absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r bg-primary transition-opacity',
          selected ? 'opacity-100' : 'opacity-0',
        )}
      />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onSelect(menu)}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground"/>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm font-medium', selected && 'text-primary')}>{menu.text}</span>
        </span>
      </button>
      <div className={rowActionsClass}>
        {authorization}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="编辑一级菜单"
          onClick={() => onEdit(menu)}
        >
          <Pencil className="h-4 w-4"/>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="删除一级菜单"
          disabled={!canDelete}
          onClick={() => onDelete(menu)}
        >
          <Trash2 className="h-4 w-4"/>
        </Button>
      </div>
    </div>
  )
}

function LeftMenuRow({
                       item,
                       selected,
                       authorization,
                       onEdit,
                       onDelete,
                       onAddChild,
                     }: {
  item: NavItem
  selected: boolean
  authorization?: React.ReactNode
  onEdit: (item: NavItem) => void
  onDelete: (item: NavItem) => void
  onAddChild: (parentId: string) => void
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
    id: `left-${item.id}`,
  })
  const Icon = item.icon

  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-card px-2 py-2 shadow-sm',
        selected && 'border-primary/60',
        isDragging && 'z-10 opacity-80',
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onEdit(item)}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground"/>
        {item.sub ? <Folder className="h-4 w-4 shrink-0 text-primary"/> : Icon ?
          <Icon className="h-4 w-4 shrink-0"/> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.text}</span>
          {item.sub && (
            <span className="block truncate text-xs text-muted-foreground">
              分组 · {item.sub.length} 项
            </span>
          )}
        </span>
      </button>
      <div className={rowActionsClass}>
        {item.sub && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="新增分组内菜单"
            onClick={() => onAddChild(item.id)}
          >
            <Plus className="h-4 w-4"/>
          </Button>
        )}
        {authorization}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={item.sub ? '编辑分组' : '编辑菜单'}
          onClick={() => onEdit(item)}
        >
          <Pencil className="h-4 w-4"/>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={item.sub ? '删除分组' : '删除菜单'}
          onClick={() => onDelete(item)}
        >
          <Trash2 className="h-4 w-4"/>
        </Button>
      </div>
    </div>
  )
}

function SubmenuRow({
                      parentId,
                      item,
                      selected,
                      authorization,
                      onEdit,
                      onDelete,
                    }: {
  parentId: string
  item: NavItem
  selected: boolean
  authorization?: React.ReactNode
  onEdit: (parentId: string, item: NavItem) => void
  onDelete: (parentId: string, item: NavItem) => void
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
    id: `child-${parentId}__${item.id}`,
  })
  const Icon = item.icon

  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 shadow-sm',
        selected && 'border-primary/60',
        isDragging && 'z-10 opacity-80',
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onEdit(parentId, item)}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground"/>
        {Icon ? <Icon className="h-4 w-4 shrink-0"/> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{item.text}</span>
        </span>
      </button>
      <div className={rowActionsClass}>
        {authorization}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="编辑分组内菜单"
          onClick={() => onEdit(parentId, item)}
        >
          <Pencil className="h-4 w-4"/>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="删除分组内菜单"
          onClick={() => onDelete(parentId, item)}
        >
          <Trash2 className="h-4 w-4"/>
        </Button>
      </div>
    </div>
  )
}

function destinationValue(destination?: { type: NavDestinationType; id: string } | null) {
  return destination ? `${destination.type}:${destination.id}` : undefined
}

function destinationFromValue(value?: string) {
  if (!value) return null
  const separatorIndex = value.indexOf(':')
  if (separatorIndex < 0) return null
  return {
    type: value.slice(0, separatorIndex) as NavDestinationType,
    id: value.slice(separatorIndex + 1),
  }
}

function destinationInput(link: string | undefined, workbenchId: string | null | undefined) {
  const destination = destinationFromValue(link)
  if (!destination) return null
  if (destination.type === 'BUILTIN' && destination.id === 'workbench') {
    return {...destination, workbenchId: workbenchId || null}
  }
  return destination
}

function MenuEditorDialog({
                            open,
                            onOpenChange,
                            activeTopId,
                            onActiveTopIdChange,
                            onNavsChange,
                            appId,
                            draft,
                          }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeTopId: string
  onActiveTopIdChange: (id: string) => void
  onNavsChange: (navs?: AppNav[]) => void
  appId?: string
  draft?: MenuEditorDraft | null
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedTopId, setSelectedTopId] = React.useState(activeTopId)
  const [form, setForm] = React.useState<EditorForm | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null)
  const wasOpenRef = React.useRef(false)
  const [navs, setNavs] = React.useState<AppNav[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [authorization, setAuthorization] = React.useState<AppNav | null>(null)

  React.useEffect(() => {
    if (!open) setAuthorization(null)
  }, [open])

  const sensors = useSensors(
    useSensor(PointerSensor, sensorsOptions),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
  )

  React.useEffect(() => {
    if (open && !wasOpenRef.current) setSelectedTopId(activeTopId)
    wasOpenRef.current = open
  }, [open, activeTopId])

  React.useEffect(() => {
    if (!open || !appId || !draft) return
    setForm({
      kind: 'left',
      text: draft.text ?? '',
      link: draft.link,
      workbenchId: null,
      icon: 'none',
      type: 'menu',
    })
  }, [open, appId, draft])

  const loadNavs = React.useCallback(async (): Promise<AppNav[]> => {
    if (!appId) return []
    setIsLoading(true)
    setActionError(null)
    try {
      const loadedNavs = await getAppNavigation(appId)
      setNavs(loadedNavs)
      return loadedNavs
    } catch (caught) {
      setActionError(toErrorMessage(caught, '加载应用菜单失败，请稍后重试。'))
      return []
    } finally {
      setIsLoading(false)
    }
  }, [appId])

  React.useEffect(() => {
    if (!open || !appId) return
    void loadNavs()
  }, [open, appId, loadNavs])

  const topMenus = React.useMemo(
    () => appId ? navs.map((nav) => toTopNavigationItem(nav, appId)) : topNavs,
    [appId, navs],
  )
  const selectedTop = topMenus.find((menu) => menu.id === selectedTopId)
    ?? topMenus[0]
    ?? {id: '', text: '未选择菜单', to: '', navs: []}

  const startTop = () => setForm({kind: 'top', text: ''})
  const startLeft = (type: LeftMenuItemType) =>
    setForm({kind: 'left', text: '', icon: 'none', type})
  const startSub = (parentId: string) =>
    setForm({kind: 'sub', parentId, text: '', icon: 'none'})

  const editTop = (menu: TopNavItem) => setForm({kind: 'top', id: menu.id, text: menu.text})
  const editLeft = (item: NavItem) => {
    const destination = appId ? findNavById(navs, item.id)?.destination : undefined
    setForm({
      kind: 'left',
      id: item.id,
      text: item.text,
      link: appId ? destinationValue(destination) : item.to,
      workbenchId: destination?.workbenchId ?? null,
      icon: iconName(item.icon),
      type: item.sub ? 'group' : 'menu',
    })
  }
  const editSub = (parentId: string, item: NavItem) => {
    const destination = appId ? findNavById(navs, item.id)?.destination : undefined
    setForm({
      kind: 'sub',
      id: item.id,
      parentId,
      text: item.text,
      link: appId ? destinationValue(destination) : item.to,
      workbenchId: destination?.workbenchId ?? null,
      icon: iconName(item.icon),
    })
  }

  const isValid = (() => {
    if (!form) return false
    if (!form.text.trim()) return false
    if (form.kind === 'left' && !selectedTop.id) return false
    if (form.kind === 'sub' && !form.parentId) return false
    if (appId && form.kind === 'left' && form.type === 'menu') {
      const destination = destinationFromValue(form.link)
      if (!destination) return false
      return destination.type !== 'LINK' || isValidHttpUrl(destination.id)
    }
    if (appId && form.kind === 'sub') {
      const destination = destinationFromValue(form.link)
      if (!destination) return false
      return destination.type !== 'LINK' || isValidHttpUrl(destination.id)
    }
    return true
  })()

  const save = () => {
    if (!form || !isValid) return

    if (!appId) {
      if (form.kind === 'top') {
        const values: TopMenuItemInput = {text: form.text.trim()}
        const saved = form.id ? updateTopMenu(form.id, values) : createTopMenu(values)
        if (saved) {
          setSelectedTopId(saved.id)
          onActiveTopIdChange(saved.id)
          editTop(saved)
        }
      } else if (form.kind === 'left') {
        const values = {
          text: form.text.trim(),
          to: form.link,
          icon: form.icon === 'none' ? undefined : appIcons[form.icon],
          type: form.type,
        }
        const saved = form.id
          ? updateLeftMenu(selectedTop.id, form.id, values)
          : createLeftMenu(selectedTop.id, values)
        if (saved) editLeft(saved)
      } else {
        const values = {
          text: form.text.trim(),
          to: form.link,
          icon: form.icon === 'none' ? undefined : appIcons[form.icon],
          type: 'menu' as const,
        }
        const saved = form.id
          ? updateLeftSubmenu(selectedTop.id, form.parentId, form.id, values)
          : createLeftSubmenu(selectedTop.id, form.parentId, values)
        if (saved) editSub(form.parentId, saved)
      }
      onNavsChange()
      return
    }

    const saveToApi = async () => {
      setIsSaving(true)
      setActionError(null)
      try {
        let input: AppNavInput
        if (form.kind === 'top') {
          input = {type: 'GROUP', name: form.text.trim(), iconName: null}
        } else if (form.kind === 'left') {
          input = {
            type: form.type === 'group' ? 'GROUP' : 'ENTRY',
            name: form.text.trim(),
            iconName: form.icon === 'none' ? null : form.icon,
            parentId: selectedTop.id,
            destination: form.type === 'group' ? null : destinationInput(form.link, form.workbenchId),
          }
        } else {
          input = {
            type: 'ENTRY',
            name: form.text.trim(),
            iconName: form.icon === 'none' ? null : form.icon,
            parentId: form.parentId,
            destination: destinationInput(form.link, form.workbenchId),
          }
        }

        const saved = form.id ? await updateAppNav(appId, form.id, input) : await createAppNav(appId, input)
        if (form.kind === 'top' && !form.id) {
          setSelectedTopId(saved.id)
          onActiveTopIdChange(saved.id)
        }
        const nextNavs = await loadNavs()
        onNavsChange(nextNavs)

        if (form.kind === 'top') {
          setForm({kind: 'top', id: saved.id, text: saved.name})
        } else if (form.kind === 'left') {
          setForm({
            kind: 'left',
            id: saved.id,
            text: saved.name,
            link: destinationValue(saved.destination),
            workbenchId: saved.destination?.workbenchId ?? null,
            icon: toIconValue(saved.iconName),
            type: saved.type === 'GROUP' ? 'group' : 'menu',
          })
        } else {
          setForm({
            kind: 'sub',
            id: saved.id,
            parentId: form.parentId,
            text: saved.name,
            link: destinationValue(saved.destination),
            workbenchId: saved.destination?.workbenchId ?? null,
            icon: toIconValue(saved.iconName),
          })
        }
      } catch (caught) {
        setActionError(toErrorMessage(caught, '保存菜单失败，请稍后重试。'))
      } finally {
        setIsSaving(false)
      }
    }
    void saveToApi()
  }

  const confirmDelete = () => {
    const target = deleteTarget
    if (!target) return

    if (!appId) {
      if (target.kind === 'top') {
        const nextTop = topNavs.find((nav) => nav.id !== target.item.id) ?? topNavs[0]
        if (!deleteTopMenu(target.item.id)) {
          setDeleteTarget(null)
          return
        }
        if (target.item.id === activeTopId) {
          onActiveTopIdChange(nextTop.id)
          navigate(nextTop.to)
        }
        setSelectedTopId(nextTop.id)
        if (form?.id === target.item.id) setForm(null)
      } else if (target.kind === 'left') {
        if (!deleteLeftMenu(selectedTop.id, target.item.id)) {
          setDeleteTarget(null)
          return
        }
        if (pathMatches(location.pathname, target.item.to)) navigate(selectedTop.to)
        setForm(null)
      } else {
        if (!deleteLeftSubmenu(selectedTop.id, target.parentId, target.item.id)) {
          setDeleteTarget(null)
          return
        }
        if (pathMatches(location.pathname, target.item.to)) navigate(selectedTop.to)
        setForm(null)
      }
      setDeleteTarget(null)
      onNavsChange()
      return
    }

    const deleteFromApi = async () => {
      setIsSaving(true)
      setActionError(null)
      try {
        await deleteAppNav(appId, target.item.id)
        const nextNavs = await loadNavs()
        if (target.kind === 'top') {
          const nextTopId = nextNavs[0]?.id ?? ''
          if (target.item.id === activeTopId) {
            onActiveTopIdChange(nextTopId)
          }
          setSelectedTopId(nextTopId)
        }
        if (
          form?.id === target.item.id
          || (target.kind === 'top' && form?.kind !== 'top')
          || (target.kind === 'left' && form?.kind === 'sub' && form.parentId === target.item.id)
        ) {
          setForm(null)
        }
        setDeleteTarget(null)
        onNavsChange(nextNavs)
      } catch (caught) {
        setActionError(toErrorMessage(caught, '删除菜单失败，请稍后重试。'))
      } finally {
        setIsSaving(false)
      }
    }
    void deleteFromApi()
  }

  const saveOrder = (nextNavs: AppNav[]) => {
    if (!appId) return
    const persistOrder = async () => {
      setIsSaving(true)
      setActionError(null)
      try {
        const savedNavs = await reorderAppNavigation(appId, navOrderInput(nextNavs))
        setNavs(savedNavs)
        onNavsChange(savedNavs)
      } catch (caught) {
        setActionError(toErrorMessage(caught, '保存菜单顺序失败，请稍后重试。'))
        await loadNavs()
      } finally {
        setIsSaving(false)
      }
    }
    void persistOrder()
  }

  const handleTopDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id).slice(4)
    const overId = String(over.id).slice(4)
    const oldIndex = topMenus.findIndex((item) => item.id === activeId)
    const newIndex = topMenus.findIndex((item) => item.id === overId)
    if (oldIndex < 0 || newIndex < 0) return
    const orderedIds = arrayMove(topMenus, oldIndex, newIndex).map((item) => item.id)
    if (!appId) {
      reorderTopMenus(orderedIds)
      onNavsChange()
      return
    }
    const navsById = new Map(navs.map((nav) => [nav.id, nav]))
    saveOrder(orderedIds.map((id) => navsById.get(id)).filter((nav): nav is AppNav => Boolean(nav)))
  }

  const dragInfo = (dragId: string) => {
    const value = String(dragId)
    if (value.startsWith('left-root-')) {
      return {navId: undefined, parentId: selectedTop.id, index: undefined}
    }
    if (value.startsWith('left-')) {
      const navId = value.slice(5)
      return {
        navId,
        parentId: selectedTop.id,
        index: selectedTop.navs.findIndex((item) => item.id === navId) + 1,
      }
    }
    if (value.startsWith('child-')) {
      const [parentId, navId] = value.slice(6).split('__')
      const group = findNavById(navs, parentId)
      return {
        navId,
        parentId,
        index: (group?.children ?? []).findIndex((item) => item.id === navId) + 1,
      }
    }
    return undefined
  }

  const moveNavToParent = async (
    nav: AppNav,
    targetParentId: string,
    targetIndex: number,
  ) => {
    setIsSaving(true)
    setActionError(null)
    try {
      const input: AppNavInput = {
        type: nav.type,
        name: nav.name,
        iconName: nav.iconName ?? null,
        parentId: targetParentId,
        destination: nav.destination
          ? {
            type: nav.destination.type,
            id: nav.destination.id,
            workbenchId: nav.destination.type === 'BUILTIN' && nav.destination.id === 'workbench'
              ? nav.destination.workbenchId ?? null
              : null,
          }
          : null,
      }
      await updateAppNav(appId!, nav.id, input)
      const nextNavs = moveNavNode(navs, nav.id, targetParentId, targetIndex)
      const savedNavs = await reorderAppNavigation(appId!, navOrderInput(nextNavs))
      setNavs(savedNavs)
      onNavsChange(savedNavs)
      if (form?.id === nav.id) {
        setForm(targetParentId === selectedTop.id
          ? {
            kind: 'left',
            id: nav.id,
            text: nav.name,
            link: destinationValue(nav.destination),
            workbenchId: nav.destination?.workbenchId ?? null,
            icon: toIconValue(nav.iconName),
            type: 'menu',
          }
          : {
            kind: 'sub',
            id: nav.id,
            parentId: targetParentId,
            text: nav.name,
            link: destinationValue(nav.destination),
            workbenchId: nav.destination?.workbenchId ?? null,
            icon: toIconValue(nav.iconName),
          })
      }
    } catch (caught) {
      setActionError(toErrorMessage(caught, '移动菜单失败，请稍后重试。'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleMenuDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over) return
    const activeInfo = dragInfo(String(active.id))
    const overInfo = dragInfo(String(over.id))
    if (!activeInfo?.navId || !overInfo) return

    const activeNav = appId ? findNavById(navs, activeInfo.navId) : undefined
    const activeParentId = activeNav?.parentId ?? activeInfo.parentId
    if (activeParentId === overInfo.parentId) {
      if (!overInfo.navId) return
      const children = appId
        ? (findNavById(navs, overInfo.parentId)?.children ?? [])
        : (getLeftMenuGroup(selectedTop.id, overInfo.parentId)?.sub ?? [])
      const oldIndex = children.findIndex((item) => item.id === activeInfo.navId)
      const newIndex = children.findIndex((item) => item.id === overInfo.navId)
      if (oldIndex < 0 || newIndex < 0) return
      const orderedChildren = [...children]
      const [movedChild] = orderedChildren.splice(oldIndex, 1)
      orderedChildren.splice(newIndex, 0, movedChild)
      const orderedIds = orderedChildren.map((item) => item.id)
      if (!appId) {
        if (overInfo.parentId === selectedTop.id) reorderLeftMenus(selectedTop.id, orderedIds)
        else reorderLeftSubmenus(selectedTop.id, overInfo.parentId, orderedIds)
        onNavsChange()
        return
      }
      saveOrder(reorderNavChildren(navs, overInfo.parentId, orderedIds))
      return
    }

    if (!appId || !activeNav || activeNav.type !== 'ENTRY') return
    const targetParent = findNavById(navs, overInfo.parentId)
    const targetIndex = overInfo.index ?? (targetParent?.children.length ?? 0)
    void moveNavToParent(activeNav, overInfo.parentId, targetIndex)
  }

  const refreshAuthorizedNavs = async () => {
    if (!appId) return
    try {
      const loadedNavs = await getAppNavigation(appId)
      setNavs(loadedNavs)
      onNavsChange(loadedNavs)
    } catch (caught) {
      setActionError(toErrorMessage(caught, '刷新菜单授权失败，请稍后重试。'))
    }
  }

  const authorizationFor = (navId: string) => {
    if (!appId) return undefined
    const nav = findNavById(navs, navId)
    if (!nav) return undefined
    return (
      <MenuAuthorizationButton
        nav={nav}
        disabled={isSaving}
        onClick={() => setAuthorization(nav)}
      />
    )
  }

  const deleteText =
    deleteTarget?.kind === 'top'
      ? `确认删除一级菜单「${deleteTarget.item.text}」吗？`
      : deleteTarget?.kind === 'left'
        ? `确认删除左侧菜单「${deleteTarget.item.text}」吗？`
        : deleteTarget?.kind === 'sub'
          ? `确认删除分组内菜单「${deleteTarget.item.text}」吗？`
          : ''

  return (
    <>
      <BizDialog open={open} onOpenChange={onOpenChange} title="菜单编辑" width={1180} height="85vh">
        {actionError ? (
          <div
            className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert">
            {actionError}
          </div>
        ) : null}
        <div className={cn('grid gap-4 lg:grid-cols-3 lg:grid-rows-1', isLoading ? 'h-[calc(100%-3rem)]' : 'h-full')}>
          <section className="flex min-h-0 flex-col rounded-lg border bg-background p-3 lg:h-full">
            <header className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <div className="min-w-0">
                <h6 className="truncate text-sm font-semibold text-foreground">一级菜单</h6>
                <p className="truncate text-xs text-muted-foreground">顶部导航</p>
              </div>
              <Button type="button" size="sm" onClick={startTop} disabled={isSaving}>
                <Plus className="h-4 w-4"/> 新增
              </Button>
            </header>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTopDragEnd}>
              <SortableContext
                items={topMenus.map((item) => `top-${item.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {topMenus.map((item) => (
                    <TopMenuRow
                      key={item.id}
                      menu={item}
                      selected={selectedTop.id === item.id}
                      canDelete={appId ? true : topMenus.length > 1}
                      onSelect={(menu) => {
                        setSelectedTopId(menu.id)
                        editTop(menu)
                      }}
                      authorization={authorizationFor(item.id)}
                      onEdit={editTop}
                      onDelete={(menu) => setDeleteTarget({kind: 'top', item: menu})}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>

          <section className="flex min-h-0 flex-col rounded-lg border bg-background p-3 lg:h-full">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="min-w-0">
                <h6 className="truncate text-sm font-semibold text-foreground">
                  {selectedTop.text} · 左侧菜单
                </h6>
                <p className="truncate text-xs text-muted-foreground">支持分组和分组内菜单</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => startLeft('menu')}
                        disabled={!selectedTop.id || isSaving}>
                  <Plus className="h-4 w-4"/> 菜单
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => startLeft('group')}
                        disabled={!selectedTop.id || isSaving}>
                  <Plus className="h-4 w-4"/> 分组
                </Button>
              </div>
            </header>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMenuDragEnd}>
              <SortableContext
                items={selectedTop.navs.map((item) => `left-${item.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <LeftMenuDropArea droppableId={`left-root-${selectedTop.id}`}>
                  {selectedTop.navs.map((item) => (
                    <div key={item.id} className="space-y-2">
                      <LeftMenuRow
                        item={item}
                        selected={form?.kind === 'left' && form.id === item.id}
                        authorization={authorizationFor(item.id)}
                        onEdit={editLeft}
                        onDelete={(menuItem) => setDeleteTarget({kind: 'left', item: menuItem})}
                        onAddChild={startSub}
                      />
                      {item.sub && (
                        <div className="ml-4 space-y-2 rounded-lg border-l bg-muted/40 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">分组内菜单</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => startSub(item.id)}
                              disabled={isSaving}
                            >
                              <Plus className="h-4 w-4"/> 新增子菜单
                            </Button>
                          </div>
                          {item.sub.length === 0 && (
                            <Empty className="py-6" description={<span className="text-xs">暂无子菜单</span>}/>
                          )}

                            <SortableContext
                              items={item.sub.map((child) => `child-${item.id}__${child.id}`)}
                              strategy={verticalListSortingStrategy}
                            >
                              {item.sub.map((child) => (
                                <SubmenuRow
                                  key={child.id}
                                  parentId={item.id}
                                  item={child}
                                  selected={form?.kind === 'sub' && form.id === child.id}
                                  authorization={authorizationFor(child.id)}
                                  onEdit={editSub}
                                  onDelete={(parentId, menuItem) =>
                                    setDeleteTarget({kind: 'sub', parentId, item: menuItem})
                                  }
                                />
                              ))}
                            </SortableContext>

                        </div>
                      )}
                    </div>
                  ))}
                </LeftMenuDropArea>
              </SortableContext>
            </DndContext>
          </section>

          <section className="flex min-h-0 flex-col rounded-lg border bg-background p-3 lg:h-full">
            <header className="border-b border-border pb-3">
              <h6 className="text-sm font-semibold text-foreground">
                {form?.kind === 'top'
                  ? form.id
                    ? '编辑一级菜单'
                    : '新增一级菜单'
                  : form?.kind === 'left'
                    ? form.type === 'group'
                      ? form.id
                        ? '编辑分组'
                        : '新增分组'
                      : form.id
                        ? '编辑菜单'
                        : '新增菜单'
                    : form?.kind === 'sub'
                      ? form.id
                        ? '编辑分组内菜单'
                        : '新增分组内菜单'
                      : '编辑区'}
              </h6>
              <p className="text-xs text-muted-foreground">
                {form
                  ? form.kind === 'left' && form.type === 'group'
                    ? '分组用于收纳菜单，本身不跳转'
                    : '保存后立即生效'
                  : '从左侧选择菜单，或点击新增'}
              </p>
            </header>

            {!form ? (
              <div
                className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                选择一个菜单开始编辑
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <label className="block text-xs font-medium text-foreground">名称</label>
                <Input
                  value={form.text}
                  onChange={(event) => setForm({...form, text: event.target.value})}
                  placeholder="请输入名称"
                />

                {form.kind === 'left' && form.type === 'menu' && (
                  <>
                    <label className="block text-xs font-medium text-foreground">关联项</label>
                    <NavDestinationPicker
                      value={form.link}
                      onChange={(link) => setForm({...form, link})}
                      appId={appId}
                      workbenchId={form.workbenchId}
                      onWorkbenchChange={(workbenchId) => setForm({...form, workbenchId})}
                    />
                  </>
                )}

                {form.kind === 'sub' && (
                  <>
                    <label className="block text-xs font-medium text-foreground">关联项</label>
                    <NavDestinationPicker
                      value={form.link}
                      onChange={(link) => setForm({...form, link})}
                      appId={appId}
                      workbenchId={form.workbenchId}
                      onWorkbenchChange={(workbenchId) => setForm({...form, workbenchId})}
                    />
                  </>
                )}

                {form.kind !== 'top' && (
                  <>
                    <label className="block text-xs font-medium text-foreground">图标</label>
                    <OptionalIconPicker
                      value={form.icon}
                      onChange={(icon) => setForm({...form, icon})}
                    />
                  </>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setForm(null)}>
                    取消
                  </Button>
                  <Button type="button" onClick={save} disabled={!isValid || isSaving}>
                    保存
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </BizDialog>

      <BizDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}
        title="删除菜单"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete} disabled={isSaving}>
              删除
            </Button>
          </>
        }
      >
        <div className="pt-1">{deleteText}</div>
      </BizDialog>

      {appId ? (
        <MenuAuthorizationDialog
          appId={appId}
          nav={authorization}
          open={authorization !== null}
          onOpenChange={(next) => !next && setAuthorization(null)}
          onSaved={refreshAuthorizedNavs}
        />
      ) : null}
    </>
  )
}

function pathMatches(pathname: string, target?: string) {
  if (!target) return false
  return pathname === target || pathname.startsWith(`${target}/`)
}

export {MenuEditorDialog}

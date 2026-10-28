import * as React from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {Folder, GripVertical, Pencil, Plus, ShieldCheck, Trash2} from 'lucide-react'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Empty} from '@/components/ui/empty'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {DirectoryMemberPicker} from '@/components/rb/DirectoryMemberPicker'
import type {DirectorySelection} from '@/types/directory'
import {OptionalIconPicker} from '@/components/biz/IconPicker'
import {MenuLinkPicker} from '@/components/biz/MenuLinkPicker'
import {cn, toErrorMessage} from '@/lib/utils'
import {
  createAppMenu,
  deleteAppMenu,
  getAppMenus,
  isValidHttpUrl,
  reorderAppMenus,
  updateAppMenu,
  type AppMenu,
  type AppMenuInput,
  type AppMenuTargetType,
} from '@/services/appMenus'
import {
  menuOrderInput,
  moveMenuNode,
  reorderMenuChildren,
  toTopNavigationItem,
} from '@/services/appMenuNavigation'
import {
  createLeftMenu,
  createLeftSubmenu,
  createTopMenu,
  deleteLeftMenu,
  deleteLeftSubmenu,
  deleteTopMenu,
  getLeftMenuGroup,
  getTopNavById,
  navIcons,
  navIconOptions,
  reorderLeftMenus,
  reorderLeftSubmenus,
  reorderTopMenus,
  topNavs,
  updateLeftMenu,
  updateLeftSubmenu,
  updateTopMenu,
  type LeftMenuItemType,
  type NavIconName,
  type NavItem,
  type TopMenuItemInput,
  type TopNavItem,
} from '@/data/mock'

type EditorForm =
  | { kind: 'top'; id?: string; text: string }
  | { kind: 'left'; id?: string; text: string; link?: string; icon: NavIconName | 'none'; type: LeftMenuItemType }
  | { kind: 'sub'; id?: string; parentId: string; text: string; link?: string; icon: NavIconName | 'none' }

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
  return navIconOptions.find((name) => navIcons[name] === icon) ?? 'none'
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

function MenuAuthorizationPopover({
                                    appId,
                                    menu,
                                    disabled,
                                    onSaved,
                                  }: {
  appId: string
  menu: AppMenu
  disabled?: boolean
  onSaved: () => Promise<void>
}) {
  const [open, setOpen] = React.useState(false)
  const [members, setMembers] = React.useState<DirectorySelection[]>(() => menu.members ?? [])
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const memberCount = (menu.members ?? []).length

  React.useEffect(() => {
    if (!open) return
    setMembers(menu.members ?? [])
    setError(null)
  }, [open, menu.members])

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await updateAppMenu(appId, menu.id, {members}, 'PATCH')
      setOpen(false)
      await onSaved()
    } catch (caught) {
      setError(toErrorMessage(caught, '保存菜单授权失败，请稍后重试。'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={(next) => !saving && setOpen(next)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={memberCount > 0 ? `授权（已设置 ${memberCount} 项）` : '授权'}
          aria-label={'授权：' + menu.name}
          disabled={disabled}
        >
          <ShieldCheck className={cn('h-4 w-4', memberCount > 0 && 'text-primary')}/>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="z-[1100] w-80 space-y-3 p-4"
        aria-label={'菜单授权 · ' + menu.name}
      >
        <div className="text-sm font-semibold text-foreground">菜单授权 · {menu.name}</div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DirectoryMemberPicker
          appId={appId}
          value={members}
          onChange={setMembers}
          disabled={saving}
          multiple
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={saving}
                  onClick={() => setOpen(false)}>取消</Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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

function findMenuById(menus: AppMenu[], menuId: string): AppMenu | undefined {
  for (const menu of menus) {
    if (menu.id === menuId) return menu
    const child = findMenuById(menu.children ?? [], menuId)
    if (child) return child
  }
  return undefined
}

function targetValue(target?: { type: AppMenuTargetType; id: string } | null) {
  return target ? `${target.type}:${target.id}` : undefined
}

function targetFromValue(value?: string) {
  if (!value) return null
  const separatorIndex = value.indexOf(':')
  if (separatorIndex < 0) return null
  return {
    type: value.slice(0, separatorIndex) as AppMenuTargetType,
    id: value.slice(separatorIndex + 1),
  }
}

function MenuEditorDialog({
                            open,
                            onOpenChange,
                            activeTopId,
                            onActiveTopIdChange,
                            onMenusChange,
                            appId,
                            draft,
                          }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeTopId: string
  onActiveTopIdChange: (id: string) => void
  onMenusChange: (menus?: AppMenu[]) => void
  appId?: string
  draft?: MenuEditorDraft | null
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedTopId, setSelectedTopId] = React.useState(activeTopId)
  const [form, setForm] = React.useState<EditorForm | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null)
  const wasOpenRef = React.useRef(false)
  const [apiMenus, setApiMenus] = React.useState<AppMenu[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

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
      icon: 'none',
      type: 'menu',
    })
  }, [open, appId, draft])

  const loadMenus = React.useCallback(async (): Promise<AppMenu[]> => {
    if (!appId) return []
    setIsLoading(true)
    setActionError(null)
    try {
      const loadedMenus = await getAppMenus(appId)
      setApiMenus(loadedMenus)
      return loadedMenus
    } catch (caught) {
      setActionError(toErrorMessage(caught, '加载应用菜单失败，请稍后重试。'))
      return []
    } finally {
      setIsLoading(false)
    }
  }, [appId])

  React.useEffect(() => {
    if (!open || !appId) return
    void loadMenus()
  }, [open, appId, loadMenus])

  const topMenus = React.useMemo(
    () => appId ? apiMenus.map((menu) => toTopNavigationItem(menu, appId)) : topNavs,
    [appId, apiMenus],
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
  const editLeft = (item: NavItem) =>
    setForm({
      kind: 'left',
      id: item.id,
      text: item.text,
      link: appId ? targetValue(findMenuById(apiMenus, item.id)?.target) : item.to,
      icon: iconName(item.icon),
      type: item.sub ? 'group' : 'menu',
    })
  const editSub = (parentId: string, item: NavItem) =>
    setForm({
      kind: 'sub',
      id: item.id,
      parentId,
      text: item.text,
      link: appId ? targetValue(findMenuById(apiMenus, item.id)?.target) : item.to,
      icon: iconName(item.icon),
    })

  const isValid = (() => {
    if (!form) return false
    if (!form.text.trim()) return false
    if (form.kind === 'left' && !selectedTop.id) return false
    if (form.kind === 'sub' && !form.parentId) return false
    if (appId && form.kind === 'left' && form.type === 'menu') {
      const target = targetFromValue(form.link)
      if (!target) return false
      return target.type !== 'LINK' || isValidHttpUrl(target.id)
    }
    if (appId && form.kind === 'sub') {
      const target = targetFromValue(form.link)
      if (!target) return false
      return target.type !== 'LINK' || isValidHttpUrl(target.id)
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
          icon: form.icon === 'none' ? undefined : navIcons[form.icon],
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
          icon: form.icon === 'none' ? undefined : navIcons[form.icon],
          type: 'menu' as const,
        }
        const saved = form.id
          ? updateLeftSubmenu(selectedTop.id, form.parentId, form.id, values)
          : createLeftSubmenu(selectedTop.id, form.parentId, values)
        if (saved) editSub(form.parentId, saved)
      }
      onMenusChange()
      return
    }

    const saveToApi = async () => {
      setIsSaving(true)
      setActionError(null)
      try {
        let input: AppMenuInput
        if (form.kind === 'top') {
          input = {type: 'GROUP', name: form.text.trim(), iconName: null}
        } else if (form.kind === 'left') {
          input = {
            type: form.type === 'group' ? 'GROUP' : 'ITEM',
            name: form.text.trim(),
            iconName: form.icon === 'none' ? null : form.icon,
            parentId: selectedTop.id,
            target: form.type === 'group' ? null : targetFromValue(form.link),
          }
        } else {
          input = {
            type: 'ITEM',
            name: form.text.trim(),
            iconName: form.icon === 'none' ? null : form.icon,
            parentId: form.parentId,
            target: targetFromValue(form.link),
          }
        }

        const saved = form.id ? await updateAppMenu(appId, form.id, input) : await createAppMenu(appId, input)
        if (form.kind === 'top' && !form.id) {
          setSelectedTopId(saved.id)
          onActiveTopIdChange(saved.id)
        }
        const nextMenus = await loadMenus()
        onMenusChange(nextMenus)

        if (form.kind === 'top') {
          setForm({kind: 'top', id: saved.id, text: saved.name})
        } else if (form.kind === 'left') {
          setForm({
            kind: 'left',
            id: saved.id,
            text: saved.name,
            link: targetValue(saved.target),
            icon: (saved.iconName ?? 'none') as NavIconName | 'none',
            type: saved.type === 'GROUP' ? 'group' : 'menu',
          })
        } else {
          setForm({
            kind: 'sub',
            id: saved.id,
            parentId: form.parentId,
            text: saved.name,
            link: targetValue(saved.target),
            icon: (saved.iconName ?? 'none') as NavIconName | 'none',
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
      onMenusChange()
      return
    }

    const deleteFromApi = async () => {
      setIsSaving(true)
      setActionError(null)
      try {
        await deleteAppMenu(appId, target.item.id)
        const nextMenus = await loadMenus()
        if (target.kind === 'top') {
          const nextTopId = nextMenus[0]?.id ?? ''
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
        onMenusChange(nextMenus)
      } catch (caught) {
        setActionError(toErrorMessage(caught, '删除菜单失败，请稍后重试。'))
      } finally {
        setIsSaving(false)
      }
    }
    void deleteFromApi()
  }

  const saveOrder = (nextMenus: AppMenu[]) => {
    if (!appId) return
    const persistOrder = async () => {
      setIsSaving(true)
      setActionError(null)
      try {
        const savedMenus = await reorderAppMenus(appId, menuOrderInput(nextMenus))
        setApiMenus(savedMenus)
        onMenusChange(savedMenus)
      } catch (caught) {
        setActionError(toErrorMessage(caught, '保存菜单顺序失败，请稍后重试。'))
        await loadMenus()
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
      onMenusChange()
      return
    }
    const menusById = new Map(apiMenus.map((menu) => [menu.id, menu]))
    saveOrder(orderedIds.map((id) => menusById.get(id)).filter((menu): menu is AppMenu => Boolean(menu)))
  }

  const dragInfo = (dragId: string) => {
    const value = String(dragId)
    if (value.startsWith('left-root-')) {
      return {menuId: undefined, parentId: selectedTop.id, index: undefined}
    }
    if (value.startsWith('left-')) {
      const menuId = value.slice(5)
      return {
        menuId,
        parentId: selectedTop.id,
        index: selectedTop.navs.findIndex((item) => item.id === menuId) + 1,
      }
    }
    if (value.startsWith('child-')) {
      const [parentId, menuId] = value.slice(6).split('__')
      const group = findMenuById(apiMenus, parentId)
      return {
        menuId,
        parentId,
        index: (group?.children ?? []).findIndex((item) => item.id === menuId) + 1,
      }
    }
    return undefined
  }

  const moveMenuToParent = async (
    menu: AppMenu,
    targetParentId: string,
    targetIndex: number,
  ) => {
    setIsSaving(true)
    setActionError(null)
    try {
      const input: AppMenuInput = {
        type: menu.type,
        name: menu.name,
        iconName: menu.iconName ?? null,
        parentId: targetParentId,
        target: menu.target ? {type: menu.target.type, id: menu.target.id} : null,
      }
      await updateAppMenu(appId!, menu.id, input)
      const nextMenus = moveMenuNode(apiMenus, menu.id, targetParentId, targetIndex)
      const savedMenus = await reorderAppMenus(appId!, menuOrderInput(nextMenus))
      setApiMenus(savedMenus)
      onMenusChange(savedMenus)
      if (form?.id === menu.id) {
        setForm(targetParentId === selectedTop.id
          ? {
            kind: 'left',
            id: menu.id,
            text: menu.name,
            link: targetValue(menu.target),
            icon: (menu.iconName ?? 'none') as NavIconName | 'none',
            type: 'menu',
          }
          : {
            kind: 'sub',
            id: menu.id,
            parentId: targetParentId,
            text: menu.name,
            link: targetValue(menu.target),
            icon: (menu.iconName ?? 'none') as NavIconName | 'none',
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
    if (!activeInfo?.menuId || !overInfo) return

    const activeMenu = appId ? findMenuById(apiMenus, activeInfo.menuId) : undefined
    const activeParentId = activeMenu?.parentId ?? activeInfo.parentId
    if (activeParentId === overInfo.parentId) {
      if (!overInfo.menuId) return
      const children = appId
        ? (findMenuById(apiMenus, overInfo.parentId)?.children ?? [])
        : (getLeftMenuGroup(selectedTop.id, overInfo.parentId)?.sub ?? [])
      const oldIndex = children.findIndex((item) => item.id === activeInfo.menuId)
      const newIndex = children.findIndex((item) => item.id === overInfo.menuId)
      if (oldIndex < 0 || newIndex < 0) return
      const orderedMenus = [...children]
      const [movedMenu] = orderedMenus.splice(oldIndex, 1)
      orderedMenus.splice(newIndex, 0, movedMenu)
      const orderedIds = orderedMenus.map((item) => item.id)
      if (!appId) {
        if (overInfo.parentId === selectedTop.id) reorderLeftMenus(selectedTop.id, orderedIds)
        else reorderLeftSubmenus(selectedTop.id, overInfo.parentId, orderedIds)
        onMenusChange()
        return
      }
      saveOrder(reorderMenuChildren(apiMenus, overInfo.parentId, orderedIds))
      return
    }

    if (!appId || !activeMenu || activeMenu.type !== 'ITEM') return
    const targetParent = findMenuById(apiMenus, overInfo.parentId)
    const targetIndex = overInfo.index ?? (targetParent?.children.length ?? 0)
    void moveMenuToParent(activeMenu, overInfo.parentId, targetIndex)
  }

  const refreshAuthorizedMenus = async () => {
    if (!appId) return
    try {
      const menus = await getAppMenus(appId)
      setApiMenus(menus)
      onMenusChange(menus)
    } catch (caught) {
      setActionError(toErrorMessage(caught, '刷新菜单授权失败，请稍后重试。'))
    }
  }

  const authorizationFor = (menuId: string) => {
    if (!appId) return undefined
    const menu = findMenuById(apiMenus, menuId)
    if (!menu) return undefined
    return (
      <MenuAuthorizationPopover
        appId={appId}
        menu={menu}
        disabled={isSaving}
        onSaved={refreshAuthorizedMenus}
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
                    <MenuLinkPicker
                      value={form.link}
                      onChange={(link) => setForm({...form, link})}
                      appId={appId}
                    />
                  </>
                )}

                {form.kind === 'sub' && (
                  <>
                    <label className="block text-xs font-medium text-foreground">关联项</label>
                    <MenuLinkPicker
                      value={form.link}
                      onChange={(link) => setForm({...form, link})}
                      appId={appId}
                    />
                  </>
                )}

                {form.kind !== 'top' && (
                  <>
                    <label className="block text-xs font-medium text-foreground">图标</label>
                    <OptionalIconPicker
                      value={form.icon}
                      options={navIconOptions}
                      icons={navIcons}
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
    </>
  )
}

function pathMatches(pathname: string, target?: string) {
  if (!target) return false
  return pathname === target || pathname.startsWith(`${target}/`)
}

export {MenuEditorDialog}

import * as React from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import {Folder, GripVertical, Pencil, Plus, Trash2} from 'lucide-react'
import {RbDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {cn} from '@/lib/utils'
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
  | { kind: 'top'; id?: string; text: string; to: string }
  | { kind: 'left'; id?: string; text: string; to: string; icon: NavIconName | 'none'; type: LeftMenuItemType }
  | { kind: 'sub'; id?: string; parentId: string; text: string; to: string; icon: NavIconName | 'none' }

type DeleteTarget =
  | { kind: 'top'; item: TopNavItem }
  | { kind: 'left'; item: NavItem }
  | { kind: 'sub'; item: NavItem; parentId: string }

const sensorsOptions = {
  activationConstraint: {distance: 4},
}

function iconName(icon?: NavItem['icon']) {
  return navIconOptions.find((name) => navIcons[name] === icon) ?? 'none'
}

function TopMenuRow({
                      menu,
                      selected,
                      onSelect,
                      onEdit,
                      onDelete,
                    }: {
  menu: TopNavItem
  selected: boolean
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
          <span className="block truncate text-xs text-muted-foreground">{menu.to}</span>
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="编辑一级菜单"
        onClick={() => onEdit(menu)}
      >
        <Pencil className="h-4 w-4"/>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="删除一级菜单"
        disabled={topNavs.length <= 1}
        onClick={() => onDelete(menu)}
      >
        <Trash2 className="h-4 w-4"/>
      </Button>
    </div>
  )
}

function LeftMenuRow({
                       item,
                       selected,
                       onEdit,
                       onDelete,
                       onAddChild,
                     }: {
  item: NavItem
  selected: boolean
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
          <span className="block truncate text-xs text-muted-foreground">
            {item.sub ? `分组 · ${item.sub.length} 项` : item.to || '未设置路径'}
          </span>
        </span>
      </button>
      {item.sub && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="新增分组内菜单"
          onClick={() => onAddChild(item.id)}
        >
          <Plus className="h-4 w-4"/>
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title={item.sub ? '编辑分组' : '编辑菜单'}
        onClick={() => onEdit(item)}
      >
        <Pencil className="h-4 w-4"/>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title={item.sub ? '删除分组' : '删除菜单'}
        onClick={() => onDelete(item)}
      >
        <Trash2 className="h-4 w-4"/>
      </Button>
    </div>
  )
}

function SubmenuRow({
                      parentId,
                      item,
                      selected,
                      onEdit,
                      onDelete,
                    }: {
  parentId: string
  item: NavItem
  selected: boolean
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
          <span className="block truncate text-xs text-muted-foreground">{item.to || '未设置路径'}</span>
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="编辑分组内菜单"
        onClick={() => onEdit(parentId, item)}
      >
        <Pencil className="h-4 w-4"/>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="删除分组内菜单"
        onClick={() => onDelete(parentId, item)}
      >
        <Trash2 className="h-4 w-4"/>
      </Button>
    </div>
  )
}

function MenuEditorDialog({
                            open,
                            onOpenChange,
                            activeTopId,
                            onActiveTopIdChange,
                            onMenusChange,
                          }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeTopId: string
  onActiveTopIdChange: (id: string) => void
  onMenusChange: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedTopId, setSelectedTopId] = React.useState(activeTopId)
  const [form, setForm] = React.useState<EditorForm | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null)
  const wasOpenRef = React.useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, sensorsOptions),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
  )

  React.useEffect(() => {
    if (open && !wasOpenRef.current) setSelectedTopId(activeTopId)
    wasOpenRef.current = open
  }, [open, activeTopId])

  const selectedTop = getTopNavById(selectedTopId) ?? topNavs[0]

  const startTop = () => setForm({kind: 'top', text: '', to: ''})
  const startLeft = (type: LeftMenuItemType) =>
    setForm({kind: 'left', text: '', to: '', icon: 'none', type})
  const startSub = (parentId: string) =>
    setForm({kind: 'sub', parentId, text: '', to: '', icon: 'none'})

  const editTop = (menu: TopNavItem) => setForm({kind: 'top', id: menu.id, text: menu.text, to: menu.to})
  const editLeft = (item: NavItem) =>
    setForm({
      kind: 'left',
      id: item.id,
      text: item.text,
      to: item.to ?? '',
      icon: iconName(item.icon),
      type: item.sub ? 'group' : 'menu',
    })
  const editSub = (parentId: string, item: NavItem) =>
    setForm({
      kind: 'sub',
      id: item.id,
      parentId,
      text: item.text,
      to: item.to ?? '',
      icon: iconName(item.icon),
    })

  const isValid = (() => {
    if (!form) return false
    if (form.kind === 'top') return Boolean(form.text.trim() && form.to.trim().startsWith('/'))
    if (form.kind === 'left') {
      if (!form.text.trim()) return false
      if (form.type === 'group') return true
      return form.to.trim().startsWith('/')
    }
    return Boolean(form.text.trim() && form.to.trim().startsWith('/'))
  })()

  const save = () => {
    if (!form || !isValid) return

    if (form.kind === 'top') {
      const values: TopMenuItemInput = {text: form.text.trim(), to: form.to.trim()}
      const saved = form.id ? updateTopMenu(form.id, values) : createTopMenu(values)
      if (saved) {
        setSelectedTopId(saved.id)
        onActiveTopIdChange(saved.id)
        editTop(saved)
      }
    } else if (form.kind === 'left') {
      const values = {
        text: form.text.trim(),
        to: form.type === 'group' ? undefined : form.to.trim(),
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
        to: form.to.trim(),
        icon: form.icon === 'none' ? undefined : navIcons[form.icon],
        type: 'menu' as const,
      }
      const saved = form.id
        ? updateLeftSubmenu(selectedTop.id, form.parentId, form.id, values)
        : createLeftSubmenu(selectedTop.id, form.parentId, values)
      if (saved) editSub(form.parentId, saved)
    }

    onMenusChange()
  }

  const confirmDelete = () => {
    if (!deleteTarget) return

    if (deleteTarget.kind === 'top') {
      const nextTop = topNavs.find((nav) => nav.id !== deleteTarget.item.id) ?? topNavs[0]
      if (!deleteTopMenu(deleteTarget.item.id)) {
        setDeleteTarget(null)
        return
      }
      if (deleteTarget.item.id === activeTopId) {
        onActiveTopIdChange(nextTop.id)
        navigate(nextTop.to)
      }
      setSelectedTopId(nextTop.id)
      setForm(null)
    } else if (deleteTarget.kind === 'left') {
      if (!deleteLeftMenu(selectedTop.id, deleteTarget.item.id)) {
        setDeleteTarget(null)
        return
      }
      if (pathMatches(location.pathname, deleteTarget.item.to)) navigate(selectedTop.to)
      setForm(null)
    } else {
      if (!deleteLeftSubmenu(selectedTop.id, deleteTarget.parentId, deleteTarget.item.id)) {
        setDeleteTarget(null)
        return
      }
      if (pathMatches(location.pathname, deleteTarget.item.to)) navigate(selectedTop.to)
      setForm(null)
    }

    setDeleteTarget(null)
    onMenusChange()
  }

  const handleTopDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id).slice(4)
    const overId = String(over.id).slice(4)
    const oldIndex = topNavs.findIndex((item) => item.id === activeId)
    const newIndex = topNavs.findIndex((item) => item.id === overId)
    if (oldIndex < 0 || newIndex < 0) return
    reorderTopMenus(arrayMove(topNavs, oldIndex, newIndex).map((item) => item.id))
    onMenusChange()
  }

  const handleLeftDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id).slice(5)
    const overId = String(over.id).slice(5)
    const oldIndex = selectedTop.navs.findIndex((item) => item.id === activeId)
    const newIndex = selectedTop.navs.findIndex((item) => item.id === overId)
    if (oldIndex < 0 || newIndex < 0) return
    reorderLeftMenus(
      selectedTop.id,
      arrayMove(selectedTop.navs, oldIndex, newIndex).map((item) => item.id),
    )
    onMenusChange()
  }

  const handleChildDragEnd = (parentId: string) => (event: DragEndEvent) => {
    const group = getLeftMenuGroup(selectedTop.id, parentId)
    if (!group) return
    const {active, over} = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id).split('__')[1]
    const overId = String(over.id).split('__')[1]
    const oldIndex = group.sub.findIndex((item) => item.id === activeId)
    const newIndex = group.sub.findIndex((item) => item.id === overId)
    if (oldIndex < 0 || newIndex < 0) return
    reorderLeftSubmenus(
      selectedTop.id,
      parentId,
      arrayMove(group.sub, oldIndex, newIndex).map((item) => item.id),
    )
    onMenusChange()
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
      <RbDialog open={open} onOpenChange={onOpenChange} title="菜单编辑" width={1180} height="85vh">
        <div className="h-full grid gap-4 lg:grid-cols-3 lg:grid-rows-1">
          <section className="flex min-h-0 flex-col rounded-lg border bg-background p-3 lg:h-full">
            <header className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <div className="min-w-0">
                <h6 className="truncate text-sm font-semibold text-foreground">一级菜单</h6>
                <p className="truncate text-xs text-muted-foreground">顶部导航</p>
              </div>
              <Button type="button" size="sm" onClick={startTop}>
                <Plus className="h-4 w-4"/> 新增
              </Button>
            </header>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTopDragEnd}>
              <SortableContext
                items={topNavs.map((item) => `top-${item.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {topNavs.map((item) => (
                    <TopMenuRow
                      key={item.id}
                      menu={item}
                      selected={selectedTop.id === item.id}
                      onSelect={(menu) => {
                        setSelectedTopId(menu.id)
                        editTop(menu)
                      }}
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
                <Button type="button" size="sm" onClick={() => startLeft('menu')}>
                  <Plus className="h-4 w-4"/> 菜单
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => startLeft('group')}>
                  <Plus className="h-4 w-4"/> 分组
                </Button>
              </div>
            </header>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLeftDragEnd}>
              <SortableContext
                items={selectedTop.navs.map((item) => `left-${item.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {selectedTop.navs.map((item) => (
                    <div key={item.id} className="space-y-2">
                      <LeftMenuRow
                        item={item}
                        selected={form?.kind === 'left' && form.id === item.id}
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
                            >
                              <Plus className="h-4 w-4"/> 新增子菜单
                            </Button>
                          </div>
                          {item.sub.length === 0 && (
                            <div
                              className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
                              暂无子菜单
                            </div>
                          )}
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleChildDragEnd(item.id)}
                          >
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
                                  onEdit={editSub}
                                  onDelete={(parentId, menuItem) =>
                                    setDeleteTarget({kind: 'sub', parentId, item: menuItem})
                                  }
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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

                {form.kind !== 'left' || form.type === 'menu' ? (
                  <>
                    <label className="block text-xs font-medium text-foreground">路径</label>
                    <Input
                      value={form.to}
                      onChange={(event) => setForm({...form, to: event.target.value})}
                      placeholder="/dashboard/home"
                    />
                  </>
                ) : null}

                {form.kind !== 'top' && (
                  <>
                    <label className="block text-xs font-medium text-foreground">图标</label>
                    <Select
                      value={form.icon}
                      onValueChange={(value) => setForm({...form, icon: value as NavIconName | 'none'})}
                    >
                      <SelectTrigger>
                        <SelectValue/>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">无图标</SelectItem>
                        {navIconOptions.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setForm(null)}>
                    取消
                  </Button>
                  <Button type="button" onClick={save} disabled={!isValid}>
                    保存
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </RbDialog>

      <RbDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}
        title="删除菜单"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete}>
              删除
            </Button>
          </>
        }
      >
        <div className="pt-1">{deleteText}</div>
      </RbDialog>
    </>
  )
}

function pathMatches(pathname: string, target?: string) {
  if (!target) return false
  return pathname === target || pathname.startsWith(`${target}/`)
}

export {MenuEditorDialog}

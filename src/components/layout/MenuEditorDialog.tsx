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
import {GripVertical, Pencil, Plus, Trash2} from 'lucide-react'
import {RbDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {cn} from '@/lib/utils'
import {
  createLeftMenu,
  createTopMenu,
  deleteLeftMenu,
  deleteTopMenu,
  getTopNavById,
  navIcons,
  navIconOptions,
  reorderLeftMenus,
  reorderTopMenus,
  topNavs,
  updateLeftMenu,
  updateTopMenu,
  type LeftMenuItemInput,
  type NavIconName,
  type NavItem,
  type TopMenuItemInput,
  type TopNavItem,
} from '@/data/mock'

type TopFormState = {
  id?: string
  text: string
  to: string
}

type LeftFormState = {
  id?: string
  text: string
  to: string
  icon: NavIconName | 'none'
}

type DeleteTarget =
  | { kind: 'top'; item: TopNavItem }
  | { kind: 'left'; item: NavItem }

function pathMatches(pathname: string, target?: string) {
  if (!target) return false
  return pathname === target || pathname.startsWith(`${target}/`)
}

function TopMenuRow({
                      menu,
                      selected,
                      canDelete,
                      onSelect,
                      onEdit,
                      onDelete,
                    }: {
  menu: TopNavItem
  selected: boolean
  canDelete: boolean
  onSelect: (id: string) => void
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
        'flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm',
        isDragging && 'z-10 opacity-75',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(menu.id)}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left transition-colors',
          selected ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground"/>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{menu.text}</span>
          <span className="block truncate text-xs text-muted-foreground">{menu.to}</span>
        </span>
      </button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(menu)}>
        <Pencil className="h-4 w-4"/>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={!canDelete}
        onClick={() => onDelete(menu)}
      >
        <Trash2 className="h-4 w-4"/>
      </Button>
    </div>
  )
}

function LeftMenuRow({
                       item,
                       onEdit,
                       onDelete,
                     }: {
  item: NavItem
  onEdit: (item: NavItem) => void
  onDelete: (item: NavItem) => void
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
        'flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm',
        isDragging && 'z-10 opacity-75',
      )}
    >
      <button
        type="button"
        onClick={() => onEdit(item)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground"/>
        {Icon ? <Icon className="h-4 w-4 shrink-0"/> : null}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{item.text}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {item.to || (item.sub ? '分组菜单' : '未设置路径')}
          </span>
        </span>
      </button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}>
        <Pencil className="h-4 w-4"/>
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(item)}>
        <Trash2 className="h-4 w-4"/>
      </Button>
    </div>
  )
}

export function MenuEditorDialog({
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
  const [topForm, setTopForm] = React.useState<TopFormState | null>(null)
  const [leftForm, setLeftForm] = React.useState<LeftFormState | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
  )

  React.useEffect(() => {
    if (open) setSelectedTopId(activeTopId)
  }, [open, activeTopId])

  const selectedTop = getTopNavById(selectedTopId) ?? topNavs[0]

  const startCreateTop = () => setTopForm({text: '', to: ''})
  const startEditTop = (menu: TopNavItem) => setTopForm({id: menu.id, text: menu.text, to: menu.to})
  const startCreateLeft = () => setLeftForm({text: '', to: '', icon: 'none'})
  const startEditLeft = (item: NavItem) => {
    const iconName = navIconOptions.find((name) => navIcons[name] === item.icon)
    setLeftForm({
      id: item.id,
      text: item.text,
      to: item.to ?? '',
      icon: iconName ?? 'none',
    })
  }

  const topValid = Boolean(
    topForm && topForm.text.trim() && topForm.to.trim().startsWith('/'),
  )
  const leftValid = Boolean(
    leftForm && leftForm.text.trim() && (!leftForm.to || leftForm.to.trim().startsWith('/')),
  )

  const saveTop = () => {
    if (!topForm || !topValid) return
    const values: TopMenuItemInput = {
      text: topForm.text.trim(),
      to: topForm.to.trim(),
    }
    if (topForm.id) updateTopMenu(topForm.id, values)
    else createTopMenu(values)
    setTopForm(null)
    onMenusChange()
  }

  const saveLeft = () => {
    if (!leftForm || !leftValid) return
    const values: LeftMenuItemInput = {
      text: leftForm.text.trim(),
      to: leftForm.to.trim() || undefined,
      icon: leftForm.icon === 'none' ? undefined : navIcons[leftForm.icon],
    }
    if (leftForm.id) updateLeftMenu(selectedTop.id, leftForm.id, values)
    else createLeftMenu(selectedTop.id, values)
    setLeftForm(null)
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
    } else {
      const target = deleteTarget.item
      if (!deleteLeftMenu(selectedTop.id, target.id)) {
        setDeleteTarget(null)
        return
      }
      if (pathMatches(location.pathname, target.to)) navigate(selectedTop.to)
    }

    setDeleteTarget(null)
    onMenusChange()
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith('top-') && overId.startsWith('top-')) {
      const activeMenuId = activeId.slice(4)
      const overMenuId = overId.slice(4)
      const oldIndex = topNavs.findIndex((item) => item.id === activeMenuId)
      const newIndex = topNavs.findIndex((item) => item.id === overMenuId)
      if (oldIndex < 0 || newIndex < 0) return
      reorderTopMenus(arrayMove(topNavs, oldIndex, newIndex).map((item) => item.id))
      onMenusChange()
    } else if (activeId.startsWith('left-') && overId.startsWith('left-')) {
      const activeMenuId = activeId.slice(5)
      const overMenuId = overId.slice(5)
      const oldIndex = selectedTop.navs.findIndex((item) => item.id === activeMenuId)
      const newIndex = selectedTop.navs.findIndex((item) => item.id === overMenuId)
      if (oldIndex < 0 || newIndex < 0) return
      reorderLeftMenus(
        selectedTop.id,
        arrayMove(selectedTop.navs, oldIndex, newIndex).map((item) => item.id),
      )
      onMenusChange()
    }
  }

  const deleteText =
    deleteTarget?.kind === 'top'
      ? `确认删除一级菜单「${deleteTarget.item.text}」吗？`
      : deleteTarget
        ? `确认删除左侧菜单「${deleteTarget.item.text}」吗？`
        : ''

  return (
    <>
      <RbDialog open={open} onOpenChange={onOpenChange} title="菜单编辑" width={980}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="min-w-0 rounded-lg border bg-background p-3">
              <header className="flex items-center justify-between gap-2 border-b border-border pb-3">
                <div className="min-w-0">
                  <h6 className="truncate text-sm font-semibold text-foreground">一级菜单</h6>
                  <p className="truncate text-xs text-muted-foreground">拖动排序，点击切换右侧左侧菜单</p>
                </div>
                <Button type="button" size="sm" onClick={startCreateTop}>
                  <Plus className="h-4 w-4"/> 新增
                </Button>
              </header>
              <SortableContext items={topNavs.map((item) => `top-${item.id}`)} strategy={verticalListSortingStrategy}>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {topNavs.map((item) => (
                    <TopMenuRow
                      key={item.id}
                      menu={item}
                      selected={selectedTop.id === item.id}
                      canDelete={topNavs.length > 1}
                      onSelect={(id) => {
                        setSelectedTopId(id)
                        setLeftForm(null)
                      }}
                      onEdit={startEditTop}
                      onDelete={(menu) => setDeleteTarget({kind: 'top', item: menu})}
                    />
                  ))}
                </div>
              </SortableContext>

              {topForm && (
                <div className="mt-3 rounded-lg border bg-card p-3">
                  <div className="grid gap-2">
                    <label className="text-xs font-medium text-foreground">菜单名称</label>
                    <Input
                      value={topForm.text}
                      onChange={(event) => setTopForm({...topForm, text: event.target.value})}
                      placeholder="请输入菜单名称"
                    />
                    <label className="text-xs font-medium text-foreground">默认路径</label>
                    <Input
                      value={topForm.to}
                      onChange={(event) => setTopForm({...topForm, to: event.target.value})}
                      placeholder="/dashboard/home"
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" onClick={() => setTopForm(null)}>
                        取消
                      </Button>
                      <Button type="button" onClick={saveTop} disabled={!topValid}>
                        保存
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="min-w-0 rounded-lg border bg-background p-3">
              <header className="flex items-center justify-between gap-2 border-b border-border pb-3">
                <div className="min-w-0">
                  <h6 className="truncate text-sm font-semibold text-foreground">
                    {selectedTop.text} · 左侧菜单
                  </h6>
                  <p className="truncate text-xs text-muted-foreground">仅维护当前一级菜单下的左侧菜单</p>
                </div>
                <Button type="button" size="sm" onClick={startCreateLeft}>
                  <Plus className="h-4 w-4"/> 新增
                </Button>
              </header>
              <SortableContext
                items={selectedTop.navs.map((item) => `left-${item.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {selectedTop.navs.map((item) => (
                    <LeftMenuRow
                      key={item.id}
                      item={item}
                      onEdit={startEditLeft}
                      onDelete={(menuItem) => setDeleteTarget({kind: 'left', item: menuItem})}
                    />
                  ))}
                </div>
              </SortableContext>

              {leftForm && (
                <div className="mt-3 rounded-lg border bg-card p-3">
                  <div className="grid gap-2">
                    <label className="text-xs font-medium text-foreground">菜单名称</label>
                    <Input
                      value={leftForm.text}
                      onChange={(event) => setLeftForm({...leftForm, text: event.target.value})}
                      placeholder="请输入菜单名称"
                    />
                    <label className="text-xs font-medium text-foreground">跳转路径</label>
                    <Input
                      value={leftForm.to}
                      onChange={(event) => setLeftForm({...leftForm, to: event.target.value})}
                      placeholder="可留空，填写时需以 / 开头"
                    />
                    <label className="text-xs font-medium text-foreground">图标</label>
                    <Select
                      value={leftForm.icon}
                      onValueChange={(value) =>
                        setLeftForm({...leftForm, icon: value as NavIconName | 'none'})
                      }
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
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" onClick={() => setLeftForm(null)}>
                        取消
                      </Button>
                      <Button type="button" onClick={saveLeft} disabled={!leftValid}>
                        保存
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </DndContext>
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
              保存
            </Button>
          </>
        }
      >
        <div className="pt-1">{deleteText}</div>
      </RbDialog>
    </>
  )
}

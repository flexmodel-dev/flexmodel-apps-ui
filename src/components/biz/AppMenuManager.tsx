import * as React from 'react'
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
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {OptionalIconPicker} from '@/components/biz/IconPicker'
import {AppLoading} from '@/components/biz/AppLoading'
import {Empty} from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {navIcons, navIconOptions, type NavIconName} from '@/data/mock'
import {
  createAppMenu,
  deleteAppMenu,
  getAppMenuTargets,
  getAppMenus,
  reorderAppMenus,
  updateAppMenu,
  type AppMenu,
  type AppMenuInput,
  type AppMenuTargetType,
  type AppMenuTargets,
  type AppMenuType,
} from '@/services/appMenus'
import {menuOrderInput} from '@/services/appMenuNavigation'
import {cn} from '@/lib/utils'

interface MenuForm {
  id?: string
  type: AppMenuType
  name: string
  iconName: NavIconName | 'none'
  parentId: string
  targetValue: string
}

const emptyForm: MenuForm = {
  type: 'ITEM',
  name: '',
  iconName: 'none',
  parentId: 'root',
  targetValue: '',
}

const sensorsOptions = {activationConstraint: {distance: 4}}

function targetValue(target?: { type: AppMenuTargetType; id: string } | null) {
  return target ? `${target.type}:${target.id}` : ''
}

function MenuRow({
                   menu,
                   scope,
                   targetLabel,
                   onEdit,
                   onDelete,
                 }: {
  menu: AppMenu
  scope: 'root' | 'child'
  targetLabel?: string
  onEdit: () => void
  onDelete: () => void
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
    id: `${scope}-${menu.id}`,
  })
  const Icon = menu.iconName && menu.iconName !== 'none'
    ? navIcons[menu.iconName as NavIconName]
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm',
        isDragging && 'z-10 opacity-80',
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground"/>
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-primary"/> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{menu.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {menu.type === 'GROUP' ? '分组' : (targetLabel ?? menu.pageRoute ?? '未绑定页面')}
          </span>
        </span>
      </button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="编辑菜单" onClick={onEdit}>
        <Pencil className="h-4 w-4"/>
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="删除菜单" onClick={onDelete}>
        <Trash2 className="h-4 w-4"/>
      </Button>
    </div>
  )
}

export function AppMenuManager({
                                 appId,
                                 onMenusChange,
                               }: {
  appId: string
  onMenusChange?: (menus: AppMenu[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: sensorsOptions.activationConstraint}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
  )
  const [menus, setMenus] = React.useState<AppMenu[]>([])
  const [targets, setTargets] = React.useState<AppMenuTargets>({builtIn: [], entities: []})
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<MenuForm | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<AppMenu | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const loadMenus = React.useCallback(async (): Promise<AppMenu[]> => {
    setIsLoading(true)
    setError(null)
    try {
      const [loadedMenus, loadedTargets] = await Promise.all([
        getAppMenus(appId),
        getAppMenuTargets(appId),
      ])
      setMenus(loadedMenus)
      setTargets(loadedTargets)
      return loadedMenus
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '加载菜单失败，请稍后重试。')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [appId])

  React.useEffect(() => {
    void loadMenus()
  }, [loadMenus])

  const allTargets = [...targets.builtIn, ...targets.entities]
  const targetLabel = (value: string) => {
    const [type, id] = value.split(':')
    return allTargets.find((target) => target.type === type && target.id === id)?.label
  }
  const groups = menus.filter((menu) => menu.type === 'GROUP')

  const startCreate = (type: AppMenuType) => {
    setFormError(null)
    setForm({...emptyForm, type})
  }

  const startEdit = (menu: AppMenu) => {
    setFormError(null)
    setForm({
      id: menu.id,
      type: menu.type,
      name: menu.name,
      iconName: (menu.iconName ?? 'none') as NavIconName | 'none',
      parentId: menu.parentId ?? 'root',
      targetValue: targetValue(menu.target),
    })
  }

  const save = async () => {
    if (!form?.name.trim() || (form.type === 'ITEM' && !form.targetValue)) return
    setIsSaving(true)
    setFormError(null)
    const [targetType, targetId] = form.targetValue.split(':')
    const input: AppMenuInput = {
      type: form.type,
      name: form.name.trim(),
      iconName: form.iconName === 'none' ? null : form.iconName,
      parentId: form.parentId === 'root' ? null : form.parentId,
      target: form.type === 'ITEM'
        ? {type: targetType as AppMenuTargetType, id: targetId}
        : null,
    }
    try {
      if (form.id) await updateAppMenu(appId, form.id, input)
      else await createAppMenu(appId, input)
      setForm(null)
      onMenusChange?.(await loadMenus())
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : '保存菜单失败，请稍后重试。')
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteAppMenu(appId, deleteTarget.id)
      setDeleteTarget(null)
      onMenusChange?.(await loadMenus())
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : '删除菜单失败，请稍后重试。')
    } finally {
      setIsDeleting(false)
    }
  }

  const orderInput = (nextMenus: AppMenu[]) => menuOrderInput(nextMenus)

  const reorder = async (nextMenus: AppMenu[]) => {
    setMenus(nextMenus)
    try {
      const savedMenus = await reorderAppMenus(appId, orderInput(nextMenus))
      setMenus(savedMenus)
      onMenusChange?.(savedMenus)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存菜单顺序失败，请稍后重试。')
      onMenusChange?.(await loadMenus())
    }
  }

  const handleRootDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || active.id === over.id) return
    const oldIndex = menus.findIndex((menu) => `root-${menu.id}` === active.id)
    const newIndex = menus.findIndex((menu) => `root-${menu.id}` === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    void reorder(arrayMove(menus, oldIndex, newIndex))
  }

  const handleChildDragEnd = (group: AppMenu) => (event: DragEndEvent) => {
    const children = group.children ?? []
    const {active, over} = event
    if (!over || active.id === over.id) return
    const oldIndex = children.findIndex((menu) => `child-${menu.id}` === active.id)
    const newIndex = children.findIndex((menu) => `child-${menu.id}` === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const nextChildren = arrayMove(children, oldIndex, newIndex)
    const nextMenus = menus.map((menu) => menu.id === group.id
      ? {...menu, children: nextChildren}
      : menu)
    void reorder(nextMenus)
  }

  const canSave = Boolean(form?.name.trim()) && (form?.type !== 'ITEM' || Boolean(form?.targetValue))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h5 className="m-0 text-sm font-semibold text-foreground">菜单结构</h5>
          <p className="m-0 text-xs text-muted-foreground">支持分组、子菜单、拖拽排序和页面绑定</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => startCreate('ITEM')}>
            <Plus className="h-4 w-4"/> 新增菜单
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => startCreate('GROUP')}>
            <Plus className="h-4 w-4"/> 新增分组
          </Button>
        </div>
      </div>

      {isLoading ? (
        <AppLoading center className="min-h-[240px]"/>
      ) : error ? (
        <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">{error}</div>
      ) : menus.length === 0 ? (
        <Empty
          className="rounded-lg border border-dashed bg-background"
          description="当前应用还没有菜单，请先创建菜单或分组。"
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRootDragEnd}>
          <SortableContext
            items={menus.map((menu) => `root-${menu.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {menus.map((menu) => (
                <div key={menu.id} className="space-y-2">
                  <MenuRow
                    menu={menu}
                    scope="root"
                    targetLabel={menu.target ? targetValue(menu.target) : undefined}
                    onEdit={() => startEdit(menu)}
                    onDelete={() => setDeleteTarget(menu)}
                  />
                  {menu.type === 'GROUP' && (menu.children ?? []).length > 0 && (
                    <div className="ml-5 space-y-2 rounded-lg border-l bg-muted/40 p-2">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleChildDragEnd(menu)}
                      >
                        <SortableContext
                          items={(menu.children ?? []).map((child) => `child-${child.id}`)}
                          strategy={verticalListSortingStrategy}
                        >
                          {(menu.children ?? []).map((child) => (
                            <MenuRow
                              key={child.id}
                              menu={child}
                              scope="child"
                              targetLabel={child.target ? targetValue(child.target) : undefined}
                              onEdit={() => startEdit(child)}
                              onDelete={() => setDeleteTarget(child)}
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
      )}

      <BizDialog
        open={Boolean(form)}
        onOpenChange={(open) => !open && setForm(null)}
        title={form?.id ? '编辑菜单' : '新增菜单'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)} disabled={isSaving}>取消</Button>
            <Button onClick={save} disabled={!canSave || isSaving}>
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </>
        }
      >
        {form ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">菜单类型</label>
              <Select
                value={form.type}
                onValueChange={(type) => setForm({
                  ...form,
                  type: type as AppMenuType,
                  parentId: type === 'GROUP' ? 'root' : form.parentId,
                  targetValue: type === 'GROUP' ? '' : form.targetValue,
                })}
              >
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ITEM">菜单</SelectItem>
                  <SelectItem value="GROUP">分组</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">菜单名称</label>
              <Input
                value={form.name}
                placeholder="请输入菜单名称"
                onChange={(event) => setForm({...form, name: event.target.value})}
              />
            </div>
            {form.type === 'ITEM' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">父级分组</label>
                <Select
                  value={form.parentId}
                  onValueChange={(parentId) => setForm({...form, parentId})}
                >
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">根级菜单</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.type === 'ITEM' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">关联项</label>
                <Select
                  value={form.targetValue || undefined}
                  onValueChange={(value) => setForm({...form, targetValue: value})}
                >
                  <SelectTrigger><SelectValue placeholder="选择后才能绑定页面"/></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>内置模块</SelectLabel>
                      {targets.builtIn.map((target) => (
                        <SelectItem key={target.id} value={`${target.type}:${target.id}`}>
                          {target.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>表单</SelectLabel>
                      {targets.entities.map((target) => (
                        <SelectItem key={target.id} value={`${target.type}:${target.id}`}>
                          {target.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {form.targetValue ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    已自动绑定页面：/apps/{appId}/{form.id ?? '菜单ID'}
                  </p>
                ) : null}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">图标</label>
              <OptionalIconPicker
                value={form.iconName}
                options={navIconOptions}
                icons={navIcons}
                onChange={(iconName) => setForm({...form, iconName})}
              />
            </div>
            {formError ? <div className="text-sm text-destructive" role="alert">{formError}</div> : null}
          </div>
        ) : null}
      </BizDialog>

      <BizDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除菜单"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>取消</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? '删除中...' : '删除'}
            </Button>
          </>
        }
      >
        <div className="pt-1">
          确认删除「{deleteTarget?.name}」吗？
          {deleteTarget?.type === 'GROUP' ? '分组内的菜单将同时删除。' : ''}
        </div>
      </BizDialog>
    </div>
  )
}

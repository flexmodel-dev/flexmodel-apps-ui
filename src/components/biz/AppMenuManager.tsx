import * as React from 'react'
import {useAppDataRevision} from '@/lib/useAppDataRevision'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
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
import {GripVertical, Pencil, Plus, Trash2} from 'lucide-react'
import {BizDialog, ConfirmDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {OptionalIconPicker} from '@/components/biz/IconPicker'
import {AppLoading} from '@/components/biz/AppLoading'
import {MenuAuthorizationButton, MenuAuthorizationDialog} from '@/components/biz/MenuAuthorizationDialog'
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
import {type AppIconName, appIcons, isAppIconName} from '@/data/appIcons'
import {
  type AppNav,
  type AppNavDestinations,
  type AppNavInput,
  type AppNavType,
  createAppNav,
  deleteAppNav,
  getAppNavDestinations,
  getAppNavigation,
  isValidHttpUrl,
  type NavDestinationType,
  navOrderInput,
  reorderAppNavigation,
  updateAppNav,
} from '@/services/appNavigation'
import {cn, toErrorMessage} from '@/lib/utils'

interface MenuForm {
  id?: string
  type: AppNavType
  name: string
  iconName: AppIconName | 'none'
  parentId: string
  destinationValue: string
}

const emptyForm: MenuForm = {
  type: 'ENTRY',
  name: '',
  iconName: 'none',
  parentId: 'root',
  destinationValue: '',
}

const sensorsOptions = {activationConstraint: {distance: 4}}

function destinationValue(destination?: { type: NavDestinationType; id: string } | null) {
  return destination ? `${destination.type}:${destination.id}` : ''
}

function parseDestinationValue(value: string) {
  const separatorIndex = value.indexOf(':')
  if (separatorIndex < 0) return null
  return {
    type: value.slice(0, separatorIndex) as NavDestinationType,
    id: value.slice(separatorIndex + 1),
  }
}

function MenuRow({
                   nav,
                   scope,
                   destinationLabel,
                   onAuthorize,
                   onEdit,
                   onDelete,
                 }: {
  nav: AppNav
  scope: 'root' | 'child'
  destinationLabel?: string
  onAuthorize: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
    id: `${scope}-${nav.id}`,
  })
  const Icon = isAppIconName(nav.iconName) ? appIcons[nav.iconName] : undefined

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
          <span className="block truncate text-sm font-medium text-foreground">{nav.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {nav.type === 'GROUP' ? '分组' : (destinationLabel ?? nav.pageRoute ?? '未绑定页面')}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <MenuAuthorizationButton nav={nav} onClick={onAuthorize}/>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="编辑菜单" onClick={onEdit}>
          <Pencil className="h-4 w-4"/>
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="删除菜单" onClick={onDelete}>
          <Trash2 className="h-4 w-4"/>
        </Button>
      </div>
    </div>
  )
}

export function AppMenuManager({
                                 appId,
                                 onNavsChange,
                               }: {
  appId: string
  onNavsChange?: (navs: AppNav[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: sensorsOptions.activationConstraint}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
  )
  const [navs, setNavs] = React.useState<AppNav[]>([])
  const [destinations, setDestinations] = React.useState<AppNavDestinations>({
    builtIn: [],
    forms: [],
  })
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<MenuForm | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<AppNav | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [authorization, setAuthorization] = React.useState<AppNav | null>(null)
  const navigationRevision = useAppDataRevision(appId, ['navigation', 'form', 'workbench'])

  const loadNavs = React.useCallback(async (background = false): Promise<AppNav[]> => {
    if (!background) setIsLoading(true)
    setError(null)
    try {
      const [loadedNavs, loadedDestinations] = await Promise.all([
        getAppNavigation(appId),
        getAppNavDestinations(appId),
      ])
      setNavs(loadedNavs)
      setDestinations(loadedDestinations)
      return loadedNavs
    } catch (caught) {
      setError(toErrorMessage(caught, '加载菜单失败，请稍后重试。'))
      return []
    } finally {
      setIsLoading(false)
    }
  }, [appId])

  React.useEffect(() => {
    void loadNavs(navigationRevision > 0)
  }, [loadNavs, navigationRevision])

  const refreshNavs = async () => {
    try {
      const loadedNavs = await getAppNavigation(appId)
      setNavs(loadedNavs)
      onNavsChange?.(loadedNavs)
    } catch (caught) {
      setError(toErrorMessage(caught, '刷新菜单授权失败，请稍后重试。'))
    }
  }

  const allDestinations = [...destinations.builtIn, ...destinations.forms]
  const destinationLabelOf = (value: string) => {
    const destination = parseDestinationValue(value)
    if (!destination) return undefined
    if (destination.type === 'LINK') return destination.id
    return allDestinations.find((item) => item.type === destination.type && item.id === destination.id)?.label
  }
  const groups = navs.filter((nav) => nav.type === 'GROUP')
  const selectedDestination = form ? parseDestinationValue(form.destinationValue) : null
  const linkUrl = selectedDestination?.type === 'LINK' ? selectedDestination.id : ''

  const startCreate = (type: AppNavType) => {
    setFormError(null)
    setForm({...emptyForm, type})
  }

  const startEdit = (nav: AppNav) => {
    setFormError(null)
    setForm({
      id: nav.id,
      type: nav.type,
      name: nav.name,
      iconName: isAppIconName(nav.iconName) ? nav.iconName : 'none',
      parentId: nav.parentId ?? 'root',
      destinationValue: destinationValue(nav.destination),
    })
  }

  const save = async () => {
    if (!form?.name.trim() || (form.type === 'ENTRY' && !form.destinationValue)) return
    setFormError(null)
    const destination = parseDestinationValue(form.destinationValue)
    if (!destination) return
    if (destination.type === 'LINK' && !isValidHttpUrl(destination.id)) {
      setFormError('请输入有效的 http 或 https 链接。')
      return
    }
    setIsSaving(true)
    const input: AppNavInput = {
      type: form.type,
      name: form.name.trim(),
      iconName: form.iconName === 'none' ? null : form.iconName,
      parentId: form.parentId === 'root' ? null : form.parentId,
      destination: form.type === 'ENTRY'
        ? {type: destination.type, id: destination.type === 'LINK' ? destination.id.trim() : destination.id}
        : null,
    }
    try {
      if (form.id) await updateAppNav(appId, form.id, input)
      else await createAppNav(appId, input)
      setForm(null)
      onNavsChange?.(await loadNavs())
    } catch (caught) {
      setFormError(toErrorMessage(caught, '保存菜单失败，请稍后重试。'))
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setIsDeleting(true)
    try {
      await deleteAppNav(appId, pendingDelete.id)
      setPendingDelete(null)
      onNavsChange?.(await loadNavs())
    } catch (caught) {
      setFormError(toErrorMessage(caught, '删除菜单失败，请稍后重试。'))
    } finally {
      setIsDeleting(false)
    }
  }

  const orderInput = (nextNavs: AppNav[]) => navOrderInput(nextNavs)

  const reorder = async (nextNavs: AppNav[]) => {
    setNavs(nextNavs)
    try {
      const savedNavs = await reorderAppNavigation(appId, orderInput(nextNavs))
      setNavs(savedNavs)
      onNavsChange?.(savedNavs)
    } catch (caught) {
      setError(toErrorMessage(caught, '保存菜单顺序失败，请稍后重试。'))
      onNavsChange?.(await loadNavs())
    }
  }

  const handleRootDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || active.id === over.id) return
    const oldIndex = navs.findIndex((nav) => `root-${nav.id}` === active.id)
    const newIndex = navs.findIndex((nav) => `root-${nav.id}` === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    void reorder(arrayMove(navs, oldIndex, newIndex))
  }

  const handleChildDragEnd = (group: AppNav) => (event: DragEndEvent) => {
    const children = group.children ?? []
    const {active, over} = event
    if (!over || active.id === over.id) return
    const oldIndex = children.findIndex((nav) => `child-${nav.id}` === active.id)
    const newIndex = children.findIndex((nav) => `child-${nav.id}` === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const nextChildren = arrayMove(children, oldIndex, newIndex)
    const nextNavs = navs.map((nav) => nav.id === group.id
      ? {...nav, children: nextChildren}
      : nav)
    void reorder(nextNavs)
  }

  const canSave = Boolean(form?.name.trim())
    && (form?.type !== 'ENTRY' || (() => {
      if (!form?.destinationValue) return false
      const destination = parseDestinationValue(form.destinationValue)
      if (!destination) return false
      return destination.type === 'LINK' ? isValidHttpUrl(destination.id) : Boolean(destination.id)
    })())

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h5 className="m-0 text-sm font-semibold text-foreground">菜单结构</h5>
          <p className="m-0 text-xs text-muted-foreground">支持分组、子菜单、拖拽排序和页面绑定</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => startCreate('ENTRY')}>
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
      ) : navs.length === 0 ? (
        <Empty
          className="rounded-lg border border-dashed bg-background"
          description="当前应用还没有菜单，请先创建菜单或分组。"
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRootDragEnd}>
          <SortableContext
            items={navs.map((nav) => `root-${nav.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {navs.map((nav) => (
                <div key={nav.id} className="space-y-2">
                  <MenuRow
                    nav={nav}
                    scope="root"
                    destinationLabel={nav.destination ? destinationLabelOf(destinationValue(nav.destination)) : undefined}
                    onAuthorize={() => setAuthorization(nav)}
                    onEdit={() => startEdit(nav)}
                    onDelete={() => setPendingDelete(nav)}
                  />
                  {nav.type === 'GROUP' && (nav.children ?? []).length > 0 && (
                    <div className="ml-5 space-y-2 rounded-lg border-l bg-muted/40 p-2">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleChildDragEnd(nav)}
                      >
                        <SortableContext
                          items={(nav.children ?? []).map((child) => `child-${child.id}`)}
                          strategy={verticalListSortingStrategy}
                        >
                          {(nav.children ?? []).map((child) => (
                            <MenuRow
                              key={child.id}
                              nav={child}
                              scope="child"
                              destinationLabel={child.destination ? destinationLabelOf(destinationValue(child.destination)) : undefined}
                              onAuthorize={() => setAuthorization(child)}
                              onEdit={() => startEdit(child)}
                              onDelete={() => setPendingDelete(child)}
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
                  type: type as AppNavType,
                  parentId: type === 'GROUP' ? 'root' : form.parentId,
                  destinationValue: type === 'GROUP' ? '' : form.destinationValue,
                })}
              >
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRY">菜单</SelectItem>
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
            {form.type === 'ENTRY' && (
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
            {form.type === 'ENTRY' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">关联项</label>
                <Select
                  value={form.destinationValue || undefined}
                  onValueChange={(value) => setForm({...form, destinationValue: value})}
                >
                  <SelectTrigger><SelectValue placeholder="选择后才能绑定页面"/></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>内置模块</SelectLabel>
                      {destinations.builtIn.map((destination) => (
                        <SelectItem key={destination.id} value={`${destination.type}:${destination.id}`}>
                          {destination.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>表单</SelectLabel>
                      {destinations.forms.map((destination) => (
                        <SelectItem key={destination.id} value={`${destination.type}:${destination.id}`}>
                          {destination.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>自定义链接</SelectLabel>
                      <SelectItem value={`LINK:${linkUrl}`}>自定义链接</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {form.destinationValue.startsWith('LINK:') ? (
                  <div className="mt-3">
                    <label className="mb-1 block text-sm font-medium text-foreground">链接地址</label>
                    <Input
                      value={linkUrl}
                      placeholder="https://example.com"
                      onChange={(event) => setForm({...form, destinationValue: `LINK:${event.target.value}`})}
                    />
                    {!isValidHttpUrl(linkUrl) ? (
                      <p className="mt-1 text-xs text-destructive">请输入有效的 http 或 https 链接。</p>
                    ) : null}
                  </div>
                ) : null}
                {form.destinationValue ? (
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
                onChange={(iconName) => setForm({...form, iconName})}
              />
            </div>
            {formError ? <div className="text-sm text-destructive" role="alert">{formError}</div> : null}
          </div>
        ) : null}
      </BizDialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="删除菜单"
        message={<>
          确认删除「{pendingDelete?.name}」吗？
          {pendingDelete?.type === 'GROUP' ? '分组内的菜单将同时删除。' : ''}
        </>}
        busy={isDeleting}
        confirmText="删除"
        onConfirm={confirmDelete}
      />

      <MenuAuthorizationDialog
        appId={appId}
        nav={authorization}
        open={authorization !== null}
        onOpenChange={(open) => !open && setAuthorization(null)}
        onSaved={refreshNavs}
      />
    </div>
  )
}

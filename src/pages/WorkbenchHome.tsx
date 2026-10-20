import * as React from 'react'
import {Maximize, Minimize, Pencil, Plus, RefreshCw, Trash2} from 'lucide-react'
import {useNavigate, useParams} from 'react-router-dom'
import {AppLayout} from '@/components/layout/AppLayout'
import {AppLoading} from '@/components/biz/AppLoading'
import {Button} from '@/components/ui/button'
import {BizDialog} from '@/components/ui/dialog'
import {Empty} from '@/components/ui/empty'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {GridStack, type GridStackNode} from 'gridstack'
import 'gridstack/dist/gridstack.min.css'
import {ComponentCanvas} from '@/components/biz/ComponentCanvas'
import {ComponentDesigner, type ComponentDesignerResult} from '@/components/biz/ComponentDesigner'
import {getAppForms, type AppForm} from '@/services/appForms'
import {getAppMenus, type AppMenu} from '@/services/appMenus'
import {
  createWorkbench,
  deleteWorkbench,
  getWorkbench,
  getWorkbenches,
  patchWorkbench,
  WORKBENCH_GRID_COLUMNS,
  WORKBENCH_MAX_GRID_HEIGHT,
  type Workbench,
  type WorkbenchComponent,
  type WorkbenchLayout,
  type WorkbenchLayoutItem,
  type WorkbenchSummary,
} from '@/services/workbenches'
import {cn} from '@/lib/utils'

function flattenMenus(menus: AppMenu[]): AppMenu[] {
  return menus.flatMap((menu) => [menu, ...flattenMenus(menu.children ?? [])])
}

function componentId() {
  return `component_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function setGridItemAttributes(element: HTMLDivElement | null, item: WorkbenchLayoutItem) {
  if (!element) return
  element.setAttribute('gs-id', item.componentId)
  element.setAttribute('gs-x', String(item.x))
  element.setAttribute('gs-y', String(item.y))
  element.setAttribute('gs-w', String(item.w))
  element.setAttribute('gs-h', String(item.h))
}

function ComponentCard({
                         component,
                         item,
                         refreshKey,
                         editable,
                         filter,
                         columns,
                         shortcutTargets,
                         onOpenMenu,
                         onEdit,
                         onDelete,
                         onRefresh,
                       }: {
  component: WorkbenchComponent
  item: WorkbenchLayoutItem
  refreshKey: number
  editable: boolean
  filter: string
  columns: Array<{ name: string; label: string }>
  shortcutTargets: Array<{ id: string; label: string; to: string }>
  onOpenMenu: (to: string) => void
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
}) {
  return (
    <div
      ref={(element) => setGridItemAttributes(element, item)}
      className="grid-stack-item"
    >
      <div className="grid-stack-item-content h-full min-h-0">
        <div className="app-card group flex h-full min-h-0 flex-col rounded-xl p-5 text-card-foreground">
          <div className="flex items-center justify-between">
            <h6 className={cn('m-0 text-sm font-semibold', editable && 'cursor-grab active:cursor-grabbing')}>
              {component.title}
            </h6>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {editable ? (
                <>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="编辑组件" onClick={onEdit}>
                    <Pencil className="h-4 w-4"/>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="删除组件" onClick={onDelete}>
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                </>
              ) : null}
              <Button variant="ghost" size="icon" className="h-7 w-7" title="刷新" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4"/>
              </Button>
            </div>
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-auto">
            <ComponentCanvas
              component={component}
              refreshKey={refreshKey}
              filter={filter}
              columns={columns}
              shortcutTargets={shortcutTargets}
              onOpenMenu={onOpenMenu}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WorkbenchHome() {
  const navigate = useNavigate()
  const {appId: routeAppId} = useParams<{ appId: string }>()
  const appId = routeAppId ?? ''
  const [workbenches, setWorkbenches] = React.useState<WorkbenchSummary[]>([])
  const [selectedWorkbenchId, setSelectedWorkbenchId] = React.useState<string | undefined>()
  const [workbench, setWorkbench] = React.useState<Workbench | null>(null)
  const [forms, setForms] = React.useState<AppForm[]>([])
  const [menus, setMenus] = React.useState<AppMenu[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [editable, setEditable] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [fullscreen, setFullscreen] = React.useState(Boolean(document.fullscreenElement))
  const [filter, setFilter] = React.useState('全部')
  const [designerOpen, setDesignerOpen] = React.useState(false)
  const [designerMode, setDesignerMode] = React.useState<'create' | 'edit'>('create')
  const [designerComponent, setDesignerComponent] = React.useState<WorkbenchComponent | null>(null)
  const [designerItem, setDesignerItem] = React.useState<WorkbenchLayoutItem | null>(null)
  const gridRef = React.useRef<HTMLDivElement | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [newWorkbenchName, setNewWorkbenchName] = React.useState('')
  const [editOpen, setEditOpen] = React.useState(false)
  const [editName, setEditName] = React.useState('')
  const [editDescription, setEditDescription] = React.useState('')

  React.useEffect(() => {
    if (!appId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    Promise.all([getWorkbenches(appId), getAppForms(appId), getAppMenus(appId)])
      .then(([loadedWorkbenches, loadedForms, loadedMenus]) => {
        if (cancelled) return
        setWorkbenches(loadedWorkbenches)
        setForms(loadedForms)
        setMenus(loadedMenus)
        setSelectedWorkbenchId((current) => current ?? loadedWorkbenches[0]?.id)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : '加载工作台失败，请稍后重试。')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId])

  React.useEffect(() => {
    if (!appId || !selectedWorkbenchId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getWorkbench(appId, selectedWorkbenchId)
      .then((loadedWorkbench) => !cancelled && setWorkbench(loadedWorkbench))
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : '加载工作台布局失败。')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, selectedWorkbenchId])

  React.useEffect(() => {
    const handleFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  React.useEffect(() => {
    const gridElement = gridRef.current
    if (!gridElement || !workbench || workbench.layout.items.length === 0) return
    const grid = GridStack.init({
      column: WORKBENCH_GRID_COLUMNS,
      maxRow: WORKBENCH_MAX_GRID_HEIGHT,
      cellHeight: 80,
      margin: 16,
      float: false,
      staticGrid: !editable,
      disableDrag: !editable,
      disableResize: !editable,
    }, gridElement)
    if (!grid) return
    const commitLayoutChange = (_event: Event, changedItem: GridStackNode) => {
      if (!changedItem.id) return
      const items = workbench.layout.items.map((item) =>
        item.componentId === changedItem.id
          ? {
            ...item,
            x: changedItem.x ?? item.x,
            y: changedItem.y ?? item.y,
            w: changedItem.w ?? item.w,
            h: changedItem.h ?? item.h,
          }
          : item,
      )
      void saveLayout({components: workbench.layout.components, items})
    }
    grid.on('dragstop', commitLayoutChange)
    grid.on('resizestop', commitLayoutChange)
    return () => {
      grid.off('dragstop')
      grid.off('resizestop')
      grid.destroy(false)
    }
  }, [editable, workbench])

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.()
      return
    }
    await document.documentElement.requestFullscreen?.()
  }

  const saveLayout = async (nextLayout: WorkbenchLayout) => {
    if (!workbench) return
    setIsSaving(true)
    setActionError(null)
    try {
      const updated = await patchWorkbench(appId, workbench.id, {layout: nextLayout})
      setWorkbench(updated)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : '保存工作台布局失败。')
    } finally {
      setIsSaving(false)
    }
  }

  const openCreateDesigner = () => {
    setDesignerMode('create')
    setDesignerComponent(null)
    setDesignerItem(null)
    setDesignerOpen(true)
  }

  const openEditDesigner = (component: WorkbenchComponent, item: WorkbenchLayoutItem) => {
    setDesignerMode('edit')
    setDesignerComponent(component)
    setDesignerItem(item)
    setDesignerOpen(true)
  }

  const handleDesignerSave = (result: ComponentDesignerResult) => {
    if (!workbench) return
    if (designerMode === 'create') {
      const component: WorkbenchComponent = {
        id: componentId(),
        title: result.title,
        type: result.type,
        config: result.config,
      }
      const bottomY = workbench.layout.items.reduce((max, item) => Math.max(max, item.y + item.h), 0)
      const item: WorkbenchLayoutItem = {
        componentId: component.id,
        x: 0,
        y: bottomY,
        w: result.w,
        h: result.h,
      }
      void saveLayout({
        components: [...workbench.layout.components, component],
        items: [...workbench.layout.items, item],
      })
    } else if (designerComponent && designerItem) {
      const components = workbench.layout.components.map((component) =>
        component.id === designerComponent.id
          ? {...component, title: result.title, type: result.type, config: result.config}
          : component,
      )
      const items = workbench.layout.items.map((item) =>
        item.componentId === designerComponent.id
          ? {...designerItem, w: result.w, h: result.h}
          : item,
      )
      void saveLayout({components, items})
    }
    setDesignerOpen(false)
    setDesignerComponent(null)
    setDesignerItem(null)
  }

  const deleteComponent = (componentIdToDelete: string) => {
    if (!workbench) return
    void saveLayout({
      components: workbench.layout.components.filter((component) => component.id !== componentIdToDelete),
      items: workbench.layout.items.filter((item) => item.componentId !== componentIdToDelete),
    })
  }

  const createNewWorkbench = async () => {
    const name = newWorkbenchName.trim()
    if (!name) return
    setIsSaving(true)
    setActionError(null)
    try {
      const created = await createWorkbench(appId, {name, layout: {components: [], items: []}})
      setWorkbenches((previous) => [...previous, {
        id: created.id,
        name: created.name,
        description: created.description,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      }])
      setSelectedWorkbenchId(created.id)
      setCreateOpen(false)
      setNewWorkbenchName('')
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : '新建工作台失败。')
    } finally {
      setIsSaving(false)
    }
  }

  const openEditInfo = () => {
    if (!workbench) return
    setEditName(workbench.name)
    setEditDescription(workbench.description ?? '')
    setEditOpen(true)
  }

  const saveWorkbenchInfo = async () => {
    if (!workbench) return
    const name = editName.trim()
    if (!name) return
    setIsSaving(true)
    setActionError(null)
    try {
      const updated = await patchWorkbench(appId, workbench.id, {
        name,
        description: editDescription.trim() || null,
      })
      setWorkbench(updated)
      setWorkbenches((previous) => previous.map((item) => item.id === updated.id ? {
        ...item,
        name: updated.name,
        description: updated.description,
        updatedAt: updated.updatedAt,
      } : item))
      setEditOpen(false)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : '保存工作台信息失败。')
    } finally {
      setIsSaving(false)
    }
  }

  const deleteCurrentWorkbench = async () => {
    if (!workbench) return
    setIsSaving(true)
    setActionError(null)
    try {
      await deleteWorkbench(appId, workbench.id)
      const remainingWorkbenches = workbenches.filter((item) => item.id !== workbench.id)
      setWorkbenches(remainingWorkbenches)
      setSelectedWorkbenchId(remainingWorkbenches[0]?.id)
      setWorkbench(null)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : '删除工作台失败。')
    } finally {
      setIsSaving(false)
    }
  }

  const componentsById = new Map(workbench?.layout.components.map((component) => [
    component.id,
    component,
  ]) ?? [])
  const formMenus = flattenMenus(menus).filter(
    (menu) => menu.type === 'ITEM' && menu.target?.type === 'FORM',
  )
  const shortcutTargets = formMenus.map((menu) => ({
    id: menu.id,
    label: menu.name,
    to: menu.pageRoute ?? `/apps/${appId}/${menu.id}`,
  }))
  const currentWorkbenchName = workbenches.find((item) => item.id === selectedWorkbenchId)?.name
    ?? workbench?.name

  return (
    <AppLayout noPadding noOuterScroll contentClassName="flex h-full min-h-0 flex-col" hideHeader={fullscreen}>
      <div className="flex h-full min-h-0 flex-col px-4 pb-4 md:px-6 md:pb-6">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 text-xl font-medium">
                  {currentWorkbenchName ?? '工作台'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {workbenches.map((item) => (
                  <DropdownMenuItem key={item.id} onClick={() => setSelectedWorkbenchId(item.id)}>
                    <span className={cn(item.id === selectedWorkbenchId && 'font-medium')}>{item.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)} disabled={isSaving}>
              <Plus className="h-4 w-4"/>
              新建工作台
            </Button>
            <Button variant="outline" size="sm" onClick={openEditInfo} disabled={!workbench || isSaving}>
              编辑信息
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deleteCurrentWorkbench}
              disabled={!workbench || workbenches.length <= 1 || isSaving}
            >
              删除工作台
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button size="sm" onClick={openCreateDesigner} disabled={!workbench || isSaving}>
              <Plus className="h-4 w-4"/>
              添加组件
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">{filter}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {['全部', '本人', '本部门', '本部门及子部门', '本月', '上月', '本年', '去年'].map((item) => (
                  <DropdownMenuItem key={item} onClick={() => setFilter(item)}>
                    <span className={cn(filter === item && 'font-medium')}>{item}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" title={fullscreen ? '退出全屏' : '全屏'} onClick={toggleFullscreen}>
              {fullscreen ? <Minimize className="h-4 w-4"/> : <Maximize className="h-4 w-4"/>}
            </Button>

            <Button variant="outline" size="sm" onClick={() => setEditable((value) => !value)}>
              {editable ? '锁定配置' : '编辑配置'}
            </Button>

            <Button variant="ghost" size="icon" title="刷新数据" onClick={() => setRefreshKey((key) => key + 1)}>
              <RefreshCw className="h-4 w-4"/>
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {actionError ? (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {actionError}
          </div>
        ) : null}

        <div className="mt-4 min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <AppLoading className="min-h-[320px]"/>
          ) : workbench && workbench.layout.items.length > 0 ? (
            <div ref={gridRef} className="grid-stack">
              {workbench.layout.items.map((item) => {
                const component = componentsById.get(item.componentId)
                if (!component) return null
                const selectedForm = forms.find((form) => form.name === component.config?.formName)
                return (
                  <ComponentCard
                    key={`${workbench.id}-${component.id}`}
                    component={component}
                    item={item}
                    refreshKey={refreshKey}
                    editable={editable}
                    filter={filter}
                    columns={(selectedForm?.fields ?? []).map((field) => ({
                      name: field.name,
                      label: field.label,
                    }))}
                    shortcutTargets={shortcutTargets}
                    onOpenMenu={navigate}
                    onEdit={() => openEditDesigner(component, item)}
                    onDelete={() => deleteComponent(component.id)}
                    onRefresh={() => setRefreshKey((key) => key + 1)}
                  />
                )
              })}
            </div>
          ) : (
            <Empty description="当前工作台暂无组件">
              <Button size="sm" onClick={openCreateDesigner} disabled={!workbench || isSaving}>
                <Plus className="h-4 w-4"/>
                添加组件
              </Button>
            </Empty>
          )}
        </div>

        <ComponentDesigner
          appId={appId}
          open={designerOpen}
          mode={designerMode}
          component={designerComponent ?? undefined}
          item={designerItem ?? undefined}
          onSave={handleDesignerSave}
          onClose={() => {
            setDesignerOpen(false)
            setDesignerComponent(null)
            setDesignerItem(null)
          }}
        />

        <BizDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          title="新建工作台"
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} disabled={isSaving}>
                取消
              </Button>
              <Button size="sm" onClick={createNewWorkbench} disabled={isSaving || !newWorkbenchName.trim()}>
                {isSaving ? '创建中...' : '创建'}
              </Button>
            </>
          }
        >
          <Input
            value={newWorkbenchName}
            placeholder="请输入工作台名称"
            onChange={(event) => setNewWorkbenchName(event.target.value)}
          />
        </BizDialog>

        <BizDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          title="编辑工作台信息"
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(false)} disabled={isSaving}>
                取消
              </Button>
              <Button size="sm" onClick={saveWorkbenchInfo} disabled={isSaving || !editName.trim()}>
                {isSaving ? '保存中...' : '保存'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">名称</label>
              <Input value={editName} onChange={(event) => setEditName(event.target.value)}/>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">描述</label>
              <Textarea
                value={editDescription}
                placeholder="请输入工作台描述"
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </div>
          </div>
        </BizDialog>
      </div>
    </AppLayout>
  )
}

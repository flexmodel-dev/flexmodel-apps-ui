import * as React from 'react'
import {Maximize, Minimize, MoreVertical, Pencil, Plus, RefreshCw, Trash2, type LucideIcon} from 'lucide-react'
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
import {GridStack, type GridItemHTMLElement} from 'gridstack'
import 'gridstack/dist/gridstack.min.css'
import {ComponentCanvas} from '@/components/biz/ComponentCanvas'
import {ComponentDesigner, type SavedComponentDesignerResult} from '@/components/biz/ComponentDesigner'
import {getAppForms, type AppForm} from '@/services/appForms'
import {getAppMenus, type AppMenu} from '@/services/appMenus'
import {menuIcon} from '@/services/appMenuNavigation'
import {
  createWorkbench,
  deleteWorkbench,
  getWorkbench,
  getWorkbenches,
  patchWorkbench,
  WORKBENCH_GRID_COLUMNS,
  WORKBENCH_MAX_GRID_HEIGHT,
  WORKBENCH_SCHEMA_VERSION,
  type Workbench,
  type WorkbenchComponent,
  type WorkbenchLayout,
  type WorkbenchSummary,
} from '@/services/workbenches'
import {cn} from '@/lib/utils'

function flattenMenus(menus: AppMenu[]): AppMenu[] {
  return menus.flatMap((menu) => [menu, ...flattenMenus(menu.children ?? [])])
}

function componentId() {
  return `component_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function setGridItemAttributes(element: HTMLDivElement | null, component: WorkbenchComponent) {
  if (!element) return
  element.setAttribute('gs-id', component.id)
  element.setAttribute('gs-x', String(component.placement.x))
  element.setAttribute('gs-y', String(component.placement.y))
  element.setAttribute('gs-w', String(component.placement.w))
  element.setAttribute('gs-h', String(component.placement.h))
}

function ComponentCard({
                         component,
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
  refreshKey: number
  editable: boolean
  filter: string
  columns: Array<{ name: string; label: string }>
  shortcutTargets: Array<{ id: string; label: string; to: string; icon?: LucideIcon }>
  onOpenMenu: (to: string) => void
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
}) {
  return (
    <div
      ref={(element) => setGridItemAttributes(element, component)}
      className="grid-stack-item"
    >
      <div className="grid-stack-item-content min-h-0">
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
  const [draftLayout, setDraftLayout] = React.useState<WorkbenchLayout | null>(null)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [fullscreen, setFullscreen] = React.useState(Boolean(document.fullscreenElement))
  const [filter, setFilter] = React.useState('全部')
  const [designerOpen, setDesignerOpen] = React.useState(false)
  const [designerMode, setDesignerMode] = React.useState<'create' | 'edit'>('create')
  const [designerComponent, setDesignerComponent] = React.useState<WorkbenchComponent | null>(null)
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
    setEditable(false)
    setDraftLayout(null)
  }, [selectedWorkbenchId])

  React.useEffect(() => {
    const gridElement = gridRef.current
    if (!gridElement || !workbench || (editable && !draftLayout)) return
    const layout = editable && draftLayout ? draftLayout : workbench.layout
    if (layout.components.length === 0) return
    const grid = GridStack.init({
      column: WORKBENCH_GRID_COLUMNS,
      maxRow: WORKBENCH_MAX_GRID_HEIGHT,
      cellHeight: 80,
      margin: '0 16px 16px 0',
      float: false,
      staticGrid: !editable,
      disableDrag: !editable,
      disableResize: !editable,
    }, gridElement)
    if (!grid) return
    layout.components.forEach((component) => {
      const element = gridElement.querySelector<HTMLElement>(`[gs-id="${component.id}"]`)
      if (!element) return
      grid.update(element, {
        x: component.placement.x,
        y: component.placement.y,
        w: component.placement.w,
        h: component.placement.h,
      })
    })
    const commitLayoutChange = (_event: Event, changedElement: GridItemHTMLElement) => {
      const changedItem = changedElement.gridstackNode
      if (!changedItem?.id) return
      setDraftLayout(() => {
        const components = layout.components.map((component) =>
          component.id === changedItem.id
          ? {
              ...component,
              placement: {
                x: changedItem.x ?? component.placement.x,
                y: changedItem.y ?? component.placement.y,
                w: changedItem.w ?? component.placement.w,
                h: changedItem.h ?? component.placement.h,
              },
          }
            : component,
        )
        return {schemaVersion: layout.schemaVersion, components}
      })
    }
    grid.on('dragstop', commitLayoutChange)
    grid.on('resizestop', commitLayoutChange)
    return () => {
      grid.off('dragstop')
      grid.off('resizestop')
      grid.destroy(false)
    }
  }, [editable, workbench, draftLayout])

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
      return true
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : '保存工作台布局失败。')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const enterEditMode = () => {
    if (!workbench) return
    setDraftLayout(workbench.layout)
    setEditable(true)
  }

  const saveConfiguration = async () => {
    if (!workbench) return
    const nextLayout = draftLayout ?? workbench.layout
    const saved = await saveLayout(nextLayout)
    if (saved) {
      setEditable(false)
      setDraftLayout(null)
    }
  }

  const openCreateDesigner = () => {
    if (!editable && workbench) {
      setDraftLayout(workbench.layout)
      setEditable(true)
    }
    setDesignerMode('create')
    setDesignerComponent(null)
    setDesignerOpen(true)
  }

  const openEditDesigner = (component: WorkbenchComponent) => {
    setDesignerMode('edit')
    setDesignerComponent(component)
    setDesignerOpen(true)
  }

  const handleDesignerSave = (result: SavedComponentDesignerResult) => {
    if (!workbench) return
    const layout = draftLayout ?? workbench.layout
    if (designerMode === 'create') {
      const component: WorkbenchComponent = {
        id: componentId(),
        title: result.title,
        placement: {
          x: 0,
          y: layout.components.reduce(
            (max, item) => Math.max(max, item.placement.y + item.placement.h),
            0,
          ),
          w: result.w,
          h: result.h,
        },
        config: result.config,
      }
      setDraftLayout({
        schemaVersion: layout.schemaVersion,
        components: [...layout.components, component],
      })
    } else if (designerComponent) {
      const components = layout.components.map((component) =>
        component.id === designerComponent.id
          ? {
            ...component,
            title: result.title,
            placement: {
              ...designerComponent.placement,
              w: result.w,
              h: result.h,
            },
            config: result.config,
          }
          : component,
      )
      setDraftLayout({schemaVersion: layout.schemaVersion, components})
    }
    setDesignerOpen(false)
    setDesignerComponent(null)
  }

  const deleteComponent = (componentIdToDelete: string) => {
    if (!workbench) return
    const layout = draftLayout ?? workbench.layout
    setDraftLayout({
      schemaVersion: layout.schemaVersion,
      components: layout.components.filter((component) => component.id !== componentIdToDelete),
    })
  }

  const createNewWorkbench = async () => {
    const name = newWorkbenchName.trim()
    if (!name) return
    setIsSaving(true)
    setActionError(null)
    try {
      const created = await createWorkbench(appId, {
        name, layout: {
          schemaVersion: WORKBENCH_SCHEMA_VERSION,
          components: [],
        }
      })
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

  const displayLayout = editable && draftLayout ? draftLayout : workbench?.layout
  const formMenus = flattenMenus(menus).filter(
    (menu) => menu.type === 'ITEM' && menu.target?.type === 'FORM',
  )
  const shortcutTargets = formMenus.map((menu) => ({
    id: menu.id,
    label: menu.name,
    to: menu.pageRoute ?? `/apps/${appId}/${menu.id}`,
    icon: menuIcon(menu.iconName),
  }))
  const currentWorkbenchName = workbenches.find((item) => item.id === selectedWorkbenchId)?.name
    ?? workbench?.name

  return (
    <AppLayout noPadding noOuterScroll contentClassName="flex h-full min-h-0 flex-col" hideHeader={fullscreen}>
      <div className="flex h-full min-h-0 flex-col px-4 pb-4 md:px-6 md:pb-6">
        <div className="group/workbench-header flex shrink-0 flex-wrap items-center justify-between gap-3">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 transition-opacity group-hover/workbench-header:opacity-100"
              title="新建工作台"
              aria-label="新建工作台"
              onClick={() => setCreateOpen(true)}
              disabled={isSaving}
            >
              <Plus className="h-4 w-4"/>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 transition-opacity group-hover/workbench-header:opacity-100"
                  title="更多操作"
                  aria-label="更多操作"
                  disabled={!workbench || isSaving}
                >
                  <MoreVertical className="h-4 w-4"/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={openEditInfo} disabled={!workbench || isSaving}>
                  <Pencil className="h-4 w-4"/> 编辑工作台
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={deleteCurrentWorkbench}
                  disabled={!workbench || workbenches.length <= 1 || isSaving}
                >
                  <Trash2 className="h-4 w-4"/> 删除工作台
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-1">
            {editable ? (
              <Button size="sm" onClick={openCreateDesigner} disabled={!workbench || isSaving}>
                <Plus className="h-4 w-4"/>
                添加组件
              </Button>
            ) : null}

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

            <Button
              variant="outline"
              size="sm"
              onClick={editable ? saveConfiguration : enterEditMode}
              disabled={!workbench || isSaving}
            >
              {editable ? '保存配置' : '编辑组件'}
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
          ) : workbench && displayLayout && displayLayout.components.length > 0 ? (
            <div ref={gridRef} className="grid-stack">
              {displayLayout.components.map((component) => {
                const componentFormName = component.config.type === 'metric'
                || component.config.type === 'chart'
                || component.config.type === 'dataloader'
                  ? component.config.formName
                  : undefined
                const selectedForm = forms.find((form) => form.name === componentFormName)
                return (
                  <ComponentCard
                    key={`${workbench.id}-${component.id}`}
                    component={component}
                    refreshKey={refreshKey}
                    editable={editable}
                    filter={filter}
                    columns={(selectedForm?.fields ?? []).map((field) => ({
                      name: field.name,
                      label: field.label,
                    }))}
                    shortcutTargets={shortcutTargets}
                    onOpenMenu={navigate}
                    onEdit={() => openEditDesigner(component)}
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
          onSave={handleDesignerSave}
          onClose={() => {
            setDesignerOpen(false)
            setDesignerComponent(null)
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

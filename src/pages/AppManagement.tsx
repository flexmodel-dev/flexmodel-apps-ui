import * as React from 'react'
import {Link, useNavigate} from 'react-router-dom'
import {Download, MoreVertical, Pencil, Plus, Trash2, Upload} from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {Button} from '@/components/ui/button'
import {ConfirmDialog} from '@/components/ui/dialog'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppCreateDialog} from '@/components/biz/AppCreateDialog'
import {AppPackageExportDialog} from '@/components/biz/AppPackageExportDialog'
import {AppPackageImportDialog} from '@/components/biz/AppPackageImportDialog'
import {Empty} from '@/components/ui/empty'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,} from '@/components/ui/dropdown-menu'
import {appIcons} from '@/data/appIcons'
import {type App, deleteApp, getApps, invalidateAppCaches, reorderApps} from '@/services/apps'
import {getAppPrimaryColor} from '@/theme/appPrimaryColors'
import type {AppPackagePreview} from '@/services/appPackages'
import {listAppTemplates} from '@/services/appTemplates'
import {useAiAssistant} from '@/components/ai/AiProvider'
import {cn, toErrorMessage} from '@/lib/utils'

function SortableAppCard({
                           app,
                           dragEndedAtRef,
                           onEdit,
                           onExport,
                           onDelete,
                         }: {
  app: App
  dragEndedAtRef: React.MutableRefObject<number>
  onEdit: () => void
  onExport: () => void
  onDelete: () => void
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: app.id})
  const Icon = appIcons[app.iconName] ?? appIcons.Boxes
  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      data-primary={getAppPrimaryColor(app.primaryColor).value}
      className={cn(
        'group relative flex min-w-0 cursor-grab flex-col items-center active:cursor-grabbing',
        isDragging && 'z-10 opacity-80',
      )}
      {...attributes}
      {...listeners}
    >
      <Link
        to={`/apps/${app.id}`}
        onClick={(event) => {
          if (Date.now() - dragEndedAtRef.current < 200) {
            event.preventDefault()
          }
        }}
        className="flex w-full min-w-0 flex-col items-center gap-2 rounded-xl px-1 pb-2 pt-3 transition-colors hover:bg-accent/50"
      >
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition-transform duration-150 group-hover:scale-105">
          <Icon className="h-8 w-8"/>
        </span>
        <span className="w-full break-words text-center text-sm text-foreground">
          {app.name}
        </span>
      </Link>

      <div className="absolute right-0 top-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
              title="更多操作"
            >
              <MoreVertical className="h-3.5 w-3.5"/>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4"/> 编辑应用
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download className="h-4 w-4"/> 导出应用
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>
              <Trash2 className="h-4 w-4"/> 删除应用
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default function AppManagement() {
  const navigate = useNavigate()
  const ai = useAiAssistant()
  const [apps, setApps] = React.useState<App[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [listError, setListError] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<App | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [exportTarget, setExportTarget] = React.useState<App | null>(null)
  const [templatePreview, setTemplatePreview] = React.useState<AppPackagePreview | null>(null)
  const [templateName, setTemplateName] = React.useState('')
  const [templateCount, setTemplateCount] = React.useState<number | null>(null)
  const [reorderError, setReorderError] = React.useState<string | null>(null)
  const showTemplateEntry = templateCount !== 0
  // 拖动放下后浏览器仍会派发合成 click；dnd-kit 会在 document 捕获阶段截停传播，
  // React 事件收不到，须在原生层 preventDefault 阻止 <a> 默认导航
  const dragEndedAtRef = React.useRef(0)

  const suppressPostDragClick = React.useCallback(() => {
    const clear = () => {
      document.removeEventListener('click', suppress, true)
      window.clearTimeout(timer)
    }
    const suppress = (event: MouseEvent) => {
      clear()
      event.preventDefault()
    }
    const timer = window.setTimeout(clear, 200)
    document.addEventListener('click', suppress, true)
  }, [])

  // 桌面移动 8px 起拖；触屏长按 250ms 起拖，避免与页面滚动冲突
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 8}}),
    useSensor(TouchSensor, {activationConstraint: {delay: 250, tolerance: 8}}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    dragEndedAtRef.current = Date.now()
    suppressPostDragClick()
    const {active, over} = event
    if (!over || active.id === over.id) return
    const oldIndex = apps.findIndex((app) => app.id === active.id)
    const newIndex = apps.findIndex((app) => app.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const previous = apps
    const next = arrayMove(apps, oldIndex, newIndex)
    setApps(next)
    setReorderError(null)
    reorderApps(next.map((app) => app.id))
      .then((fromServer) => setApps(fromServer))
      .catch((error) => {
        setApps(previous)
        setReorderError(toErrorMessage(error, '保存应用排序失败，请稍后重试。'))
      })
  }

  const loadApps = React.useCallback(async () => {
    setIsLoading(true)
    setListError(null)
    try {
      setApps(await getApps())
    } catch (error) {
      setApps([])
      setListError(toErrorMessage(error, '加载应用失败，请稍后重试。'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadApps()
  }, [loadApps])

  React.useEffect(() => {
    // 目录为空时隐藏模板创建方式；请求失败保留入口，由创建弹窗展示错误与重试。
    listAppTemplates()
      .then(list => setTemplateCount(list.length))
      .catch(() => setTemplateCount(null))
  }, [])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteApp(deleteTarget.id)
      setDeleteTarget(null)
      await loadApps()
    } catch (error) {
      setDeleteError(toErrorMessage(error, '删除应用失败，请稍后重试。'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AdminLayout>
      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h4 className="m-0 text-base font-medium">应用管理</h4>
            <p className="mb-0 mt-0.5 text-xs text-muted-foreground">创建独立前台应用，并管理应用菜单与配置</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4"/> 导入应用
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4"/> 新建应用
            </Button>
          </div>
        </div>

        <div className="min-w-0 max-w-full p-4">
          {isLoading ? (
            <AppLoading center className="min-h-[240px]"/>
          ) : listError ? (
            <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
              {listError}
            </div>
          ) : apps.length === 0 ? (
            <Empty description="暂无应用"/>
          ) : (
            <>
              {reorderError && (
                <div className="mb-3 text-sm text-destructive" role="alert">{reorderError}</div>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}
                          onDragCancel={() => {
                            dragEndedAtRef.current = Date.now()
                            suppressPostDragClick()
                          }}>
                <SortableContext items={apps.map((app) => app.id)} strategy={rectSortingStrategy}>
                  <div
                    className="grid min-w-0 max-w-full grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-x-4 gap-y-6">
                    {apps.map((app) => (
                      <SortableAppCard
                        key={app.id}
                        app={app}
                        dragEndedAtRef={dragEndedAtRef}
                        onEdit={() => navigate(`/admin/apps/${app.id}/settings/basic`)}
                        onExport={() => setExportTarget(app)}
                        onDelete={() => setDeleteTarget(app)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>
      </div>

      <AppCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        templateEnabled={showTemplateEntry}
        onCreated={() => {
          void loadApps()
        }}
        onTemplateReady={(preview, name) => {
          setTemplatePreview(preview)
          setTemplateName(name)
          setImportOpen(true)
        }}
        onAiCreate={prompt => {
          setCreateOpen(false)
          ai.openAssistant({prompt})
        }}
      />

      <AppPackageExportDialog
        open={Boolean(exportTarget)}
        onOpenChange={open => {
          if (!open) setExportTarget(null)
        }}
        appId={exportTarget?.id ?? ''}
        appName={exportTarget?.name ?? ''}
      />

      <AppPackageImportDialog
        open={importOpen}
        onOpenChange={next => {
          setImportOpen(next)
          if (!next) {
            setTemplatePreview(null)
            setTemplateName('')
          }
        }}
        onImported={() => {
          invalidateAppCaches()
          void loadApps()
        }}
        initialPreview={templatePreview}
        initialName={templateName || null}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
        title="删除应用"
        message={<>
          确认删除应用「{deleteTarget?.name}」吗？将同时删除该应用菜单、审批流程及独占表单和记录。
          {deleteError ? (
            <div className="mt-2 text-sm text-destructive" role="alert">{deleteError}</div>
          ) : null}
        </>}
        busy={isDeleting}
        confirmText="删除"
        onConfirm={confirmDelete}
      />
    </AdminLayout>
  )
}

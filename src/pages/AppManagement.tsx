import * as React from 'react'
import {Link, useNavigate} from 'react-router-dom'
import {Download, MoreVertical, Pencil, Plus, Trash2, Upload} from 'lucide-react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {Button} from '@/components/ui/button'
import {ConfirmDialog} from '@/components/ui/dialog'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppCreateDialog} from '@/components/biz/AppCreateDialog'
import {AppPackageExportDialog} from '@/components/biz/AppPackageExportDialog'
import {AppPackageImportDialog} from '@/components/biz/AppPackageImportDialog'
import {Empty} from '@/components/ui/empty'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,} from '@/components/ui/dropdown-menu'
import {appIcons} from '@/data/appIcons'
import {type App, deleteApp, getApps, invalidateAppCaches} from '@/services/apps'
import {getAppPrimaryColor} from '@/theme/appPrimaryColors'
import type {AppPackagePreview} from '@/services/appPackages'
import {listAppTemplates} from '@/services/appTemplates'
import {useAiAssistant} from '@/components/ai/AiProvider'
import {cn, toErrorMessage} from '@/lib/utils'
import {useAppDataRevision} from '@/lib/useAppDataRevision'

function AppMetadataText({children}: { children: string }) {
  const textRef = React.useRef<HTMLSpanElement>(null)
  const [open, setOpen] = React.useState(false)

  return (
    <Tooltip open={open} onOpenChange={nextOpen => {
      const element = textRef.current
      setOpen(nextOpen && !!element && element.scrollWidth > element.clientWidth)
    }}>
      <TooltipTrigger asChild>
        <span ref={textRef} className="min-w-0 truncate">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="whitespace-normal break-words">{children}</TooltipContent>
    </Tooltip>
  )
}

export default function AppManagement() {
  const navigate = useNavigate()
  const ai = useAiAssistant()
  const appsRevision = useAppDataRevision(undefined, ['app'])
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
  const showTemplateEntry = templateCount !== 0

  const loadApps = React.useCallback(async (background = false) => {
    if (!background) setIsLoading(true)
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
    void loadApps(appsRevision > 0)
  }, [loadApps, appsRevision])

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
            <div className={cn(
              'grid min-w-0 max-w-full grid-cols-1 gap-4 sm:grid-cols-2',
              ai.panelOpen ? 'xl:grid-cols-3' : 'xl:grid-cols-4',
            )}>
              {apps.map((app) => {
                const Icon = appIcons[app.iconName] ?? appIcons.Boxes
                return (
                  <div
                    key={app.id}
                    data-primary={getAppPrimaryColor(app.primaryColor).value}
                    className="group relative min-w-0 overflow-hidden rounded-lg border bg-background transition-colors hover:border-primary/60 hover:bg-accent/40"
                  >
                    <Link to={`/apps/${app.id}`} className="block min-w-0 p-4">
                      <div className="flex items-start gap-3 pr-8">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-medium text-foreground">{app.name}</span>
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="mt-1 block truncate text-sm leading-5 text-muted-foreground">
                                  {app.description || '暂无描述'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="whitespace-pre-wrap break-words">
                                {app.description || '暂无描述'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </span>
                      </div>
                      <TooltipProvider delayDuration={200}>
                        <div
                          className="ml-14 mt-4 flex min-w-0 items-center gap-3 whitespace-nowrap text-xs text-muted-foreground">
                          <AppMetadataText>{`所有者：${app.owner}`}</AppMetadataText>
                          <span className="h-3 w-px shrink-0 bg-border"/>
                          <AppMetadataText>{`更新于 ${app.updatedAt}`}</AppMetadataText>
                        </div>
                      </TooltipProvider>
                    </Link>

                    <div className="absolute right-3 top-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
                            title="更多操作"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/admin/apps/${app.id}/settings/basic`)}>
                            <Pencil className="h-4 w-4" /> 编辑应用
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setExportTarget(app)}>
                            <Download className="h-4 w-4"/> 导出应用
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteTarget(app)}>
                            <Trash2 className="h-4 w-4" /> 删除应用
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
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

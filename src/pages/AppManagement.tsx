import * as React from 'react'
import {Link, useNavigate} from 'react-router-dom'
import {Download, MoreVertical, Pencil, Plus, Trash2, Upload} from 'lucide-react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {BizDialog, ConfirmDialog} from '@/components/ui/dialog'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppPackageExportDialog} from '@/components/biz/AppPackageExportDialog'
import {AppPackageImportDialog} from '@/components/biz/AppPackageImportDialog'
import {Empty} from '@/components/ui/empty'
import {AppPrimaryColorPicker} from '@/components/biz/AppPrimaryColorPicker'
import {IconPicker} from '@/components/biz/IconPicker'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,} from '@/components/ui/dropdown-menu'
import {type AppIconName, appIcons} from '@/data/appIcons'
import {type App, createApp, deleteApp, getApps, invalidateAppCaches, updateApp,} from '@/services/apps'
import {type AppPrimaryColor, getAppPrimaryColor} from '@/theme/appPrimaryColors'
import {toErrorMessage} from '@/lib/utils'

interface AppFormValues {
  name: string
  iconName: AppIconName
  primaryColor: AppPrimaryColor
  description: string
}

const emptyForm: AppFormValues = {name: '', iconName: 'Boxes', primaryColor: 'blue', description: ''}

function AppForm({
  value,
  onChange,
}: {
  value: AppFormValues
  onChange: (value: AppFormValues) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="app-name" className="mb-1 block text-sm font-medium text-foreground">应用名称</label>
        <Input
          id="app-name"
          value={value.name}
          placeholder="请输入应用名称"
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </div>
      <div>
        <label htmlFor="app-icon" className="mb-1 block text-sm font-medium text-foreground">应用图标</label>
        <div id="app-icon">
          <IconPicker
            value={value.iconName}
            onChange={(iconName) => onChange({...value, iconName})}
          />
        </div>
      </div>
      <div>
        <label htmlFor="app-description" className="mb-1 block text-sm font-medium text-foreground">应用描述</label>
        <Input
          id="app-description"
          value={value.description}
          placeholder="请输入应用描述"
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">应用主色</label>
        <AppPrimaryColorPicker
          value={value.primaryColor}
          onChange={(primaryColor) => onChange({...value, primaryColor})}
        />
      </div>
    </div>
  )
}

export default function AppManagement() {
  const navigate = useNavigate()
  const [apps, setApps] = React.useState<App[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [listError, setListError] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formValue, setFormValue] = React.useState<AppFormValues>(emptyForm)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<App | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [exportTarget, setExportTarget] = React.useState<App | null>(null)

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

  const openCreate = () => {
    setEditingId(null)
    setFormValue(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (app: App) => {
    setEditingId(app.id)
    setFormValue({name: app.name, iconName: app.iconName, primaryColor: app.primaryColor, description: app.description})
    setFormOpen(true)
  }

  const submitForm = async () => {
    if (!formValue.name.trim()) return
    const values = { ...formValue, name: formValue.name.trim() }
    setIsSubmitting(true)
    setFormError(null)
    try {
      if (editingId) await updateApp(editingId, values)
      else await createApp(values)
      setFormOpen(false)
      await loadApps()
    } catch (error) {
      setFormError(toErrorMessage(error, '保存应用失败，请稍后重试。'))
    } finally {
      setIsSubmitting(false)
    }
  }

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
            <Button onClick={openCreate}>
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
            <div className="grid min-w-0 max-w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {apps.map((app) => {
                const Icon = appIcons[app.iconName] ?? appIcons.Boxes
                return (
                  <div
                    key={app.id}
                    data-primary={getAppPrimaryColor(app.primaryColor).value}
                    className="relative min-w-0 overflow-hidden rounded-lg border bg-background transition-colors hover:border-primary/60 hover:bg-accent/40"
                  >
                    <Link to={`/apps/${app.id}`} className="block min-w-0 p-4 pr-12">
                      <div className="flex items-start gap-3">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-base font-medium text-foreground">{app.name}</span>
                          <span className="mt-1 line-clamp-2 block break-words text-sm leading-5 text-muted-foreground">
                            {app.description || '暂无描述'}
                          </span>
                        </span>
                      </div>
                      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>所有者：{app.owner}</span>
                        <span className="h-3 w-px bg-border" />
                        <span>更新于 {app.updatedAt}</span>
                      </div>
                    </Link>

                    <div className="absolute right-3 top-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-8 w-8" title="更多操作">
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

      <BizDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingId ? '编辑应用' : '新建应用'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>取消</Button>
            <Button onClick={submitForm} disabled={!formValue.name.trim() || isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </>
        }
      >
        <AppForm value={formValue} onChange={setFormValue} />
        {formError ? (
          <div className="text-sm text-destructive" role="alert">{formError}</div>
        ) : null}
      </BizDialog>

      <AppPackageExportDialog
        open={Boolean(exportTarget)}
        onOpenChange={open => {
          if (!open) setExportTarget(null)
        }}
        appId={exportTarget?.id ?? ''}
        appName={exportTarget?.name ?? ''}
      />

      <AppPackageImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => {
        invalidateAppCaches()
        void loadApps()
      }}/>

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

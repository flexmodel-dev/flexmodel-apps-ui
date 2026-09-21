import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RbDialog } from '@/components/ui/dialog'
import { RbNoData } from '@/components/rb/RbLoading'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  appIconOptions,
  appIcons,
  createApp,
  deleteApp,
  getAppById,
  getAppEntityCount,
  getApps,
  updateApp,
  type AppIconName,
  type AppMeta,
} from '@/data/mock'

interface AppFormValues {
  name: string
  iconName: AppIconName
  description: string
}

const emptyForm: AppFormValues = { name: '', iconName: 'Boxes', description: '' }

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
        <div id="app-icon" className="flex flex-wrap gap-2">
          {appIconOptions.map((iconName) => {
            const Icon = appIcons[iconName]
            const active = value.iconName === iconName
            return (
              <button
                key={iconName}
                type="button"
                onClick={() => onChange({ ...value, iconName })}
                className={
                  active
                    ? 'flex h-10 w-10 items-center justify-center rounded-md border border-primary bg-primary/10 text-primary'
                    : 'flex h-10 w-10 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent'
                }
                title={iconName}
              >
                <Icon className="h-5 w-5" />
              </button>
            )
          })}
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
    </div>
  )
}

export default function AppManagement() {
  const navigate = useNavigate()
  const [version, setVersion] = React.useState(0)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formValue, setFormValue] = React.useState<AppFormValues>(emptyForm)
  const [deleteTarget, setDeleteTarget] = React.useState<AppMeta | null>(null)
  const apps = React.useMemo(() => getApps(), [version])

  const openCreate = () => {
    setEditingId(null)
    setFormValue(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (app: AppMeta) => {
    setEditingId(app.id)
    setFormValue({ name: app.name, iconName: app.iconName, description: app.description })
    setFormOpen(true)
  }

  const submitForm = () => {
    if (!formValue.name.trim()) return
    const values = { ...formValue, name: formValue.name.trim() }
    if (editingId) updateApp(editingId, values)
    else createApp(values)
    setFormOpen(false)
    setVersion((value) => value + 1)
  }

  const confirmDelete = () => {
    if (deleteTarget) deleteApp(deleteTarget.id)
    setDeleteTarget(null)
    setVersion((value) => value + 1)
  }

  return (
    <AppLayout admin adminActive="/admin/apps">
      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h4 className="m-0 text-base font-medium">应用管理</h4>
            <p className="mb-0 mt-0.5 text-xs text-muted-foreground">创建独立前台应用，并管理应用菜单与配置</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> 新建应用
          </Button>
        </div>

        <div className="min-w-0 max-w-full p-4">
          {apps.length === 0 ? (
            <RbNoData text="暂无应用" />
          ) : (
            <div className="grid min-w-0 max-w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {apps.map((app) => {
                const Icon = appIcons[app.iconName] ?? appIcons.Boxes
                return (
                  <div
                    key={app.id}
                    className="relative min-w-0 overflow-hidden rounded-lg border bg-background transition-colors hover:border-primary/60 hover:bg-accent/40"
                  >
                    <Link to={`/app/${app.id}`} className="block min-w-0 p-4 pr-12">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
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
                        <span>实体 {getAppEntityCount(app.id)} 个</span>
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

      <RbDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingId ? '编辑应用' : '新建应用'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>取消</Button>
            <Button onClick={submitForm} disabled={!formValue.name.trim()}>
              保存
            </Button>
          </>
        }
      >
        <AppForm value={formValue} onChange={setFormValue} />
      </RbDialog>

      <RbDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除应用"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="danger" onClick={confirmDelete}>删除</Button>
          </>
        }
      >
        <div className="pt-1">
          确认删除应用「{deleteTarget?.name}」吗？将同时删除该应用菜单、审批流程、触发器及独占实体和记录。
        </div>
      </RbDialog>
    </AppLayout>
  )
}

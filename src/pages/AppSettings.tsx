import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {BizDialog} from '@/components/ui/dialog'
import {AdminApprovals, AdminBusinessObjects, AdminTriggers} from '@/pages/admin'
import {
  appIconOptions,
  appIcons,
  deleteApp,
  getAppById,
  updateApp,
  type AppIconName,
} from '@/data/mock'

const settingsNavs = [
  { key: 'basic', label: '基本设置' },
  {key: 'business-objects', label: '业务对象'},
  { key: 'approvals', label: '审批流程' },
  { key: 'triggers', label: '触发器' },
]

export default function AppSettings({ section }: { section: string }) {
  const navigate = useNavigate()
  const { appId } = useParams<{ appId: string }>()
  const app = getAppById(appId)
  const activeSection = settingsNavs.some((item) => item.key === section) ? section : 'basic'

  const [formOpen, setFormOpen] = React.useState(false)
  const [formValue, setFormValue] = React.useState(() => ({
    name: app?.name ?? '',
    iconName: (app?.iconName ?? 'Boxes') as AppIconName,
    description: app?.description ?? '',
  }))
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [version, setVersion] = React.useState(0)

  React.useEffect(() => {
    setFormValue({
      name: app?.name ?? '',
      iconName: app?.iconName ?? 'Boxes',
      description: app?.description ?? '',
    })
  }, [app?.name, app?.iconName, app?.description])

  if (!app) {
    return (
        <AdminLayout>
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          应用不存在或已被删除。
          <Link className="ml-1 text-primary hover:underline" to="/admin/apps">返回应用管理</Link>
        </div>
        </AdminLayout>
    )
  }

  const Icon = appIcons[app.iconName] ?? appIcons.Boxes
  const saveApp = () => {
    if (!formValue.name.trim()) return
    updateApp(app.id, {
      name: formValue.name.trim(),
      iconName: formValue.iconName,
      description: formValue.description,
    })
    setFormOpen(false)
    setVersion((value) => value + 1)
  }

  const removeApp = () => {
    deleteApp(app.id)
    setDeleteOpen(false)
    navigate('/admin/apps')
  }

  return (
      <AdminLayout noOuterScroll contentClassName="h-full">
      <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 rounded-xl border bg-card lg:w-56">
          <div className="border-b p-4">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              <span className="truncate font-medium">{app.name}</span>
            </div>
            <p className="mb-0 mt-1 text-xs text-muted-foreground">应用设置</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible">
            {settingsNavs.map((item) => (
              <Link
                key={item.key}
                to={`/admin/apps/${app.id}/settings/${item.key}`}
                className={
                  activeSection === item.key
                    ? 'block whitespace-nowrap rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary'
                    : 'block whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary'
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <h4 className="m-0 text-base font-medium">
              {settingsNavs.find((item) => item.key === activeSection)?.label}
            </h4>
            {activeSection === 'basic' && (
              <Button onClick={() => setFormOpen(true)}>
                <Pencil className="h-4 w-4" /> 编辑应用
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4" key={version}>
            {activeSection === 'basic' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border p-4">
                  <div className="text-xs text-muted-foreground">应用名称</div>
                  <div className="mt-1 text-sm font-medium">{app.name}</div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="text-xs text-muted-foreground">更新时间</div>
                  <div className="mt-1 text-sm font-medium">{app.updatedAt}</div>
                </div>
                <div className="rounded-md border p-4 md:col-span-2">
                  <div className="text-xs text-muted-foreground">应用描述</div>
                  <div className="mt-1 text-sm">{app.description || '暂无描述'}</div>
                </div>
                <div className="flex justify-end md:col-span-2">
                  <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4" /> 删除应用
                  </Button>
                </div>
              </div>
            )}

            {activeSection === 'business-objects' && <AdminBusinessObjects embedded/>}

            {activeSection === 'approvals' && <AdminApprovals embedded />}

            {activeSection === 'triggers' && <AdminTriggers embedded />}

          </div>
        </div>
      </div>

        <BizDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="编辑应用"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>取消</Button>
            <Button onClick={saveApp} disabled={!formValue.name.trim()}>保存</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="settings-app-name" className="mb-1 block text-sm font-medium text-foreground">应用名称</label>
            <Input id="settings-app-name" value={formValue.name} onChange={(event) => setFormValue((value) => ({ ...value, name: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="settings-app-icon" className="mb-1 block text-sm font-medium text-foreground">应用图标</label>
            <div id="settings-app-icon" className="flex flex-wrap gap-2">
              {appIconOptions.map((iconName: AppIconName) => {
                const OptionIcon = appIcons[iconName]
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setFormValue((value) => ({ ...value, iconName }))}
                    className={
                      formValue.iconName === iconName
                        ? 'flex h-10 w-10 items-center justify-center rounded-md border border-primary bg-primary/10 text-primary'
                        : 'flex h-10 w-10 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-accent'
                    }
                  >
                    <OptionIcon className="h-5 w-5" />
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label htmlFor="settings-app-description" className="mb-1 block text-sm font-medium text-foreground">应用描述</label>
            <Input id="settings-app-description" value={formValue.description} onChange={(event) => setFormValue((value) => ({ ...value, description: event.target.value }))} />
          </div>
        </div>
        </BizDialog>

        <BizDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除应用"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button variant="danger" onClick={removeApp}>删除</Button>
          </>
        }
      >
          <div className="pt-1">确认删除应用「{app.name}」吗？将同时删除该应用菜单、审批流程、触发器及独占业务对象和记录。
          </div>
        </BizDialog>
      </AdminLayout>
  )
}

import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {BizDialog, ConfirmDialog} from '@/components/ui/dialog'
import {AppPrimaryColorPicker} from '@/components/biz/AppPrimaryColorPicker'
import {IconPicker} from '@/components/biz/IconPicker'
import {AppLoading} from '@/components/biz/AppLoading'
import {Empty} from '@/components/ui/empty'
import {AppMenuManager} from '@/components/biz/AppMenuManager'
import {AdminApprovals, AdminForms, AdminTriggers} from '@/pages/admin'
import {
  appIconOptions,
  appIcons,
  appPrimaryColors,
  type AppIconName,
  type AppPrimaryColor,
} from '@/data/mock'
import {deleteApp, getAppById, updateApp, type App} from '@/services/apps'
import {toErrorMessage} from '@/lib/utils'
import {SettingsPageHeader} from '@/components/biz/SettingsPageHeader'

const settingsNavs = [
  { key: 'basic', label: '基本设置' },
  {key: 'menus', label: '菜单管理'},
  {key: 'forms', label: '表单管理'},
  { key: 'approvals', label: '审批流程' },
  { key: 'triggers', label: '触发器' },
]

const sectionDescriptions: Record<string, string> = {
  basic: '管理应用信息、图标与主题。',
  menus: '配置应用导航与页面入口。',
  forms: '管理业务表单、字段及布局。',
  approvals: '管理审批流程与流转规则。',
  triggers: '管理数据自动化处理规则。',
}

export default function AppSettings({ section }: { section: string }) {
  const navigate = useNavigate()
  const { appId } = useParams<{ appId: string }>()
  const [app, setApp] = React.useState<App | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const activeSection = settingsNavs.some((item) => item.key === section) ? section : 'basic'

  const [formOpen, setFormOpen] = React.useState(false)
  const [formValue, setFormValue] = React.useState(() => ({
    name: '',
    iconName: 'Boxes' as AppIconName,
    primaryColor: 'blue' as AppPrimaryColor,
    description: '',
  }))
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  React.useEffect(() => {
    if (!appId) {
      setApp(null)
      setIsLoading(false)
      setLoadError('缺少应用 ID。')
      return
    }

    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    getAppById(appId)
      .then((loadedApp) => {
        if (cancelled) return
        setApp(loadedApp)
        setFormValue({
          name: loadedApp.name,
          iconName: loadedApp.iconName,
          primaryColor: loadedApp.primaryColor,
          description: loadedApp.description,
        })
      })
      .catch((error) => {
        if (cancelled) return
        setApp(null)
        setLoadError(toErrorMessage(error, '加载应用失败，请稍后重试。'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appId])

  if (isLoading || !app) {
    return (
      <AdminLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
          <SettingsPageHeader title="应用设置" onBack={() => navigate('/admin/apps')} backLabel="返回应用管理"/>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? <AppLoading center className="min-h-[240px]"/> : <Empty description={loadError ?? '应用不存在或已被删除。'}/>}
          </div>
        </div>
      </AdminLayout>
    )
  }

  const Icon = appIcons[app.iconName] ?? appIcons.Boxes
  const saveApp = async () => {
    if (!formValue.name.trim()) return
    setIsSubmitting(true)
    setFormError(null)
    try {
      const updatedApp = await updateApp(app.id, {
        name: formValue.name.trim(),
        iconName: formValue.iconName,
        primaryColor: formValue.primaryColor,
        description: formValue.description,
      })
      setApp(updatedApp)
      setFormValue({
        name: updatedApp.name,
        iconName: updatedApp.iconName,
        primaryColor: updatedApp.primaryColor,
        description: updatedApp.description,
      })
      setFormOpen(false)
    } catch (error) {
      setFormError(toErrorMessage(error, '保存应用失败，请稍后重试。'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeApp = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteApp(app.id)
      setDeleteOpen(false)
      navigate('/admin/apps')
    } catch (error) {
      setDeleteError(toErrorMessage(error, '删除应用失败，请稍后重试。'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
      <AdminLayout noOuterScroll contentClassName="h-full">
      <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 overflow-hidden rounded-xl border bg-card lg:w-56">
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
                aria-current={activeSection === item.key ? 'page' : undefined}
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
          <SettingsPageHeader title={`${app.name} · ${settingsNavs.find(item => item.key === activeSection)?.label}`}
            description={sectionDescriptions[activeSection]} onBack={() => navigate('/admin/apps')} backLabel="返回应用管理"
            actions={activeSection === 'basic' && (
              <Button onClick={() => setFormOpen(true)}>
                <Pencil className="h-4 w-4" /> 编辑应用
              </Button>
            )}/>

          <div
            className={activeSection === 'approvals' ? 'min-h-0 flex-1 overflow-hidden p-4' : 'min-h-0 flex-1 overflow-y-auto p-4'}
            key={app.updatedAt}>
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
                <div className="rounded-md border p-4 md:col-span-2">
                  <div className="text-xs text-muted-foreground">应用主色</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full border"
                          style={{backgroundColor: appPrimaryColors.find((color) => color.value === app.primaryColor)?.swatch}}/>
                    <span
                      className="text-sm font-medium">{appPrimaryColors.find((color) => color.value === app.primaryColor)?.label}</span>
                  </div>
                </div>
                <div className="flex justify-end md:col-span-2">
                  <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4" /> 删除应用
                  </Button>
                </div>
              </div>
            )}

            {activeSection === 'forms' && <AdminForms embedded appId={app.id}/>}

            {activeSection === 'menus' && <AppMenuManager appId={app.id}/>}

            {activeSection === 'approvals' && <AdminApprovals embedded appId={app.id}/>}

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
            <Button onClick={saveApp} disabled={!formValue.name.trim() || isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
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
            <div id="settings-app-icon">
              <IconPicker
                value={formValue.iconName}
                options={appIconOptions}
                icons={appIcons}
                onChange={(iconName) => setFormValue((value) => ({...value, iconName}))}
              />
            </div>
          </div>
          <div>
            <label htmlFor="settings-app-description" className="mb-1 block text-sm font-medium text-foreground">应用描述</label>
            <Input id="settings-app-description" value={formValue.description} onChange={(event) => setFormValue((value) => ({ ...value, description: event.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">应用主色</label>
            <AppPrimaryColorPicker value={formValue.primaryColor}
                                   onChange={(primaryColor) => setFormValue((value) => ({...value, primaryColor}))}/>
          </div>
        </div>
          {formError ? (
            <div className="text-sm text-destructive" role="alert">{formError}</div>
          ) : null}
        </BizDialog>

        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            if (!open && !isDeleting) {
              setDeleteOpen(false)
              setDeleteError(null)
            }
          }}
          title="删除应用"
          message={<>
            确认删除应用「{app.name}」吗？将同时删除该应用菜单、审批流程、触发器及独占表单和记录。
            {deleteError ? (
              <div className="mt-2 text-sm text-destructive" role="alert">{deleteError}</div>
            ) : null}
          </>}
          busy={isDeleting}
          confirmText="删除"
          onConfirm={removeApp}
        />
      </AdminLayout>
  )
}

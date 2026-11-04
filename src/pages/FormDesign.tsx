import * as React from 'react'
import {useAppDataRevision} from '@/lib/useAppDataRevision'
import {useNavigate, useParams} from 'react-router-dom'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {FormDesigner} from '@/components/biz/FormDesigner'
import {getAppForm, type AppForm} from '@/services/appForms'
import {SettingsPageHeader} from '@/components/biz/SettingsPageHeader'
import {FormSettingsNav, formSettingsBackPath} from '@/components/biz/FormSettingsNav'
import {AppLoading} from '@/components/biz/AppLoading'
import {Empty} from '@/components/ui/empty'
import {toErrorMessage} from '@/lib/utils'

export default function FormDesign() {
  const {appId = '', formName = ''} = useParams<{ appId: string; formName: string }>()
  const navigate = useNavigate()
  const backPath = formSettingsBackPath(appId, formName)
  const backLabel = appId === 'system' ? '返回系统管理' : '返回表单列表'
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [loadedRevision, setLoadedRevision] = React.useState(0)
  const formRevision = useAppDataRevision(appId, ['form'], formName)

  React.useEffect(() => {
    setForm(null)
    setIsLoading(true)
    setEditing(false)
    setLoadedRevision(0)
  }, [appId, formName])

  React.useEffect(() => {
    if (editing) return
    if (!appId || !formName) {
      setForm(null)
      setIsLoading(false)
      return
    }
    let cancelled = false
    setError(null)
    getAppForm(appId, formName)
      .then((loadedForm) => {
        if (!cancelled) {
          setForm(loadedForm)
          setLoadedRevision(formRevision)
        }
      })
      .catch((caught) => {
        if (!cancelled) { setForm(null); setError(toErrorMessage(caught, '加载表单失败')) }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appId, formName, formRevision, editing])

  if (isLoading || !form) {
    return (
      <AdminLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
          <SettingsPageHeader title="表单设计" onBack={() => navigate(backPath)} backLabel={backLabel}>
            <FormSettingsNav appId={appId} formName={formName} mobile/>
          </SettingsPageHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? <AppLoading center className="min-h-[240px]"/> : <Empty description={error ?? '未找到表单'}/>}
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
      {editing && formRevision > loadedRevision && (
        <p role="status"
           className="mb-2 text-sm text-muted-foreground">应用有新的配置，当前草稿已保留，结束编辑后自动同步。</p>
      )}
      <FormDesigner
        appId={appId}
        initialForm={form}
        onBack={() => navigate(backPath)}
        backLabel={backLabel}
        onFormChange={setForm}
        onEditingChange={setEditing}
      />
    </AdminLayout>
  )
}

import * as React from 'react'
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

  React.useEffect(() => {
    if (!appId || !formName) {
      setForm(null)
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getAppForm(appId, formName)
      .then((loadedForm) => {
        if (!cancelled) setForm(loadedForm)
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
  }, [appId, formName])

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
      <FormDesigner
        appId={appId}
        initialForm={form}
        onBack={() => navigate(backPath)}
        backLabel={backLabel}
        onFormChange={setForm}
      />
    </AdminLayout>
  )
}

import * as React from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {FormDesigner} from '@/components/biz/FormDesigner'
import {getAppForm, type AppForm} from '@/services/appForms'

export default function FormDesign() {
  const {appId = '', formName = ''} = useParams<{ appId: string; formName: string }>()
  const navigate = useNavigate()
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (!appId || !formName) {
      setForm(null)
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    getAppForm(appId, formName)
      .then((loadedForm) => {
        if (!cancelled) setForm(loadedForm)
      })
      .catch(() => {
        if (!cancelled) setForm(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appId, formName])

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="min-h-[400px]"/>
      </AdminLayout>
    )
  }

  if (!form) {
    return (
      <AdminLayout>
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          未找到表单
        </div>
      </AdminLayout>
    )
  }

  const systemBackPath = formName === 'f_role'
    ? '/admin/role-privileges'
    : '/admin/users'

  return (
    <AdminLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
      <FormDesigner
        appId={appId}
        initialForm={form}
        onBack={() => navigate(appId === 'system'
          ? systemBackPath
          : `/admin/apps/${appId}/settings/forms`)}
        onFormChange={setForm}
      />
    </AdminLayout>
  )
}

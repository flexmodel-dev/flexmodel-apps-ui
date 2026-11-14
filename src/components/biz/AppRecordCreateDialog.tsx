import * as React from 'react'
import {AppRecordFormModal} from '@/components/biz/AppRecordFormModal'
import {getAppForm, type AppForm} from '@/services/appForms'
import {toErrorMessage} from '@/lib/utils'
import type {ApprovalFlow} from '@/types/workflow'

export function AppRecordCreateDialog({
                                        open,
                                        onOpenChange,
                                        appId,
                                        formName,
                                        launchFlow,
                                        onSaved,
                                      }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appId: string
  formName?: string | null
  launchFlow?: ApprovalFlow
  onSaved?: (id: string) => void
}) {
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || !appId || !formName) return
    let cancelled = false
    setError(null)
    getAppForm(appId, formName)
      .then((loadedForm) => {
        if (cancelled) return
        setForm(loadedForm)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setForm(null)
        setError(toErrorMessage(caught, '加载表单失败，请稍后重试。'))
      })
    return () => {
      cancelled = true
    }
  }, [open, appId, formName])

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setForm(null)
      setError(null)
    }
  }

  if (!open) return null

  return (
    <AppRecordFormModal
      open={open}
      onOpenChange={handleOpenChange}
      appId={appId}
      form={form}
      formError={error}
      launchFlow={launchFlow}
      onSaved={onSaved}
    />
  )
}

import * as React from 'react'
import {BizDialog} from '@/components/ui/dialog'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppRecordFormModal} from '@/components/biz/AppRecordFormModal'
import {getAppForm, type AppForm} from '@/services/appForms'
import {toErrorMessage} from '@/lib/utils'

export function AppRecordCreateDialog({
                                        open,
                                        onOpenChange,
                                        appId,
                                        formName,
                                        onSaved,
                                      }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appId: string
  formName?: string | null
  onSaved?: (id: string) => void
}) {
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || !appId || !formName) return
    let cancelled = false
    setIsLoading(true)
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
      .finally(() => {
        if (!cancelled) setIsLoading(false)
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
    <>
      {(isLoading || error) && (
        <BizDialog open={open} onOpenChange={handleOpenChange} title="新增记录">
          {isLoading ? (
            <AppLoading center className="min-h-[240px]"/>
          ) : (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
        </BizDialog>
      )}
      {!isLoading && !error && form && (
        <AppRecordFormModal
          open={open}
          onOpenChange={handleOpenChange}
          appId={appId}
          form={form}
          onSaved={onSaved}
        />
      )}
    </>
  )
}

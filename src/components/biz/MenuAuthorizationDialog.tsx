import * as React from 'react'
import {ShieldCheck} from 'lucide-react'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {DirectoryMemberPicker} from '@/components/biz/DirectoryMemberPicker'
import {cn, toErrorMessage} from '@/lib/utils'
import {type AppNav, updateAppNav} from '@/services/appNavigation'
import type {DirectorySelection} from '@/types/directory'

/** 菜单行授权入口：存在可见性规则时使用主题主色标记。 */
export function MenuAuthorizationButton({
                                          nav,
                                          disabled,
                                          onClick,
                                        }: {
  nav: AppNav
  disabled?: boolean
  onClick: () => void
}) {
  const ruleCount = (nav.visibility ?? []).length
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      title={ruleCount > 0 ? `授权（已设置 ${ruleCount} 项）` : '授权'}
      aria-label={'授权：' + nav.name}
      disabled={disabled}
      onClick={onClick}
    >
      <ShieldCheck className={cn('h-4 w-4', ruleCount > 0 && 'text-primary')}/>
    </Button>
  )
}

/** 菜单授权弹窗：通过 PATCH visibility 局部更新可见性规则。 */
export function MenuAuthorizationDialog({
                                          appId,
                                          nav,
                                          open,
                                          onOpenChange,
                                          onSaved,
                                        }: {
  appId: string
  nav: AppNav | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  const [visibility, setVisibility] = React.useState<DirectorySelection[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setVisibility(nav?.visibility ?? [])
    setError(null)
  }, [open, nav])

  const save = async () => {
    if (!nav || saving) return
    setSaving(true)
    setError(null)
    try {
      await updateAppNav(appId, nav.id, {visibility}, 'PATCH')
      onOpenChange(false)
      await onSaved()
    } catch (caught) {
      setError(toErrorMessage(caught, '保存菜单授权失败，请稍后重试。'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BizDialog
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
      title={'菜单授权 · ' + (nav?.name ?? '')}
      footer={<>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>取消</Button>
        <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存'}</Button>
      </>}
    >
      {error ? <p role="alert" className="mb-3 text-sm text-destructive">{error}</p> : null}
      {nav ? (
        <DirectoryMemberPicker
          appId={appId}
          value={visibility}
          onChange={setVisibility}
          disabled={saving}
          multiple
        />
      ) : null}
    </BizDialog>
  )
}

import * as React from 'react'
import {ShieldCheck} from 'lucide-react'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {DirectoryMemberPicker} from '@/components/rb/DirectoryMemberPicker'
import {cn, toErrorMessage} from '@/lib/utils'
import {updateAppMenu, type AppMenu} from '@/services/appMenus'
import type {DirectorySelection} from '@/types/directory'

/** 菜单行授权入口：存在成员时使用主题主色标记。 */
export function MenuAuthorizationButton({
                                          menu,
                                          disabled,
                                          onClick,
                                        }: {
  menu: AppMenu
  disabled?: boolean
  onClick: () => void
}) {
  const memberCount = (menu.members ?? []).length
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      title={memberCount > 0 ? `授权（已设置 ${memberCount} 项）` : '授权'}
      aria-label={'授权：' + menu.name}
      disabled={disabled}
      onClick={onClick}
    >
      <ShieldCheck className={cn('h-4 w-4', memberCount > 0 && 'text-primary')}/>
    </Button>
  )
}

/** 菜单授权弹窗：通过 PATCH members 局部更新授权成员。 */
export function MenuAuthorizationDialog({
                                          appId,
                                          menu,
                                          open,
                                          onOpenChange,
                                          onSaved,
                                        }: {
  appId: string
  menu: AppMenu | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  const [members, setMembers] = React.useState<DirectorySelection[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setMembers(menu?.members ?? [])
    setError(null)
  }, [open, menu])

  const save = async () => {
    if (!menu || saving) return
    setSaving(true)
    setError(null)
    try {
      await updateAppMenu(appId, menu.id, {members}, 'PATCH')
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
      title={'菜单授权 · ' + (menu?.name ?? '')}
      footer={<>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>取消</Button>
        <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存'}</Button>
      </>}
    >
      {error ? <p role="alert" className="mb-3 text-sm text-destructive">{error}</p> : null}
      {menu ? (
        <DirectoryMemberPicker
          appId={appId}
          value={members}
          onChange={setMembers}
          disabled={saving}
          multiple
        />
      ) : null}
    </BizDialog>
  )
}

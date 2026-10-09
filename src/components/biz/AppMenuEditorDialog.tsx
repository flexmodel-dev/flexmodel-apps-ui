import {BizDialog} from '@/components/ui/dialog'
import {AppMenuManager} from '@/components/biz/AppMenuManager'
import type {AppMenu} from '@/services/appMenus'

export function AppMenuEditorDialog({
                                      open,
                                      onOpenChange,
                                      appId,
                                      onMenusChange,
                                    }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appId: string
  onMenusChange: (menus: AppMenu[]) => void
}) {
  return (
    <BizDialog
      open={open}
      onOpenChange={onOpenChange}
      title="应用菜单"
      width={1080}
      height="82vh"
    >
      <AppMenuManager appId={appId} onMenusChange={onMenusChange}/>
    </BizDialog>
  )
}

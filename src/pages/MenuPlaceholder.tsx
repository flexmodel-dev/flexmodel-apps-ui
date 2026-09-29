import {useParams} from 'react-router-dom'
import {AppLayout} from '@/components/layout/AppLayout'
import {topNavs, type NavItem} from '@/data/mock'

function findMenuText(menuId: string | undefined) {
  if (!menuId) return '菜单页面'
  const topMenu = topNavs.find((menu) => menu.id === menuId)
  if (topMenu) return topMenu.text

  const menus = topNavs.flatMap((topItem) => [
    ...topItem.navs,
    ...topItem.navs.flatMap((item) => item.sub ?? []),
  ])
  return menus.find((item: NavItem) => item.id === menuId)?.text ?? '菜单页面'
}

export default function MenuPlaceholder() {
  const {menuId} = useParams<{ menuId: string }>()
  const menuText = findMenuText(menuId)

  return (
    <AppLayout>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold text-foreground">{menuText}</h2>
          <p className="mt-2 text-sm text-muted-foreground">该菜单暂未绑定业务对象</p>
        </div>
      </div>
    </AppLayout>
  )
}

import type {NavItem} from '@/data/mock'
import {TopHeaderShell} from './TopHeaderShell'

export function AdminTopHeader({mobileNavs}: { mobileNavs: NavItem[] }) {
  return (
    <TopHeaderShell
      brand="Flexmodel Apps管理后台"
      mobileTitle="后台菜单"
      mobileNavs={mobileNavs}
    />
  )
}

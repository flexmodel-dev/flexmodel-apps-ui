import {Info, LayoutTemplate, Shield, Workflow} from 'lucide-react'
import {Link, useLocation} from 'react-router-dom'
import {cn} from '@/lib/utils'

const sections = [
  {key: 'base', label: '基本信息', icon: Info},
  {key: 'form-design', label: '表单设计', icon: LayoutTemplate},
  {key: 'flows', label: '工作流', icon: Workflow},
  {key: 'data-permissions', label: '数据权限', icon: Shield},
]

export function formSettingsBackPath(appId: string, formName: string) {
  return appId === 'system'
    ? formName === 'f_role' ? '/admin/role-privileges' : '/admin/users'
    : `/admin/apps/${encodeURIComponent(appId)}/settings/forms`
}

export function FormSettingsNav({appId, formName, mobile = false}: {appId: string; formName: string; mobile?: boolean}) {
  const {pathname} = useLocation()
  return <nav aria-label="表单设置" className={mobile ? 'flex gap-1 overflow-x-auto border-t p-2 lg:hidden' : 'space-y-1 p-2'}>
    {sections.filter(item => appId !== 'system' || !['data-permissions', 'flows'].includes(item.key)).map(({
                                                                                                             key,
                                                                                                             label,
                                                                                                             icon: Icon
                                                                                                           }) => {
      const path = `/admin/apps/${encodeURIComponent(appId)}/forms/${encodeURIComponent(formName)}/${key}`
      const active = pathname === path
      return <Link key={key} to={path} aria-current={active ? 'page' : undefined}
                   className={cn('flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm',
                     active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground', mobile && 'flex-1 justify-center')}>
        <Icon className="h-4 w-4 shrink-0"/>{label}
      </Link>
    })}
  </nav>
}

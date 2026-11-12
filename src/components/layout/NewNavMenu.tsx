import * as React from 'react'
import {FolderPlus, LayoutGrid, Link, Plus, Table2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import {getAppNavDestinations, type AppNavDestinations} from '@/services/appNavigation'
import {toErrorMessage} from '@/lib/utils'
import type {NavEditorDraft} from './NavEditorDialog'

export function NewNavMenu({appId, hasParent, onCreate}: {
  appId: string
  hasParent: boolean
  onCreate: (draft: NavEditorDraft) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [destinations, setDestinations] = React.useState<AppNavDestinations | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setDestinations(null)
    setError(null)
    getAppNavDestinations(appId).then((next) => {
      if (!cancelled) setDestinations(next)
    })
      .catch((caught) => {
        if (!cancelled) setError(toErrorMessage(caught, '加载菜单选项失败，请重新打开重试。'))
      })
    return () => {
      cancelled = true
    }
  }, [open, appId])
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="新建菜单或分组"
                title="新建菜单或分组" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary">
          <Plus className="h-4 w-4"/>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-52">
        {(['builtIn', 'forms'] as const).map((key) => (
          <DropdownMenuSub key={key}>
            <DropdownMenuSubTrigger disabled={!hasParent}>
              {key === 'builtIn' ? <LayoutGrid className="h-4 w-4"/> : <Table2 className="h-4 w-4"/>}
              {key === 'builtIn' ? '系统内置' : '表单'}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {!destinations ? <DropdownMenuItem disabled>{error ?? '加载中…'}</DropdownMenuItem>
                : destinations[key].length === 0 ? <DropdownMenuItem disabled>暂无可选项</DropdownMenuItem>
                  : destinations[key].map((item) => (
                    <DropdownMenuItem key={item.id}
                                      onSelect={() => onCreate({text: item.label, link: `${item.type}:${item.id}`})}>
                      {item.label}
                    </DropdownMenuItem>
                  ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
        <DropdownMenuItem disabled={!hasParent} onSelect={() => onCreate({link: 'LINK:'})}><Link className="h-4 w-4"/>自定义链接</DropdownMenuItem>
        <DropdownMenuSeparator/>
        <DropdownMenuItem disabled={!hasParent} onSelect={() => onCreate({type: 'GROUP'})}><FolderPlus
          className="h-4 w-4"/>分组</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCreate({type: 'GROUP', topLevel: true})}><LayoutGrid className="h-4 w-4"/>顶部菜单</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

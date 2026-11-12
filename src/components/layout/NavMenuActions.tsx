import {type ReactNode, useRef} from 'react'
import {FolderPlus, MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type NavMenuAction = 'edit' | 'authorize' | 'delete' | 'create' | 'createAfter'
export type OnNavMenuAction = (id: string, action: NavMenuAction) => void

export function NavMenuActions({id, name, onAction, group, topLevel, children, onOpenChange}: {
  id: string
  name: string
  onAction: OnNavMenuAction
  group?: boolean
  topLevel?: boolean
  children?: ReactNode
  onOpenChange?: (open: boolean) => void
}) {
  const keyboardInteraction = useRef(false)
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {children ?? (
          <Button type="button" variant="ghost" size="icon" aria-label={`更多操作：${name}`}
                  className="mr-1 h-7 w-7 shrink-0 text-muted-foreground/60 hover:bg-muted/60 hover:text-muted-foreground opacity-0 group-hover/nav:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                  onPointerDown={(event) => {
                    keyboardInteraction.current = false;
                    event.stopPropagation()
                  }}
                  onKeyDown={() => {
                    keyboardInteraction.current = true
                  }}
                  onClick={(event) => event.stopPropagation()}>
            <MoreHorizontal className="h-4 w-4"/>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end"
                           onPointerDown={() => {
                             keyboardInteraction.current = false
                           }}
                           onPointerDownOutside={() => {
                             keyboardInteraction.current = false
                           }}
                           onKeyDown={() => {
                             keyboardInteraction.current = true
                           }}
                           onCloseAutoFocus={(event) => {
                             // 鼠标操作结束不回焦，避免触发键盘可见态让按钮常显。
                             if (!children && !keyboardInteraction.current) event.preventDefault()
                           }}>
        {topLevel && <DropdownMenuItem onSelect={() => onAction(id, 'createAfter')}><FolderPlus className="h-4 w-4"/>在此后添加分组</DropdownMenuItem>}
        {group && <DropdownMenuItem onSelect={() => onAction(id, 'create')}><Plus
          className="h-4 w-4"/>新增菜单</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => onAction(id, 'edit')}><Pencil className="h-4 w-4"/>编辑</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction(id, 'authorize')}><ShieldCheck
          className="h-4 w-4"/>授权</DropdownMenuItem>
        <DropdownMenuSeparator/>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onAction(id, 'delete')}>
          <Trash2 className="h-4 w-4"/>删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

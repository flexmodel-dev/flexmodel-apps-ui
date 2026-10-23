import {MoreHorizontal, Settings} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** 抽屉右上角更多操作：集中放置表单级入口 */
export function FormMoreMenu({onOpenDesign}: { onOpenDesign: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
          title="更多"
          aria-label="更多"
        >
          <MoreHorizontal className="h-4 w-4"/>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[1100]">
        <DropdownMenuItem onClick={onOpenDesign}>
          <Settings className="h-4 w-4"/>
          表单设计
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

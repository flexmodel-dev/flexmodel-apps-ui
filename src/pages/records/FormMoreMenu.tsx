import {AppWindow, Maximize2, MoreHorizontal, PanelRight, Printer, Settings} from 'lucide-react'
import type {DrawerPresentation} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const presentations = [
  {value: 'dialog', label: '对话框', icon: AppWindow},
  {value: 'fullscreen', label: '全屏', icon: Maximize2},
  {value: 'drawer', label: '抽屉', icon: PanelRight},
] as const

/** 表单与记录的更多操作。 */
export function FormMoreMenu({onOpenDesign, onPrint, presentation}: {
  onOpenDesign?: () => void
  onPrint?: () => void
  presentation?: { value: DrawerPresentation; onChange: (value: DrawerPresentation) => void }
}) {
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
        {onPrint && (
          <DropdownMenuItem onSelect={onPrint}>
            <Printer className="h-4 w-4"/>
            打印
          </DropdownMenuItem>
        )}
        {onOpenDesign && (
          <DropdownMenuItem onClick={onOpenDesign}>
            <Settings className="h-4 w-4"/>
            表单设计
          </DropdownMenuItem>
        )}
        {presentation && (
          <>
            {(onPrint || onOpenDesign) && <DropdownMenuSeparator/>}
            <DropdownMenuRadioGroup
              value={presentation.value}
              aria-label="展示方式"
              className="grid grid-cols-3 gap-1 px-1 py-0.5"
              onKeyDown={event => {
                const {key, target, currentTarget} = event
                if ((key !== 'ArrowLeft' && key !== 'ArrowRight') || !(target instanceof HTMLElement)) return
                event.preventDefault()
                const next = key === 'ArrowLeft'
                  ? target.previousElementSibling ?? currentTarget.lastElementChild
                  : target.nextElementSibling ?? currentTarget.firstElementChild
                if (next instanceof HTMLElement) next.focus()
              }}
            >
              {presentations.map(({value, label, icon: Icon}) => (
                <DropdownMenuRadioItem
                  key={value}
                  value={value}
                  aria-label={label}
                  title={label}
                  textValue={label}
                  className="h-8 justify-center p-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                  onSelect={() => presentation.onChange(value)}
                >
                  <Icon aria-hidden="true" className="h-4 w-4"/>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

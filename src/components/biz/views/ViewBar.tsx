import * as React from 'react'
import {MoreHorizontal, Plus, Settings2} from 'lucide-react'
import {type AppForm, type AppFormViewTab, type AppViewType} from '@/services/appForms'
import {VIEW_TYPE_META, VIEW_TYPE_ORDER} from '@/components/biz/views/viewRegistry'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {cn} from '@/lib/utils'

export function ViewBar({
                          form,
                          activeViewId,
                          onSelect,
                          onReorder,
                          onCreate,
                          onEdit,
                          onDuplicate,
                          onDelete,
                        }: {
  form: AppForm
  activeViewId: string
  onSelect: (viewId: string) => void
  /** 拖拽调整顺序 */
  onReorder: (viewId: string, targetIndex: number) => void
  onCreate: (type: AppViewType) => void
  onEdit: (view: AppFormViewTab) => void
  onDuplicate: (view: AppFormViewTab) => void
  onDelete: (view: AppFormViewTab) => void
}) {
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [dropIndex, setDropIndex] = React.useState<number | null>(null)
  const views = form.viewTabs

  const handleDrop = (index: number) => {
    if (draggingId) onReorder(draggingId, index)
    setDraggingId(null)
    setDropIndex(null)
  }

  return (
    <div className="flex min-w-0 items-end justify-between gap-2">
      {/* overflow-x-auto 会让 overflow-y 由 visible 变为 auto，任何纵向溢出都会在页签右侧
          渲染出一条竖向滚动条，因此这里显式隐藏纵向溢出，只保留横向滚动。 */}
      <ul className="flex min-w-0 list-none items-center gap-1 overflow-x-auto overflow-y-hidden">
        {views.map((view, index) => {
          const isActive = activeViewId === view.id
          return (
            <li
              key={view.id}
              className={cn(
                'relative shrink-0',
                draggingId === view.id && 'opacity-50',
                dropIndex === index && draggingId && draggingId !== view.id && 'before:absolute before:-left-0.5 before:inset-y-1 before:w-0.5 before:rounded-full before:bg-primary',
              )}
              draggable
              onDragStart={() => setDraggingId(view.id)}
              onDragOver={(event) => {
                if (!draggingId) return
                event.preventDefault()
                setDropIndex(index)
              }}
              onDrop={(event) => {
                event.preventDefault()
                handleDrop(index)
              }}
              onDragEnd={() => {
                setDraggingId(null)
                setDropIndex(null)
              }}
            >
              <div className="group/tab inline-flex items-center">
                <button
                  type="button"
                  onClick={() => onSelect(view.id)}
                  className={cn(
                    'inline-flex items-center border-b-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
                    isActive ? 'border-primary text-foreground' : 'border-transparent',
                  )}
                  title={view.label}
                >
                  <span className="max-w-[160px] truncate">{view.label}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`视图「${view.label}」更多操作`}
                      className="-ml-1 mb-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/tab:opacity-100 data-[state=open]:opacity-100"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5"/>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => onEdit(view)}>
                      <Settings2 className="h-4 w-4"/>设置视图
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(view)}>
                      <Plus className="h-4 w-4"/>复制视图
                    </DropdownMenuItem>
                    <DropdownMenuSeparator/>
                    <DropdownMenuItem className="text-destructive focus:text-destructive"
                                      onClick={() => onDelete(view)}>
                      删除视图
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mb-1 flex shrink-0 items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="新增视图"
              title="新增视图"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-4 w-4"/>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[280px]">
            <div className="px-2 py-1.5 text-xs text-muted-foreground">选择视图类型</div>
            {VIEW_TYPE_ORDER.map((type) => {
              const meta = VIEW_TYPE_META[type]
              const Icon = meta.icon
              return (
                <DropdownMenuItem key={type} onClick={() => onCreate(type)} className="items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0"/>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm">{meta.label}</span>
                    <span className="text-xs text-muted-foreground">{meta.description}</span>
                  </span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

import * as React from 'react'
import {DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors,} from '@dnd-kit/core'
import {horizontalListSortingStrategy, SortableContext, useSortable} from '@dnd-kit/sortable'
import {CSS as DndCSS} from '@dnd-kit/utilities'
import {ArrowLeft, ArrowRight, Copy, MoreHorizontal, Pencil, Plus, Trash2,} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {BizDialog} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {message} from '@/components/ui/message'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type {AppForm, AppFormViewTab, AppViewType} from '@/services/appForms'
import {VIEW_TYPE_META, VIEW_TYPE_ORDER} from '@/components/biz/views/viewRegistry'
import {MAX_CUSTOM_VIEWS, viewTypeAvailability} from '@/components/biz/views/viewUtils'
import {cn} from '@/lib/utils'

interface ViewBarProps {
  form: AppForm
  activeViewId: string
  saving?: boolean
  onSelect: (viewId: string) => void
  /** 拖拽调整顺序 */
  onReorder: (viewId: string, targetIndex: number) => void
  onCreate: (type: AppViewType) => void
  onRename: (view: AppFormViewTab, label: string) => Promise<boolean>
  onDuplicate: (view: AppFormViewTab) => void
  onDelete: (view: AppFormViewTab) => void
}

function ViewTabItem({
                       view,
                       active,
                       saving,
                       canDelete,
                       canMoveLeft,
                       canMoveRight,
                       onSelect,
                       onRename,
                       onDuplicate,
                       onDelete,
                       onMove,
                     }: {
  view: AppFormViewTab
  active: boolean
  saving: boolean
  canDelete: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  onSelect: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (direction: -1 | 1) => void
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
    id: view.id,
    disabled: saving,
  })
  const {role: _attributeRole, tabIndex: _attributeTabIndex, ...dragAttributes} = attributes
  const typeLabel = VIEW_TYPE_META[view.type].label

  return (
    <li
      ref={setNodeRef}
      style={{transform: DndCSS.Translate.toString(transform), transition}}
      className={cn('relative shrink-0', isDragging && 'z-10 opacity-60')}
      data-view-tab-id={view.id}
    >
      <div className="group/tab inline-flex items-center">
        <button
          type="button"
          role="tab"
          aria-selected={active}
          title={`${view.label}（${typeLabel}）`}
          onClick={onSelect}
          {...dragAttributes}
          {...listeners}
          tabIndex={0}
          className={cn(
            'inline-flex items-center border-b-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
            active ? 'border-primary text-foreground' : 'border-transparent',
          )}
        >
          <span className="max-w-[160px] truncate">{view.label}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`视图「${view.label}」更多操作`}
              className="-ml-1 mb-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:opacity-100 group-hover/tab:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5"/>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="h-4 w-4"/>重命名
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4"/>复制视图
            </DropdownMenuItem>
            <DropdownMenuSeparator/>
            <DropdownMenuItem disabled={!canMoveLeft} onClick={() => onMove(-1)}>
              <ArrowLeft className="h-4 w-4"/>向左移动
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canMoveRight} onClick={() => onMove(1)}>
              <ArrowRight className="h-4 w-4"/>向右移动
            </DropdownMenuItem>
            <DropdownMenuSeparator/>
            <DropdownMenuItem
              disabled={!canDelete}
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4"/>删除视图
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

/** 视图页签栏：拖拽排序、重命名、复制、删除，以及按表单字段能力过滤的新增入口。 */
export function ViewBar({
                          form,
                          activeViewId,
                          saving = false,
                          onSelect,
                          onReorder,
                          onCreate,
                          onRename,
                          onDuplicate,
                          onDelete,
                        }: ViewBarProps) {
  const views = form.viewTabs
  const availability = React.useMemo(() => viewTypeAvailability(form), [form])
  const atLimit = views.length >= MAX_CUSTOM_VIEWS
  const [renameTarget, setRenameTarget] = React.useState<AppFormViewTab | null>(null)
  const [renameValue, setRenameValue] = React.useState('')
  const [renameError, setRenameError] = React.useState('')
  const [isRenaming, setIsRenaming] = React.useState(false)
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 6}}))

  React.useEffect(() => {
    const active = document.querySelector<HTMLElement>(`[data-view-tab-id="${globalThis.CSS.escape(activeViewId)}"]`)
    active?.scrollIntoView({block: 'nearest', inline: 'nearest'})
  }, [activeViewId])

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || active.id === over.id) return
    const targetIndex = views.findIndex((view) => view.id === over.id)
    if (targetIndex >= 0) onReorder(String(active.id), targetIndex)
  }

  const startRename = (view: AppFormViewTab) => {
    setRenameTarget(view)
    setRenameValue(view.label)
    setRenameError('')
  }

  const closeRename = (open: boolean) => {
    if (!open) {
      setRenameTarget(null)
      setRenameError('')
    }
  }

  const submitRename = async () => {
    if (!renameTarget) return
    const label = renameValue.trim()
    if (!label) {
      setRenameError('视图名称不能为空')
      return
    }
    if (label.length > 32) {
      setRenameError('视图名称不能超过 32 个字符')
      return
    }
    if (views.some((view) => view.id !== renameTarget.id && view.label === label)) {
      setRenameError('视图名称已存在')
      return
    }
    if (label === renameTarget.label) {
      setRenameTarget(null)
      return
    }
    setIsRenaming(true)
    try {
      const ok = await onRename(renameTarget, label)
      if (ok) {
        message.success('视图已重命名')
        setRenameTarget(null)
      }
    } finally {
      setIsRenaming(false)
    }
  }

  return (
    <>
      <div className="flex min-w-0 items-end justify-between gap-2">
        {/* overflow-x-auto 会让 overflow-y 由 visible 变为 auto，因此显式隐藏纵向溢出。 */}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={views.map((view) => view.id)} strategy={horizontalListSortingStrategy}>
            <ul
              role="tablist"
              aria-label="视图"
              className="flex min-w-0 list-none items-center gap-1 overflow-x-auto overflow-y-hidden"
            >
              {views.map((view, index) => (
                <ViewTabItem
                  key={view.id}
                  view={view}
                  active={activeViewId === view.id}
                  saving={saving}
                  canDelete={views.length > 1}
                  canMoveLeft={index > 0}
                  canMoveRight={index < views.length - 1}
                  onSelect={() => onSelect(view.id)}
                  onRename={() => startRename(view)}
                  onDuplicate={() => onDuplicate(view)}
                  onDelete={() => onDelete(view)}
                  onMove={(direction) => onReorder(view.id, index + direction)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <div className="mb-1 flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="新增视图"
                title={atLimit ? `最多支持 ${MAX_CUSTOM_VIEWS} 个视图` : '新增视图'}
                disabled={atLimit || saving}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <Plus className="h-4 w-4"/>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[300px]">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">选择视图类型</div>
              {VIEW_TYPE_ORDER.map((type) => {
                const meta = VIEW_TYPE_META[type]
                const Icon = meta.icon
                const state = availability[type]
                return (
                  <DropdownMenuItem
                    key={type}
                    disabled={!state.enabled}
                    onClick={() => onCreate(type)}
                    className="items-start gap-2"
                    title={state.reason ?? undefined}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0"/>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm">{meta.label}</span>
                      <span className="text-xs text-muted-foreground">{state.reason ?? meta.description}</span>
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <BizDialog
        open={Boolean(renameTarget)}
        onOpenChange={closeRename}
        title="重命名视图"
        footer={
          <>
            <Button variant="secondary" disabled={isRenaming} onClick={() => closeRename(false)}>取消</Button>
            <Button disabled={isRenaming} onClick={() => void submitRename()}>
              {isRenaming ? '保存中…' : '保存'}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Input
            autoFocus
            value={renameValue}
            maxLength={32}
            placeholder="视图名称"
            onChange={(event) => {
              setRenameValue(event.target.value)
              setRenameError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submitRename()
            }}
          />
          {renameError && <p role="alert" className="text-sm text-destructive">{renameError}</p>}
        </div>
      </BizDialog>
    </>
  )
}

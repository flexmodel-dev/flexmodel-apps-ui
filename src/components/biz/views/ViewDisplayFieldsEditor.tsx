import * as React from 'react'
import {closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors,} from '@dnd-kit/core'
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {GripVertical, Plus, X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import type {AppForm, AppFormField} from '@/services/appForms'
import {FIELD_TYPE_LABELS, layoutFieldLabel, MAX_VIEW_DISPLAY_FIELDS} from '@/components/biz/views/viewUtils'
import {cn} from '@/lib/utils'

function SortableSelectedField({
                                 form,
                                 field,
                                 onRemove,
                               }: {
  form: AppForm
  field: AppFormField
  onRemove: () => void
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: field.name})
  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Translate.toString(transform), transition}}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-background px-2 py-1.5',
        isDragging && 'z-10 opacity-80 shadow-md',
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={`拖拽调整「${layoutFieldLabel(form, field.name, field.label)}」顺序`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4"/>
      </button>
      <span className="min-w-0 flex-1 truncate text-sm">{layoutFieldLabel(form, field.name, field.label)}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{FIELD_TYPE_LABELS[field.type] ?? field.type}</span>
      <Button
        variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`移除显示字段「${layoutFieldLabel(form, field.name, field.label)}」`}
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5"/>
      </Button>
    </div>
  )
}

/** 显示字段编辑器：支持全部字段、自定义排序和搜索添加。 */
export function ViewDisplayFieldsEditor({
                                          form,
                                          fields,
                                          mode,
                                          selected,
                                          onModeChange,
                                          onSelectedChange,
                                        }: {
  form: AppForm
  fields: AppFormField[]
  mode: 'ALL' | 'CUSTOM'
  selected: string[]
  onModeChange: (mode: 'ALL' | 'CUSTOM') => void
  onSelectedChange: (names: string[]) => void
}) {
  const [search, setSearch] = React.useState('')
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}))
  const fieldMap = new Map(fields.map((field) => [field.name, field]))
  const selectedFields = selected.map((name) => fieldMap.get(name)).filter((field): field is AppFormField => Boolean(field))
  const remaining = fields.filter((field) => !selected.includes(field.name))
  const keyword = search.trim().toLowerCase()
  const filteredRemaining = keyword
    ? remaining.filter((field) => `${layoutFieldLabel(form, field.name, field.label)} ${field.name} ${field.type}`
      .toLowerCase()
      .includes(keyword))
    : remaining
  const atLimit = selected.length >= MAX_VIEW_DISPLAY_FIELDS

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || active.id === over.id) return
    const from = selected.indexOf(String(active.id))
    const to = selected.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    onSelectedChange(arrayMove(selected, from, to))
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
        <button
          type="button"
          className={cn(
            'rounded-md px-3 py-1 text-xs transition-colors',
            mode === 'ALL' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onModeChange('ALL')}
        >
          全部字段
        </button>
        <button
          type="button"
          className={cn(
            'rounded-md px-3 py-1 text-xs transition-colors',
            mode === 'CUSTOM' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onModeChange('CUSTOM')}
        >
          自定义字段
        </button>
      </div>

      {mode === 'ALL' ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          当前显示表单全部字段。切换为“自定义字段”可调整顺序或隐藏部分字段。
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>已选 {selectedFields.length} 个字段，拖拽调整顺序</span>
            <span>{MAX_VIEW_DISPLAY_FIELDS} 个上限</span>
          </div>
          {selectedFields.length ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={selectedFields.map((field) => field.name)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {selectedFields.map((field) => (
                    <SortableSelectedField
                      key={field.name}
                      form={form}
                      field={field}
                      onRemove={() => onSelectedChange(selected.filter((name) => name !== field.name))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              请至少添加一个显示字段
            </p>
          )}

          <div className="space-y-2 rounded-lg border p-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索可添加字段"
              className="h-8"
              aria-label="搜索显示字段"
            />
            <div className="max-h-44 space-y-0.5 overflow-y-auto">
              {filteredRemaining.map((field) => (
                <button
                  key={field.name}
                  type="button"
                  disabled={atLimit}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                  onClick={() => onSelectedChange([...selected, field.name])}
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/>
                  <span className="min-w-0 flex-1 truncate">{layoutFieldLabel(form, field.name, field.label)}</span>
                  <span
                    className="shrink-0 text-xs text-muted-foreground">{FIELD_TYPE_LABELS[field.type] ?? field.type}</span>
                </button>
              ))}
              {!filteredRemaining.length && (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  {remaining.length ? '没有匹配的字段' : '所有字段都已显示'}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

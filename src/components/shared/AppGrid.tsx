import * as React from 'react'
import {Link} from 'react-router-dom'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {AppIcon} from './AppIcon'
import type {App} from '@/services/apps'
import {getAppPrimaryColor} from '@/theme/appPrimaryColors'
import {cn} from '@/lib/utils'

type GridApp = Pick<App, 'id' | 'name' | 'iconName' | 'primaryColor'>

function SortableAppCard<T extends GridApp>({app, sortable, dragEndedAtRef, onOpen, actions, leading}: {
  app: T;
  sortable: boolean;
  dragEndedAtRef: React.MutableRefObject<number>;
  onOpen?: (app: T) => void;
  actions?: React.ReactNode;
  leading?: React.ReactNode
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
    id: app.id,
    disabled: !sortable
  })
  return <div ref={setNodeRef} style={{transform: CSS.Transform.toString(transform), transition}} data-app-id={app.id}
              data-primary={getAppPrimaryColor(app.primaryColor).value}
              className={cn('group relative flex min-w-0 flex-col items-center', sortable && 'cursor-grab active:cursor-grabbing', isDragging && 'z-10 opacity-80')}
              {...(sortable ? {...attributes, ...listeners} : null)}>
    <Link to={`/apps/${app.id}`} draggable={false}
          onClick={event => {
            if (Date.now() - dragEndedAtRef.current < 200) {
              event.preventDefault();
              return
            }
            if (onOpen) {
              event.preventDefault();
              onOpen(app)
            }
          }}
          className="flex w-full min-w-0 flex-col items-center gap-2 rounded-xl px-1 pb-2 pt-3 transition-colors hover:bg-accent/50">
      <AppIcon iconName={app.iconName} primaryColor={app.primaryColor}/>
      <span className="w-full break-words text-center text-sm text-foreground">{app.name}</span>
    </Link>
    {leading && <div className="absolute left-0 top-0">{leading}</div>}
    {actions && <div className="absolute right-0 top-0">{actions}</div>}
  </div>
}

/** 应用管理与个人收藏共用卡片、排序手势和拖动后的点击保护；未传 onReorder 时不可拖动。 */
export function AppGrid<T extends GridApp>({apps, onReorder, onOpen, renderActions, renderLeading}: {
  apps: T[];
  onReorder?: (apps: T[]) => void;
  onOpen?: (app: T) => void;
  renderActions?: (app: T) => React.ReactNode;
  renderLeading?: (app: T) => React.ReactNode
}) {
  const dragEndedAtRef = React.useRef(0)
  // 拖放后的原生 click 可能被 dnd-kit 截停，须在捕获阶段阻止链接的默认导航。
  const finishDrag = () => {
    dragEndedAtRef.current = Date.now()
    const clear = () => {
      document.removeEventListener('click', suppress, true);
      window.clearTimeout(timer)
    }
    const suppress = (event: MouseEvent) => {
      clear();
      event.preventDefault()
    }
    const timer = window.setTimeout(clear, 200)
    document.addEventListener('click', suppress, true)
  }
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 8}}),
    useSensor(TouchSensor, {activationConstraint: {delay: 250, tolerance: 8}}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
  )
  const handleDragEnd = ({active, over}: DragEndEvent) => {
    finishDrag()
    if (!onReorder || !over || active.id === over.id) return
    const from = apps.findIndex(app => app.id === active.id), to = apps.findIndex(app => app.id === over.id)
    if (from >= 0 && to >= 0) onReorder(arrayMove(apps, from, to))
  }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}
                     onDragCancel={finishDrag}>
    <SortableContext items={apps.map(app => app.id)} strategy={rectSortingStrategy}>
      <div className="grid min-w-0 max-w-full grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-x-4 gap-y-6">
        {apps.map(app => <SortableAppCard key={app.id} app={app} sortable={Boolean(onReorder)}
                                          dragEndedAtRef={dragEndedAtRef} onOpen={onOpen} actions={renderActions?.(app)}
                                          leading={renderLeading?.(app)}/>)}
      </div>
    </SortableContext>
  </DndContext>
}

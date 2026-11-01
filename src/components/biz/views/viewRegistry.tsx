import {
  CalendarDays,
  GalleryHorizontalEnd,
  GanttChartSquare,
  Info,
  KanbanSquare,
  List,
  type LucideIcon,
  Network,
  Table,
} from 'lucide-react'
import type {AppForm, AppViewConfig, AppViewType} from '@/services/appForms'
import {defaultViewConfig} from '@/components/biz/views/viewUtils'

export type {ViewTypeAvailability} from '@/components/biz/views/viewUtils'

export interface ViewTypeMeta {
  type: AppViewType
  label: string
  icon: LucideIcon
  description: string
  defaultConfig: (form: AppForm) => AppViewConfig
}

export const VIEW_TYPE_META: Record<AppViewType, ViewTypeMeta> = {
  TABLE: {
    type: 'TABLE',
    label: '表格',
    icon: Table,
    description: '经典表格分页展示，支持勾选、排序与批量操作',
    defaultConfig: (form) => defaultViewConfig(form, 'TABLE'),
  },
  KANBAN: {
    type: 'KANBAN',
    label: '看板',
    icon: KanbanSquare,
    description: '按单值字段分列展示卡片，拖拽卡片修改分组',
    defaultConfig: (form) => defaultViewConfig(form, 'KANBAN'),
  },
  CALENDAR: {
    type: 'CALENDAR',
    label: '日历',
    icon: CalendarDays,
    description: '按日期查看事件，拖拽调整日程',
    defaultConfig: (form) => defaultViewConfig(form, 'CALENDAR'),
  },
  GALLERY: {
    type: 'GALLERY',
    label: '画廊',
    icon: GalleryHorizontalEnd,
    description: '以图片封面卡片网格浏览记录',
    defaultConfig: (form) => defaultViewConfig(form, 'GALLERY'),
  },
  DETAIL: {
    type: 'DETAIL',
    label: '详情',
    icon: List,
    description: '列表加详情或直接展示首条记录详情',
    defaultConfig: (form) => defaultViewConfig(form, 'DETAIL'),
  },
  HIERARCHY: {
    type: 'HIERARCHY',
    label: '层级',
    icon: Network,
    description: '按本表父子引用展示层级树或树形表格',
    defaultConfig: (form) => defaultViewConfig(form, 'HIERARCHY'),
  },
  GANTT: {
    type: 'GANTT',
    label: '甘特',
    icon: GanttChartSquare,
    description: '按起止日期展示排期条，支持整体移动与两端拉伸',
    defaultConfig: (form) => defaultViewConfig(form, 'GANTT'),
  },
}

export const VIEW_TYPE_ORDER: AppViewType[] = ['TABLE', 'KANBAN', 'CALENDAR', 'GALLERY', 'DETAIL', 'HIERARCHY', 'GANTT']

export function configHint(type: AppViewType): string {
  switch (type) {
    case 'KANBAN':
      return '看板需要选择分组字段，支持选项、分类、布尔与单条引用字段'
    case 'CALENDAR':
      return '日历需要选择开始日期字段，可选结束字段（类型需与开始一致）'
    case 'GALLERY':
      return '画廊可选择一个附件字段作为封面，未选择时显示占位图'
    case 'DETAIL':
      return '详情视图可选择“列表+详情”或仅展示第一条详情'
    case 'HIERARCHY':
      return '层级视图需要一个关联本表单的引用字段识别父节点'
    case 'GANTT':
      return '甘特视图需要开始与结束日期字段（类型需一致）'
    default:
      return ''
  }
}

export function InfoHint({text}: { text: string }) {
  if (!text) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5"/>
      {text}
    </span>
  )
}

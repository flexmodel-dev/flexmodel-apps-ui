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
import type {AppForm, AppFormField, AppViewConfig, AppViewType} from '@/services/appForms'

export interface ViewTypeMeta {
  type: AppViewType
  label: string
  icon: LucideIcon
  description: string
  defaultConfig: () => AppViewConfig
}

export const VIEW_TYPE_META: Record<AppViewType, ViewTypeMeta> = {
  TABLE: {
    type: 'TABLE',
    label: '表格',
    icon: Table,
    description: '经典表格分页展示，支持勾选、排序与批量操作',
    defaultConfig: () => ({}),
  },
  KANBAN: {
    type: 'KANBAN',
    label: '看板',
    icon: KanbanSquare,
    description: '按单值字段分列展示卡片，拖拽卡片修改分组',
    defaultConfig: () => ({groupField: null, titleField: null}),
  },
  CALENDAR: {
    type: 'CALENDAR',
    label: '日历',
    icon: CalendarDays,
    description: '按日期查看事件，拖拽调整日程',
    defaultConfig: () => ({startField: null, endField: null, titleField: null, calendarUnit: 'MONTH'}),
  },
  GALLERY: {
    type: 'GALLERY',
    label: '画廊',
    icon: GalleryHorizontalEnd,
    description: '以图片封面卡片网格浏览记录',
    defaultConfig: () => ({coverField: null, titleField: null, imageFit: 'COVER'}),
  },
  DETAIL: {
    type: 'DETAIL',
    label: '详情',
    icon: List,
    description: '列表加详情或直接展示首条记录详情',
    defaultConfig: () => ({detailMode: 'LIST'}),
  },
  HIERARCHY: {
    type: 'HIERARCHY',
    label: '层级',
    icon: Network,
    description: '按本表父子引用展示层级树或树形表格',
    defaultConfig: () => ({parentField: null, hierarchyMode: 'TREE'}),
  },
  GANTT: {
    type: 'GANTT',
    label: '甘特',
    icon: GanttChartSquare,
    description: '按起止日期展示排期条，支持整体移动与两端拉伸',
    defaultConfig: () => ({startField: null, endField: null, titleField: null, ganttScale: 'WEEK'}),
  },
}

export const VIEW_TYPE_ORDER: AppViewType[] = ['TABLE', 'KANBAN', 'CALENDAR', 'GALLERY', 'DETAIL', 'HIERARCHY', 'GANTT']

const KANBAN_GROUP_FIELD_TYPES = new Set(['PICKLIST', 'SELECT', 'CLASSIFICATION', 'BOOL', 'REFERENCE'])
const DATE_FIELD_TYPES = new Set(['DATE', 'DATETIME'])
const ATTACHMENT_FIELD_TYPES = new Set(['FILE', 'IMAGE', 'AVATAR'])

/** 可作为标题的文本型字段。 */
export function titleFieldCandidates(form: AppForm): AppFormField[] {
  const preferred = ['TEXT', 'NTEXT', 'PHONE', 'EMAIL', 'URL', 'SERIES', 'BARCODE', 'NUMBER', 'DECIMAL']
  return form.fields.filter((field) => !field.builtin && preferred.includes(field.type))
}

export function kanbanGroupFieldCandidates(form: AppForm): AppFormField[] {
  return form.fields.filter((field) => !field.builtin && KANBAN_GROUP_FIELD_TYPES.has(field.type))
}

export function dateFieldCandidates(form: AppForm): AppFormField[] {
  return form.fields.filter((field) => !field.builtin && DATE_FIELD_TYPES.has(field.type))
}

export function attachmentFieldCandidates(form: AppForm): AppFormField[] {
  return form.fields.filter((field) => !field.builtin && ATTACHMENT_FIELD_TYPES.has(field.type))
}

export function selfReferenceFieldCandidates(form: AppForm): AppFormField[] {
  return form.fields.filter(
    (field) => !field.builtin && field.type === 'REFERENCE' && field.referenceForm === form.name,
  )
}

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

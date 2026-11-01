import type {AppForm, AppFormViewFilter, AppFormViewTab} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'

/** 视图组件共享的记录操作，由容器统一提供。 */
export interface ViewRecordActions {
  onOpenRecord: (recordId: string, mode?: 'view' | 'edit') => void
  onOpenLinkedRecord: (formName: string, recordId: string) => void
  /** 请求删除记录，容器统一弹确认框 */
  onRequestDelete: (recordId: string) => void
}

export interface ViewComponentProps extends ViewRecordActions {
  appId: string
  form: AppForm
  view: AppFormViewTab
  /** 已防抖的关键词 */
  search: string
  /** 临时高级查询（已解析为对象） */
  advancedFilter: AppFormViewFilter | null
  /** 容器刷新信号，变化时重新加载 */
  refreshTick: number
  /** 拖拽等写入成功后通知容器刷新共享数据 */
  onRecordChanged: () => void
  /** 仅表格视图使用：当前勾选的记录 */
  selected?: string[]
  onSelectedChange?: (ids: string[]) => void
}

/** 视图内单条记录的展示辅助：标题字段值与摘要字段。 */
export function viewTitleValue(form: AppForm, view: AppFormViewTab, record: AppRecord): string {
  const fieldName = view.config.titleField || form.displayField || 'id'
  const value = record[fieldName]
  if (value === undefined || value === null || value === '') return '未命名'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function viewDisplayFields(form: AppForm, view: AppFormViewTab): string[] {
  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const names = view.displayFields.length
    ? view.displayFields
    : (form.layout.items.length
      ? form.layout.items.filter((item) => item.type === 'FIELD' && Boolean(item.name)).map((item) => item.name!)
      : form.fields.filter((field) => !field.builtin).map((field) => field.name))
  return names.filter((name) => fieldMap.has(name))
}

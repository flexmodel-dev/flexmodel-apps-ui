import type {AppForm, AppFormViewFilter, AppFormViewTab} from '@/services/appForms'

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
  /** 打开当前视图设置，用于缺少专属字段配置时的引导 */
  onOpenViewSettings?: () => void
  /** 仅表格视图使用：当前勾选的记录 */
  selected?: string[]
  onSelectedChange?: (ids: string[]) => void
}

export {viewTitleValue, effectiveDisplayFields as viewDisplayFields} from '@/components/biz/views/viewUtils'

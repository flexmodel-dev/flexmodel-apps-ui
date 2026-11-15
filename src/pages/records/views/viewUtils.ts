import type {
  AppForm,
  AppFormField,
  AppFormViewFilter,
  AppFormViewTab,
  AppViewConfig,
  AppViewFilterValue,
  AppViewType,
} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import {formatFieldValue} from '@/lib/fieldConfig'

/** 视图数量、显示字段和筛选条件的服务端上限，前端保持一致以避免保存后才报错。 */
export const MAX_CUSTOM_VIEWS = 20
export const MAX_VIEW_DISPLAY_FIELDS = 60
export const MAX_VIEW_FILTER_CONDITIONS = 10

/** 视图记录分页可选每页数量；服务端单次查询最多返回 200 条。 */
export const VIEW_PAGE_SIZE_OPTIONS = [30, 50, 100, 200]
export const DEFAULT_VIEW_PAGE_SIZE = 30

export const KANBAN_GROUP_FIELD_TYPES = new Set(['PICKLIST', 'SELECT', 'CLASSIFICATION', 'BOOL', 'REFERENCE'])
export const DATE_FIELD_TYPES = new Set(['DATE', 'DATETIME'])
export const ATTACHMENT_FIELD_TYPES = new Set(['FILE', 'IMAGE', 'AVATAR'])

/** 字段类型可读名称，用于字段选择器中的辅助说明。 */
export const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: '单行文本',
  NTEXT: '多行文本',
  PHONE: '手机号',
  EMAIL: '邮箱',
  URL: '网址',
  SERIES: '流水号',
  PICKLIST: '选项',
  SELECT: '单选',
  NUMBER: '整数',
  DECIMAL: '小数',
  DATE: '日期',
  DATETIME: '日期时间',
  TIME: '时间',
  CLASSIFICATION: '分类',
  MULTISELECT: '多选',
  TAG: '标签',
  REFERENCE: '关联记录',
  MULTIREFERENCE: '关联多条',
  FILE: '附件',
  IMAGE: '图片',
  AVATAR: '头像',
  BARCODE: '条码',
  LOCATION: '定位',
  SIGN: '签名',
  BOOL: '布尔',
  STATE: '状态',
}

export function layoutFieldLabel(form: AppForm, fieldName: string, fallback?: string): string {
  const item = form.layout.items.find((entry) => entry.type === 'FIELD' && entry.name === fieldName)
  return item?.label?.trim()
    || form.fields.find((field) => field.name === fieldName)?.label
    || fallback
    || fieldName
}

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

function defaultTitleField(form: AppForm): string | null {
  if (form.displayField && form.fields.some((field) => field.name === form.displayField && !field.builtin)) {
    return form.displayField
  }
  return titleFieldCandidates(form)[0]?.name ?? null
}

function sameTypeDatePair(form: AppForm): [AppFormField, AppFormField] | null {
  const candidates = dateFieldCandidates(form)
  for (const field of candidates) {
    const match = candidates.find((item) => item !== field && item.type === field.type)
    if (match) return [field, match]
  }
  return null
}

export function defaultViewConfig(form: AppForm, type: AppViewType): AppViewConfig {
  const titleField = defaultTitleField(form)
  switch (type) {
    case 'KANBAN':
      return {groupField: kanbanGroupFieldCandidates(form)[0]?.name ?? null, titleField}
    case 'CALENDAR': {
      const start = dateFieldCandidates(form)[0]
      const end = start
        ? dateFieldCandidates(form).find((field) => field !== start && field.type === start.type)
        : undefined
      return {startField: start?.name ?? null, endField: end?.name ?? null, titleField, calendarUnit: 'MONTH'}
    }
    case 'GALLERY':
      return {coverField: attachmentFieldCandidates(form)[0]?.name ?? null, titleField, imageFit: 'COVER'}
    case 'DETAIL':
      return {detailMode: 'LIST'}
    case 'HIERARCHY':
      return {
        parentField: selfReferenceFieldCandidates(form)[0]?.name ?? null,
        titleField,
        hierarchyMode: 'TREE',
      }
    case 'GANTT': {
      const pair = sameTypeDatePair(form)
      return {
        startField: pair?.[0].name ?? null,
        endField: pair?.[1].name ?? null,
        titleField,
        ganttScale: 'WEEK',
      }
    }
    default:
      return {}
  }
}

export interface ViewTypeAvailability {
  enabled: boolean
  reason: string | null
}

/** 根据表单字段判断哪些视图类型可创建，避免进入无法完成的配置流程。 */
export function viewTypeAvailability(form: AppForm): Record<AppViewType, ViewTypeAvailability> {
  const groupFields = kanbanGroupFieldCandidates(form)
  const dateFields = dateFieldCandidates(form)
  const parents = selfReferenceFieldCandidates(form)
  const hasDatePair = dateFields.some((field) => dateFields.some((other) => other !== field && other.type === field.type))
  return {
    TABLE: {enabled: true, reason: null},
    KANBAN: groupFields.length
      ? {enabled: true, reason: null}
      : {enabled: false, reason: '表单还没有可用于分组的选项、布尔或关联字段'},
    CALENDAR: dateFields.length
      ? {enabled: true, reason: null}
      : {enabled: false, reason: '表单还没有日期或日期时间字段'},
    GALLERY: {enabled: true, reason: null},
    DETAIL: {enabled: true, reason: null},
    HIERARCHY: parents.length
      ? {enabled: true, reason: null}
      : {enabled: false, reason: '表单还没有关联本表单的引用字段'},
    GANTT: hasDatePair
      ? {enabled: true, reason: null}
      : {enabled: false, reason: '甘特需要两个同类型的日期字段'},
  }
}

/** 表单布局中的业务字段顺序，用作视图显示字段的默认值。 */
export function allDisplayFieldNames(form: AppForm): string[] {
  if (form.layout.items.length) {
    return form.layout.items
      .filter((item) => item.type === 'FIELD' && Boolean(item.name))
      .map((item) => item.name!)
  }
  return form.fields.filter((field) => !field.builtin).map((field) => field.name)
}

/** 当前视图实际生效的显示字段；空数组表示沿用表单布局。 */
export function effectiveDisplayFields(form: AppForm, view: AppFormViewTab): string[] {
  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const names = view.displayFields.length ? view.displayFields : allDisplayFieldNames(form)
  return names.filter((name) => fieldMap.has(name))
}

export function viewTitleValue(form: AppForm, view: AppFormViewTab, record: AppRecord): string {
  const fieldName = view.config.titleField || form.displayField || 'id'
  const value = record[fieldName]
  if (value === undefined || value === null || value === '') return '未命名'
  if (typeof value === 'object') {
    const displayValue = (value as { displayValue?: unknown }).displayValue
    if (displayValue !== undefined && displayValue !== null && displayValue !== '') return String(displayValue)
    return JSON.stringify(value)
  }
  return String(value)
}

/** 记录摘要文本：关联对象优先取 displayValue，其余沿用字段格式化。 */
export function recordFieldText(field: AppFormField, value: unknown): string {
  if (value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const reference = value as { displayValue?: unknown; id?: unknown }
    if (reference.displayValue !== undefined && reference.displayValue !== null && reference.displayValue !== '') {
      return String(reference.displayValue)
    }
    if (reference.id !== undefined && reference.id !== null) return String(reference.id)
  }
  return formatFieldValue(field, value)
}

export function countFilterConditions(filter: AppFormViewFilter | null | undefined): number {
  if (!filter) return 0
  return (filter._and ?? filter._or ?? []).length
}

export function hasActiveQuery(view: AppFormViewTab, search: string, advancedFilter: AppFormViewFilter | null): boolean {
  return Boolean(search.trim() || advancedFilter?._and?.length || advancedFilter?._or?.length || countFilterConditions(view.filter))
}

export function viewPageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, size)))
}

export function clampViewPage(page: number, total: number, size: number): number {
  return Math.min(Math.max(1, page), viewPageCount(total, size))
}

/** 选项筛选值必须使用选项 id；记录和看板拖拽都按 id 存储。 */
export function defaultConditionValue(field: AppFormField): AppViewFilterValue {
  if (field.type === 'BOOL') return false
  if (field.options?.length) return field.options[0].id ?? field.options[0].text ?? ''
  return ''
}

export function optionText(field: AppFormField, value: unknown): string {
  const text = field.options?.find((option) => option.id === String(value) || option.text === String(value))?.text
  return text ?? (value === undefined || value === null || value === '' ? '' : String(value))
}

/** 筛选值展示文本，用于筛选摘要。 */
export function filterValueLabel(field: AppFormField, value: unknown): string {
  if (field.type === 'BOOL') return value === true || value === 'true' ? '是' : '否'
  if (field.options?.length) return optionText(field, value)
  if (value === undefined || value === null) return ''
  return String(value)
}

export function groupKeyForValue(value: unknown): string {
  return value === undefined || value === null || value === ''
    ? 'ungrouped'
    : `group-${JSON.stringify(value)}`
}

export function rawGroupValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in value) {
    return (value as { id: unknown }).id
  }
  return value
}

export function groupKeyForRecord(groupField: string, record: AppRecord): string {
  return groupKeyForValue(rawGroupValue(record[groupField]))
}

/** 页面标题（浏览器标签）无需区分，保留给后续扩展。 */
export function dateInputValue(date: Date): string {
  const pad = (value: number) => (value < 10 ? `0${value}` : String(value))
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

import {requestJson} from '@/services/http'
import {cachedFetch, createAppDataCache} from '@/services/appDataCache'
import {invalidateAppNavDestinations} from '@/services/appNavigation'

export type AppFormFieldType =
  | 'TEXT'
  | 'NTEXT'
  | 'PHONE'
  | 'EMAIL'
  | 'URL'
  | 'SERIES'
  | 'PICKLIST'
  | 'SELECT'
  | 'NUMBER'
  | 'DECIMAL'
  | 'DATE'
  | 'DATETIME'
  | 'TIME'
  | 'CLASSIFICATION'
  | 'MULTISELECT'
  | 'TAG'
  | 'REFERENCE'
  | 'MULTIREFERENCE'
  | 'FILE'
  | 'IMAGE'
  | 'AVATAR'
  | 'BARCODE'
  | 'LOCATION'
  | 'SIGN'
  | 'BOOL'
  | 'STATE'

export interface AppFormFieldOption {
  id?: string
  text?: string
  color?: string
  defaultSelected?: boolean
}

export interface AppFieldConfig {
  defaultValue?: string | number | boolean | null
  defaultNow?: boolean
  creatable?: boolean
  updatable?: boolean
  commonValues?: string[]
  maxLength?: number
  pattern?: string
  validationMessage?: string
  allowNegative?: boolean
  decimalPlaces?: number
  thousandsSeparator?: boolean
  prefix?: string
  suffix?: string
  dateFormat?: string
  displayStyle?: 'DROPDOWN' | 'RADIO' | 'CHECKBOX'
}

export interface AppFormField {
  name: string
  label: string
  type: AppFormFieldType
  required: boolean
  builtin: boolean
  options?: AppFormFieldOption[] | null
  referenceForm?: string | null
  locked?: boolean
  extension?: boolean
  config?: AppFieldConfig | null
}

export type AppViewFilterOperator =
  | '_eq'
  | '_ne'
  | '_contains'
  | '_not_contains'
  | '_starts_with'
  | '_ends_with'
  | '_gt'
  | '_gte'
  | '_lt'
  | '_lte'

export type AppViewFilterValue = string | number | boolean
export type AppViewFilterCondition = Record<string, Record<string, AppViewFilterValue>>

/** 记录查询 filter DSL 条件节点：字段条件 / _and / _or 组合，语法见 records.md。 */
export type FilterCondition = Record<string, unknown>

export interface AppFormViewFilter {
  _and?: AppViewFilterCondition[]
  _or?: AppViewFilterCondition[]
}

export type AppViewType = 'TABLE' | 'KANBAN' | 'CALENDAR' | 'GALLERY' | 'DETAIL' | 'HIERARCHY' | 'GANTT'

export type AppViewImageFit = 'COVER' | 'CONTAIN'
export type AppViewCalendarUnit = 'MONTH' | 'WEEK' | 'DAY'
export type AppViewDetailMode = 'LIST' | 'SINGLE'
export type AppViewHierarchyMode = 'TREE' | 'TABLE'
export type AppViewGanttScale = 'DAY' | 'WEEK' | 'MONTH'

export interface AppViewConfig {
  groupField?: string | null
  titleField?: string | null
  coverField?: string | null
  imageFit?: AppViewImageFit | null
  startField?: string | null
  endField?: string | null
  calendarUnit?: AppViewCalendarUnit | null
  detailMode?: AppViewDetailMode | null
  parentField?: string | null
  hierarchyMode?: AppViewHierarchyMode | null
  ganttScale?: AppViewGanttScale | null
}

export interface AppFormViewSort {
  field: string
  order: 'ASC' | 'DESC'
}

export interface AppFormViewTab {
  id: string
  label: string
  type: AppViewType
  filter: AppFormViewFilter | null
  sort: AppFormViewSort | null
  displayFields: string[]
  config: AppViewConfig
}

export type AppFormItemType = 'FIELD' | 'SECTION' | 'SUBFORM'

export type AppFormItemWidthType =
  | 'QUARTER'
  | 'THIRD'
  | 'HALF'
  | 'TWO_THIRDS'
  | 'THREE_QUARTERS'
  | 'FULL'

export interface AppFormItem {
  type: AppFormItemType
  name?: string
  label?: string
  tip?: string
  width?: AppFormItemWidthType
  hidden?: boolean
  readonly?: boolean
  formName?: string
  referenceField?: string
}

export interface AppForm {
  name: string
  label: string
  description: string
  displayField?: string | null
  searchField?: string | null
  managed: boolean
  builtin: boolean
  createdAt?: string | null
  updatedAt?: string | null
  fields: AppFormField[]
  layout: AppFormLayout
  viewTabs: AppFormViewTab[]
}

export interface AppFormInput {
  label: string
  name: string
  description: string
  createDisplayField: boolean
}

export interface AppFormUpdateInput {
  label: string
  description: string
  displayField?: string | null
}

export interface AppFormFieldInput {
  label: string
  type: AppFormFieldType
  required: boolean
  options?: AppFormFieldOption[]
  referenceForm?: string
  config?: AppFieldConfig
}

export interface AppFormFieldUpdateInput {
  label: string
  required: boolean
  options?: AppFormFieldOption[]
  referenceForm?: string
  config?: AppFieldConfig
}

export type AppFormScene = 'CREATE' | 'UPDATE'

export interface AppFormControl {
  scenes: AppFormScene[]
  condition?: FilterCondition | null
}

export interface AppFormFieldControls {
  hidden?: AppFormControl
  required?: AppFormControl
  readonly?: AppFormControl
}

export type AppFormControls = Record<string, AppFormFieldControls>

export interface AppFormLayout {
  items: AppFormItem[]
  controls?: AppFormControls
}

const API_BASE = '/api/apps'
const formListCache = createAppDataCache<AppForm[]>()
const formCache = createAppDataCache<AppForm>()

function detailKey(appId: string, name: string) {
  return `${appId}:${name}`
}

const VALID_VIEW_TYPES = new Set<AppViewType>([
  'TABLE', 'KANBAN', 'CALENDAR', 'GALLERY', 'DETAIL', 'HIERARCHY', 'GANTT',
])

function normalizeViewTab(raw: Partial<AppFormViewTab> | null | undefined, fallbackLabel = '视图'): AppFormViewTab {
  const type = VALID_VIEW_TYPES.has(raw?.type as AppViewType) ? raw!.type as AppViewType : 'TABLE'
  return {
    id: raw?.id?.trim() || crypto.randomUUID(),
    label: raw?.label?.trim() || fallbackLabel,
    type,
    filter: raw?.filter && typeof raw.filter === 'object' ? raw.filter : null,
    sort: raw?.sort?.field ? {field: raw.sort.field, order: raw.sort.order === 'ASC' ? 'ASC' : 'DESC'} : null,
    displayFields: Array.isArray(raw?.displayFields) ? raw.displayFields.filter((name): name is string => typeof name === 'string') : [],
    config: raw?.config && typeof raw.config === 'object' ? raw.config : {},
  }
}

function normalizeForm(form: AppForm): AppForm {
  const rawViews = Array.isArray(form.viewTabs) ? form.viewTabs : []
  return {
    ...form,
    description: form.description ?? '',
    builtin: form.builtin ?? false,
    fields: Array.isArray(form.fields) ? form.fields : [],
    layout: {
      items: Array.isArray(form.layout?.items) ? form.layout.items : [],
      controls: form.layout?.controls && typeof form.layout.controls === 'object'
      && !Array.isArray(form.layout.controls) ? form.layout.controls : {},
    },
    viewTabs: rawViews.map((view) => normalizeViewTab(view)),
  }
}

export function getAppForms(appId: string): Promise<AppForm[]> {
  return cachedFetch(formListCache, appId, () =>
    requestJson<AppForm[]>(`${API_BASE}/${appId}/forms`).then((forms) => forms.map(normalizeForm)))
}

export function getAppForm(appId: string, name: string): Promise<AppForm> {
  return cachedFetch(formCache, detailKey(appId, name), () =>
    requestJson<AppForm>(`${API_BASE}/${appId}/forms/${encodeURIComponent(name)}`).then(normalizeForm))
}

function invalidateFormCaches(appId: string, name?: string) {
  formListCache.delete(appId)
  if (name) {
    formCache.delete(detailKey(appId, name))
  }
  invalidateAppNavDestinations(appId)
}

export async function createAppForm(appId: string, input: AppFormInput): Promise<AppForm> {
  const form = normalizeForm(await requestJson<AppForm>(`${API_BASE}/${appId}/forms`, {
    method: 'POST',
    body: JSON.stringify(input),
  }))
  invalidateFormCaches(appId, form.name)
  return form
}

export async function updateAppForm(
  appId: string,
  name: string,
  input: AppFormUpdateInput,
): Promise<AppForm> {
  const form = normalizeForm(await requestJson<AppForm>(
    `${API_BASE}/${appId}/forms/${encodeURIComponent(name)}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  ))
  formCache.delete(detailKey(appId, name))
  invalidateFormCaches(appId, form.name || name)
  return form
}

export async function patchAppFormViewTabs(
  appId: string,
  name: string,
  viewTabs: AppFormViewTab[],
): Promise<AppForm> {
  const form = normalizeForm(await requestJson<AppForm>(
    `${API_BASE}/${appId}/forms/${encodeURIComponent(name)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({viewTabs}),
    },
  ))
  invalidateFormCaches(appId, form.name || name)
  return form
}

export async function deleteAppForm(appId: string, name: string): Promise<void> {
  await requestJson<null>(`${API_BASE}/${appId}/forms/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
  invalidateFormCaches(appId, name)
}

export async function saveAppFormLayout(
  appId: string,
  name: string,
  layout: AppFormLayout,
): Promise<AppForm> {
  const form = normalizeForm(await requestJson<AppForm>(
    `${API_BASE}/${appId}/forms/${encodeURIComponent(name)}/layout`,
    {
      method: 'PUT',
      body: JSON.stringify(layout),
    },
  ))
  formListCache.delete(appId)
  formCache.delete(detailKey(appId, name))
  return form
}

export async function createAppFormField(
  appId: string,
  name: string,
  input: AppFormFieldInput,
): Promise<AppFormField> {
  const field = await requestJson<AppFormField>(
    `${API_BASE}/${appId}/forms/${encodeURIComponent(name)}/fields`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  invalidateFormCaches(appId, name)
  return field
}

export async function updateAppFormField(
  appId: string,
  name: string,
  fieldName: string,
  input: AppFormFieldUpdateInput,
): Promise<AppFormField> {
  const field = await requestJson<AppFormField>(
    `${API_BASE}/${appId}/forms/${encodeURIComponent(name)}/fields/${encodeURIComponent(fieldName)}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  )
  invalidateFormCaches(appId, name)
  return field
}

export async function deleteAppFormField(
  appId: string,
  name: string,
  fieldName: string,
): Promise<void> {
  await requestJson<null>(
    `${API_BASE}/${appId}/forms/${encodeURIComponent(name)}/fields/${encodeURIComponent(fieldName)}`,
    {method: 'DELETE'},
  )
  invalidateFormCaches(appId, name)
}

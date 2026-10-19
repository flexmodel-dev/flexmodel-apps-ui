import {requestJson} from '@/services/http'

export type SystemFormFieldType =
  | 'TEXT'
  | 'NTEXT'
  | 'PHONE'
  | 'EMAIL'
  | 'URL'
  | 'TAG'
  | 'SELECT'
  | 'NUMBER'
  | 'DECIMAL'
  | 'DATE'
  | 'DATETIME'
  | 'TIME'
  | 'BOOL'
  | 'MULTISELECT'
  | 'MULTIREFERENCE'

export interface SystemFormFieldOption {
  id?: string
  text?: string
  color?: string | null
  defaultSelected?: boolean
}

export interface SystemFormField {
  name: string
  label: string
  type: SystemFormFieldType
  required: boolean
  locked: boolean
  extension: boolean
  virtual: boolean
  readonly: boolean
  options?: SystemFormFieldOption[] | null
  referenceForm?: string | null
}

export interface SystemFormItem {
  type: 'FIELD' | 'SECTION' | 'COMPONENT' | 'SUBFORM'
  name?: string
  label?: string
  tip?: string
  width?: 'QUARTER' | 'THIRD' | 'HALF' | 'TWO_THIRDS' | 'THREE_QUARTERS' | 'FULL'
  hidden?: boolean
  readonly?: boolean
  formName?: string
  referenceField?: string
}

export interface SystemFormLayout {
  items: SystemFormItem[]
}

export interface SystemFormColumn {
  name: string
  label: string
  width?: string | null
  sortable?: boolean
  hidden?: boolean
}

export interface SystemFormPage {
  title?: string | null
  description?: string | null
  pageSize?: number | null
  leftComponent?: string | null
}

export interface SystemComponent {
  type: 'USER_DEPARTMENTS' | 'USER_ROLES' | 'ROLE_PERMISSIONS'
  label?: string | null
  hidden?: boolean
}

export interface SystemPermissionResource {
  id: number
  name: string
  permission: string
  parentId?: number | null
  children?: SystemPermissionResource[]
}

export interface SystemForm {
  name: string
  label: string
  description: string
  displayField?: string | null
  searchField?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  fields: SystemFormField[]
  layout: SystemFormLayout
  listColumns: SystemFormColumn[]
  page?: SystemFormPage | null
  components: Record<string, SystemComponent>
  designable: boolean
  resources?: SystemPermissionResource[]
}

export type SystemFormSave = Omit<SystemForm, 'name' | 'createdAt' | 'updatedAt' | 'designable' | 'resources'>

export interface SystemRecord {
  id: string

  [key: string]: unknown
}

export interface SystemRecordPage {
  list: SystemRecord[]
  total: number
}

export interface SystemRecordQuery {
  page: number
  size: number
  search?: string
  sortField?: string
  sortOrder?: 'ASC' | 'DESC'
  departmentId?: string
  includeDescendants?: boolean
}

export interface SystemOption {
  id: string
  name?: string | null
  parent_id?: string | null
}

const API_BASE = '/api/system'

function normalizeForm(form: SystemForm): SystemForm {
  return {
    ...form,
    description: form.description ?? '',
    fields: Array.isArray(form.fields) ? form.fields : [],
    layout: {items: Array.isArray(form.layout?.items) ? form.layout.items : []},
    listColumns: Array.isArray(form.listColumns) ? form.listColumns : [],
    components: form.components ?? {},
    designable: form.designable ?? true,
    resources: Array.isArray(form.resources) ? form.resources : [],
  }
}

export async function getSystemForms(): Promise<SystemForm[]> {
  const forms = await requestJson<SystemForm[]>(`${API_BASE}/forms`)
  return forms.map(normalizeForm)
}

export async function getSystemForm(formName: string): Promise<SystemForm> {
  return normalizeForm(
    await requestJson<SystemForm>(`${API_BASE}/forms/${encodeURIComponent(formName)}`),
  )
}

export async function saveSystemForm(formName: string, input: SystemFormSave): Promise<SystemForm> {
  return normalizeForm(await requestJson<SystemForm>(`${API_BASE}/forms/${encodeURIComponent(formName)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }))
}

function recordsPath(formName: string) {
  return `${API_BASE}/forms/${encodeURIComponent(formName)}/records`
}

function normalizePage(page: SystemRecordPage): SystemRecordPage {
  return {
    list: Array.isArray(page.list) ? page.list : [],
    total: Number.isFinite(page.total) ? Number(page.total) : 0,
  }
}

export async function getSystemRecords(
  formName: string,
  query: SystemRecordQuery,
): Promise<SystemRecordPage> {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  })
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.sortField) params.set('sortField', query.sortField)
  if (query.sortOrder) params.set('sortOrder', query.sortOrder)
  if (query.departmentId) params.set('departmentId', query.departmentId)
  if (query.includeDescendants !== undefined) params.set('includeDescendants', String(query.includeDescendants))
  return normalizePage(await requestJson<SystemRecordPage>(`${recordsPath(formName)}?${params}`))
}

export async function getSystemRecord(formName: string, recordId: string): Promise<SystemRecord> {
  return requestJson<SystemRecord>(`${recordsPath(formName)}/${encodeURIComponent(recordId)}`)
}

export async function createSystemRecord(
  formName: string,
  values: Record<string, unknown>,
): Promise<SystemRecord> {
  return requestJson<SystemRecord>(recordsPath(formName), {
    method: 'POST',
    body: JSON.stringify(values),
  })
}

export async function updateSystemRecord(
  formName: string,
  recordId: string,
  values: Record<string, unknown>,
): Promise<SystemRecord> {
  return requestJson<SystemRecord>(`${recordsPath(formName)}/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    body: JSON.stringify(values),
  })
}

export async function deleteSystemRecord(formName: string, recordId: string): Promise<void> {
  await requestJson<null>(`${recordsPath(formName)}/${encodeURIComponent(recordId)}`, {method: 'DELETE'})
}

export async function getSystemOptions(kind: 'departments' | 'roles' | 'users'): Promise<SystemOption[]> {
  return requestJson<SystemOption[]>(`${API_BASE}/options/${kind}`)
}

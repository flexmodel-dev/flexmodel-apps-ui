import {requestJson} from '@/services/http'
import {createAppDataCache} from '@/services/appDataCache'
import {invalidateAppMenuTargets} from '@/services/appMenus'

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

export interface AppFormField {
  name: string
  label: string
  type: AppFormFieldType
  required: boolean
  builtin: boolean
  options?: AppFormFieldOption[] | null
  referenceForm?: string | null
}

export interface AppForm {
  name: string
  label: string
  description: string
  nameField?: string | null
  searchField?: string | null
  managed: boolean
  createdAt?: string | null
  updatedAt?: string | null
  fields: AppFormField[]
  layout?: AppFormLayout | null
}

export interface AppFormInput {
  label: string
  name: string
  description: string
  createNameField: boolean
}

export interface AppFormUpdateInput {
  label: string
  description: string
}

export interface AppFormFieldInput {
  label: string
  type: AppFormFieldType
  required: boolean
  options?: AppFormFieldOption[]
  referenceForm?: string
}

export interface AppFormFieldUpdateInput {
  label: string
  required: boolean
  options?: AppFormFieldOption[]
  referenceForm?: string
}

export interface AppFormItemProperties {
  label?: string
  tip?: string
  required?: boolean
  readonly?: boolean
  hidden?: boolean
}

export interface AppFormLayout {
  fields: string[]
  widths: Record<string, number>
  properties?: Record<string, AppFormItemProperties>
  advanced?: Record<string, unknown>
}

const API_BASE = '/api/apps'
const formListCache = createAppDataCache<AppForm[]>()
const formCache = createAppDataCache<AppForm>()

function detailKey(appId: string, name: string) {
  return `${appId}:${name}`
}

function normalizeForm(form: AppForm): AppForm {
  return {
    ...form,
    description: form.description ?? '',
    fields: Array.isArray(form.fields) ? form.fields : [],
    layout: form.layout ?? null,
  }
}

export async function getAppForms(appId: string): Promise<AppForm[]> {
  let formsRequest = formListCache.get(appId)
  if (!formsRequest) {
    formsRequest = requestJson<AppForm[]>(`${API_BASE}/${appId}/forms`)
      .then((forms) => forms.map(normalizeForm))
      .catch((caught: unknown) => {
        formListCache.delete(appId)
        throw caught
      })
    formListCache.set(appId, formsRequest)
  }
  return formsRequest
}

export async function getAppForm(appId: string, name: string): Promise<AppForm> {
  const key = detailKey(appId, name)
  let formRequest = formCache.get(key)
  if (!formRequest) {
    formRequest = requestJson<AppForm>(`${API_BASE}/${appId}/forms/${encodeURIComponent(name)}`)
      .then(normalizeForm)
      .catch((caught: unknown) => {
        formCache.delete(key)
        throw caught
      })
    formCache.set(key, formRequest)
  }
  return formRequest
}

function invalidateFormCaches(appId: string, name?: string) {
  formListCache.delete(appId)
  if (name) {
    formCache.delete(detailKey(appId, name))
  }
  invalidateAppMenuTargets(appId)
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

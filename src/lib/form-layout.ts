import type { EntityField } from '@/data/mock'

export type FormFieldWidth = 25 | 33 | 50 | 66 | 75 | 100

export const formFieldWidthOptions = [25, 33, 50, 66, 75, 100] as const

export const formFieldWidthClasses: Record<FormFieldWidth, string> = {
  25: 'md:col-span-3',
  33: 'md:col-span-4',
  50: 'md:col-span-6',
  66: 'md:col-span-8',
  75: 'md:col-span-9',
  100: 'md:col-span-12',
}

export type StoredFormFieldWidths = Record<string, FormFieldWidth>

export const formDividerPrefix = '$DIVIDER$-'

export function isFormDividerField(name: string) {
  return name.startsWith(formDividerPrefix)
}

export interface FormItemProperties {
  label?: string
  tip?: string
  required?: boolean
  readonly?: boolean
  hidden?: boolean
}

export interface StoredCustomField {
  name: string
  label: string
  type: string
  options?: EntityField['options']
  refEntity?: string
}

export interface StoredFormLayout {
  fields: string[]
  widths: StoredFormFieldWidths
  properties?: Record<string, FormItemProperties>
  customFields?: StoredCustomField[]
}

export function getStoredFormLayout(entity: string): StoredFormLayout | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(`form-layout-${entity}`) ?? 'null')
    if (!value || typeof value !== 'object' || !Array.isArray(value.fields)) return null
    const rawWidths = typeof value.widths === 'object' && value.widths !== null ? value.widths : {}
    return {
      fields: value.fields.filter((name: unknown): name is string => typeof name === 'string'),
      widths: Object.fromEntries(
        Object.entries(rawWidths).filter(([, width]) => parseWidth(width)),
      ) as StoredFormFieldWidths,
      properties:
        typeof value.properties === 'object' && value.properties !== null
          ? value.properties as Record<string, FormItemProperties>
          : {},
      customFields: Array.isArray(value.customFields)
        ? value.customFields.filter((field: unknown): field is StoredCustomField =>
            Boolean(field) && typeof field === 'object' &&
            typeof (field as StoredCustomField).name === 'string' &&
            typeof (field as StoredCustomField).label === 'string' &&
            typeof (field as StoredCustomField).type === 'string',
          )
        : [],
    }
  } catch {
    return null
  }
}

export function saveStoredFormLayout(entity: string, layout: StoredFormLayout) {
  window.localStorage.setItem(
    `form-layout-${entity}`,
    JSON.stringify({
      fields: layout.fields,
      widths: layout.widths,
      properties: layout.properties ?? {},
      customFields: layout.customFields ?? [],
    }),
  )
}

function parseWidth(value: unknown): value is FormFieldWidth {
  return formFieldWidthOptions.includes(value as FormFieldWidth)
}

export function getStoredFormFieldWidths(entity: string): StoredFormFieldWidths {
  try {
    const value = JSON.parse(window.localStorage.getItem(`form-field-widths-${entity}`) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter(([, width]) => parseWidth(width)),
    ) as StoredFormFieldWidths
  } catch {
    return {}
  }
}

export function saveStoredFormFieldWidths(entity: string, widths: StoredFormFieldWidths) {
  window.localStorage.setItem(`form-field-widths-${entity}`, JSON.stringify(widths))
}

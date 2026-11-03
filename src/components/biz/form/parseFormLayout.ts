import type {
  AppForm,
  AppFormControl,
  AppFormField,
  AppFormItem,
  AppFormScene,
} from '@/services/appForms'
import {matchesFilterCondition} from '@/lib/filterCondition'

export type FormLayoutEntry =
  | { kind: 'SECTION'; key: string; label: string }
  | { kind: 'SUBFORM'; key: string; item: AppFormItem }
  | {
  kind: 'FIELD'
  key: string
  field: AppFormField
  item: AppFormItem
  readonly: boolean
  required: boolean
}

export interface FormLayoutSection {
  key: string
  label: string
  fields: Array<{ field: AppFormField; item: AppFormItem }>
}

export interface ParsedFormLayout {
  entries: FormLayoutEntry[]
  sections: FormLayoutSection[]
  subformItems: Array<{ key: string; item: AppFormItem }>
  renderableFieldNames: Set<string>
  requiredFieldNames: Set<string>
}

export type FormLayoutFieldEntry = Extract<FormLayoutEntry, { kind: 'FIELD' }>

export interface FormLayoutFieldGroup {
  key: string
  section: { key: string; label: string } | null
  fields: FormLayoutFieldEntry[]
}

/**
 * 按分栏（SECTION）把字段分组，供记录表单与详情统一渲染缩进。
 * 分栏标题单独成组；分栏之前的字段归入 section 为 null 的默认组；子表单不参与分组。
 */
export function groupFormLayoutFields(entries: FormLayoutEntry[]): FormLayoutFieldGroup[] {
  const groups: FormLayoutFieldGroup[] = []
  let current: FormLayoutFieldGroup | null = null
  for (const entry of entries) {
    if (entry.kind === 'SUBFORM') continue
    if (entry.kind === 'SECTION') {
      current = {key: entry.key, section: {key: entry.key, label: entry.label}, fields: []}
      groups.push(current)
      continue
    }
    if (!current) {
      current = {key: 'default', section: null, fields: []}
      groups.push(current)
    }
    current.fields.push(entry)
  }
  return groups
}

function controlActive(control: AppFormControl | undefined, scene: AppFormScene | undefined,
                       values: Record<string, unknown>) {
  return Boolean(control && scene && control.scenes?.includes(scene)
    && (!control.condition || matchesFilterCondition(control.condition, values)))
}

/**
 * 解析表单布局：新增/编辑弹窗与详情页共用的布局解析逻辑。
 * layout 为空时回退为全部非内置字段；隐藏字段与 excludeField（子表单引用字段）不参与渲染与校验。
 * 传入 scene 与 values 时按 layout.controls 计算隐藏、必填和只读；否则沿用布局项上的静态设置。
 */
export function parseFormLayout(
  form: AppForm,
  options?: { excludeField?: string; scene?: AppFormScene; values?: Record<string, unknown> },
): ParsedFormLayout {
  const fieldsByName = new Map(form.fields.map((field) => [field.name, field]))
  const excludeField = options?.excludeField
  const scene = options?.scene
  const values = options?.values ?? {}
  const controls = form.layout.controls ?? {}
  const layoutItems: AppFormItem[] = form.layout.items.length
    ? form.layout.items
    : form.fields
      .filter((field) => !field.builtin)
      .map((field) => ({type: 'FIELD' as const, name: field.name}))

  const entries: FormLayoutEntry[] = []
  const sections: FormLayoutSection[] = [{key: 'default', label: form.label, fields: []}]
  const subformItems: Array<{ key: string; item: AppFormItem }> = []
  const renderableFieldNames = new Set<string>()
  const requiredFieldNames = new Set<string>()

  layoutItems.forEach((item, index) => {
    if (item.type === 'SECTION') {
      const label = item.label?.trim() || '分栏'
      entries.push({kind: 'SECTION', key: `section-${index}`, label})
      sections.push({key: `section-${index}`, label, fields: []})
      return
    }
    if (item.type === 'SUBFORM') {
      const key = `subform-${index}`
      entries.push({kind: 'SUBFORM', key, item})
      subformItems.push({key, item})
      return
    }
    const field = item.name ? fieldsByName.get(item.name) : undefined
    if (!field || item.name === excludeField) return
    const control = controls[field.name]
    const hidden = !field.builtin
      && ((form.builtin && Boolean(item.hidden)) || controlActive(control?.hidden, scene, values))
    if (hidden) return
    const readonly = field.builtin
      || (form.builtin && Boolean(item.readonly))
      || controlActive(control?.readonly, scene, values)
    const required = field.required || (!field.builtin && controlActive(control?.required, scene, values))
    entries.push({kind: 'FIELD', key: field.name, field, item, readonly, required})
    sections[sections.length - 1].fields.push({field, item})
    renderableFieldNames.add(field.name)
    if (field.required || (required && !readonly)) requiredFieldNames.add(field.name)
  })

  return {entries, sections, subformItems, renderableFieldNames, requiredFieldNames}
}

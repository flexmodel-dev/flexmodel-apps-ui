import type {AppForm, AppFormField, AppFormItem} from '@/services/appForms'

export type FormLayoutEntry =
  | { kind: 'SECTION'; key: string; label: string }
  | { kind: 'SUBFORM'; key: string; item: AppFormItem }
  | { kind: 'FIELD'; key: string; field: AppFormField; item: AppFormItem }

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
}

/**
 * 解析表单布局：新增/编辑弹窗与详情页共用的布局解析逻辑。
 * layout 为空时回退为全部非内置字段；hidden 字段与 excludeField（子表单引用字段）不参与渲染与校验。
 */
export function parseFormLayout(form: AppForm, options?: { excludeField?: string }): ParsedFormLayout {
  const fieldsByName = new Map(form.fields.map((field) => [field.name, field]))
  const excludeField = options?.excludeField
  const layoutItems: AppFormItem[] = form.layout.items.length
    ? form.layout.items
    : form.fields
      .filter((field) => !field.builtin)
      .map((field) => ({type: 'FIELD' as const, name: field.name}))

  const entries: FormLayoutEntry[] = []
  const sections: FormLayoutSection[] = [{key: 'default', label: form.label, fields: []}]
  const subformItems: Array<{ key: string; item: AppFormItem }> = []
  const renderableFieldNames = new Set<string>()

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
    if (!field || item.hidden || item.name === excludeField) return
    entries.push({kind: 'FIELD', key: field.name, field, item})
    sections[sections.length - 1].fields.push({field, item})
    renderableFieldNames.add(field.name)
  })

  return {entries, sections, subformItems, renderableFieldNames}
}

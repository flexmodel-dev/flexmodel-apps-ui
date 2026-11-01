import {describe, expect, it} from 'vitest'
import type {AppForm, AppFormField} from '@/services/appForms'
import {
  allDisplayFieldNames,
  clampViewPage,
  countFilterConditions,
  defaultConditionValue,
  defaultViewConfig,
  effectiveDisplayFields,
  groupKeyForRecord,
  groupKeyForValue,
  recordFieldText,
  viewPageCount,
  viewTitleValue,
  viewTypeAvailability,
} from '@/components/biz/views/viewUtils'

function field(name: string, type: AppFormField['type'], extra: Partial<AppFormField> = {}): AppFormField {
  return {name, label: name, type, required: false, builtin: false, ...extra}
}

const form: AppForm = {
  name: 'demo',
  label: '示例',
  description: '',
  displayField: 'title',
  searchField: 'title',
  managed: false,
  builtin: false,
  fields: [
    field('title', 'TEXT'),
    field('status', 'SELECT', {options: [{id: 'todo', text: '待办'}, {id: 'done', text: '完成'}]}),
    field('start', 'DATE'),
    field('end', 'DATE'),
    field('parent', 'REFERENCE', {referenceForm: 'demo'}),
    field('cover', 'IMAGE'),
    field('created_at', 'DATETIME', {builtin: true}),
  ],
  layout: {items: [{type: 'FIELD', name: 'title'}, {type: 'FIELD', name: 'status'}]},
  viewTabs: [],
}

describe('viewUtils', () => {
  it('默认显示字段优先使用表单布局顺序', () => {
    expect(allDisplayFieldNames(form)).toEqual(['title', 'status'])
    expect(effectiveDisplayFields(form, {
      id: 'v1', label: '视图', type: 'TABLE', filter: null, sort: null, displayFields: [], config: {},
    })).toEqual(['title', 'status'])
  })

  it('按类型自动挑选可用的专属字段', () => {
    expect(defaultViewConfig(form, 'KANBAN').groupField).toBe('status')
    expect(defaultViewConfig(form, 'CALENDAR')).toMatchObject({startField: 'start', endField: 'end'})
    expect(defaultViewConfig(form, 'HIERARCHY').parentField).toBe('parent')
    expect(defaultViewConfig(form, 'GALLERY').coverField).toBe('cover')
    expect(defaultViewConfig(form, 'GANTT')).toMatchObject({startField: 'start', endField: 'end', ganttScale: 'WEEK'})
  })

  it('视图类型可用性反映表单字段能力', () => {
    const availability = viewTypeAvailability(form)
    expect(availability.TABLE.enabled).toBe(true)
    expect(availability.KANBAN.enabled).toBe(true)
    expect(availability.CALENDAR.enabled).toBe(true)
    expect(availability.GANTT.enabled).toBe(true)
    expect(availability.HIERARCHY.enabled).toBe(true)
    expect(viewTypeAvailability({...form, fields: [field('title', 'TEXT')]}).KANBAN.enabled).toBe(false)
    expect(viewTypeAvailability({...form, fields: [field('title', 'TEXT')]}).GANTT.reason).toContain('同类型')
  })

  it('选项筛选默认值使用选项 id', () => {
    const status = form.fields.find((item) => item.name === 'status')!
    expect(defaultConditionValue(status)).toBe('todo')
    expect(defaultConditionValue(field('flag', 'BOOL'))).toBe(false)
  })

  it('关联值优先使用 displayValue 展示', () => {
    const parent = form.fields.find((item) => item.name === 'parent')!
    expect(recordFieldText(parent, {id: 'r1', displayValue: '父记录'})).toBe('父记录')
    expect(recordFieldText(parent, 'r2')).toBe('r2')
  })

  it('分页计算稳定并带下限', () => {
    expect(viewPageCount(0, 30)).toBe(1)
    expect(viewPageCount(61, 30)).toBe(3)
    expect(clampViewPage(9, 61, 30)).toBe(3)
    expect(clampViewPage(0, 61, 30)).toBe(1)
  })

  it('筛选条件数量同时支持全部/任一结构', () => {
    expect(countFilterConditions(null)).toBe(0)
    expect(countFilterConditions({_and: [{title: {_eq: 'a'}}]})).toBe(1)
    expect(countFilterConditions({_or: [{title: {_eq: 'a'}}, {title: {_eq: 'b'}}]})).toBe(2)
  })

  it('分组 key 对空值、布尔和引用对象稳定', () => {
    expect(groupKeyForValue(undefined)).toBe('ungrouped')
    expect(groupKeyForValue(false)).toBe('group-false')
    expect(groupKeyForValue('done')).toBe('group-"done"')
    expect(groupKeyForRecord('status', {id: 'r1', status: 'done'})).toBe('group-"done"')
    expect(groupKeyForRecord('parent', {id: 'r1', parent: {id: 'p1', displayValue: '父'}})).toBe('group-"p1"')
  })

  it('标题字段缺失时回退到未命名', () => {
    const view = {
      id: 'v1',
      label: '视图',
      type: 'TABLE' as const,
      filter: null,
      sort: null,
      displayFields: [],
      config: {}
    }
    expect(viewTitleValue(form, view, {id: 'r1', title: '标题'})).toBe('标题')
    expect(viewTitleValue(form, view, {id: 'r1'})).toBe('未命名')
  })
})

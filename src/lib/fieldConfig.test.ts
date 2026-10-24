import {describe, expect, it} from 'vitest'
import type {AppForm, AppFormField} from '@/services/appForms'
import {fieldDefaultValue, fieldValueError, formatFieldValue, isFieldWritable} from './fieldConfig'
import {buildRecordPayload, initialCreateValues, toEditValues} from '@/components/biz/form/recordPayload'

function field(type: AppFormField['type'], config: AppFormField['config'] = {}): AppFormField {
  return {name: 'value', label: '值', type, required: false, builtin: false, config}
}
function form(fields: AppFormField[]): AppForm {
  return {name: 'test', label: '测试', description: '', managed: true, builtin: false,
    fields, layout: {items: []}, viewTabs: []}
}

describe('字段配置', () => {
  it('保留 false、0 默认值与空布尔，当前时间使用本地日期', () => {
    expect(fieldDefaultValue(field('BOOL', {defaultValue: false}))).toBe(false)
    expect(fieldDefaultValue(field('NUMBER', {defaultValue: 0}))).toBe(0)
    expect(fieldDefaultValue(field('BOOL'))).toBe('')
    expect(fieldDefaultValue(field('DATETIME', {defaultNow: true}), new Date(2026, 9, 24, 12, 30, 5))).toBe('2026-10-24T12:30:05')
    expect(toEditValues(form([field('BOOL')]), {value: null})).toEqual({value: ''})
  })

  it('多选使用全部默认选项并按数组提交，必填空数组被拒绝', () => {
    const multi = {...field('MULTISELECT'), required: true,
      options: [{id: 'a', text: '甲', defaultSelected: true}, {id: 'b', text: '乙', defaultSelected: true}]}
    expect(initialCreateValues(form([multi]))).toEqual({value: ['a', 'b']})
    expect(buildRecordPayload(form([multi]), new Set(['value']), {value: ['a', 'b']}, () => {})).toEqual({value: ['a', 'b']})
    expect(fieldValueError(multi, [])).toBe('值不能为空')
    expect(formatFieldValue(multi, ['a', 'b'])).toBe('甲、乙')
  })

  it('阻止无效数值并保留空布尔，不生成 NaN', () => {
    const decimal = field('DECIMAL', {allowNegative: false, decimalPlaces: 2})
    expect(fieldValueError(decimal, '-1')).toBe('值不允许负数')
    expect(fieldValueError(decimal, '1.234')).toBe('值最多允许2位小数')
    expect(fieldValueError(decimal, 'NaN')).toBe('值必须是有效数字')
    expect(fieldValueError(decimal, '0')).toBeNull()
    expect(buildRecordPayload(form([field('BOOL')]), new Set(['value']), {value: ''}, () => {})).toEqual({value: null})
  })

  it('新建和编辑分别遵守写入限制', () => {
    const restricted = field('TEXT', {creatable: true, updatable: false})
    expect(isFieldWritable(restricted, true)).toBe(true)
    expect(isFieldWritable(restricted, false)).toBe(false)
    expect(buildRecordPayload(form([restricted]), new Set(['value']), {value: '保留'}, () => {}, false)).toEqual({})
  })

  it('列表和详情的格式不丢精度，前后缀不改变原始值', () => {
    expect(formatFieldValue(field('DECIMAL', {decimalPlaces: 2, prefix: '¥', suffix: '元'}), 1234.5)).toBe('¥1,234.50元')
    expect(formatFieldValue(field('DECIMAL', {thousandsSeparator: false}), 1234.56789)).toBe('1234.56789')
    expect(formatFieldValue(field('DATE', {dateFormat: 'yyyy/MM/dd'}), '2026-10-24')).toBe('2026/10/24')
    expect(formatFieldValue(field('TIME', {dateFormat: 'HH:mm'}), '12:30:05')).toBe('12:30')
    expect(formatFieldValue(field('BOOL'), false)).toBe('否')
    expect(formatFieldValue(field('NUMBER'), 0)).toBe('0')
  })
})

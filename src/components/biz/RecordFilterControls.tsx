import {Input} from '@/components/ui/input'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import type {AppFormField, AppViewFilterOperator, AppViewFilterValue} from '@/services/appForms'
import {defaultConditionValue, FIELD_TYPE_LABELS} from '@/components/biz/views/viewUtils'
import {cn} from '@/lib/utils'

export interface ViewTabConditionDraft {
  fieldName: string
  operator: AppViewFilterOperator
  value: AppViewFilterValue
}

export const viewTabOperatorLabels: Record<AppViewFilterOperator, string> = {
  _eq: '等于',
  _ne: '不等于',
  _contains: '包含',
  _not_contains: '不包含',
  _starts_with: '开头是',
  _ends_with: '结尾是',
  _gt: '大于',
  _gte: '大于等于',
  _lt: '小于',
  _lte: '小于等于',
}

export function viewTabOperators(field: AppFormField): AppViewFilterOperator[] {
  switch (field.type) {
    case 'NUMBER':
    case 'DECIMAL':
    case 'DATE':
    case 'DATETIME':
    case 'TIME':
      return ['_eq', '_ne', '_gt', '_gte', '_lt', '_lte']
    case 'BOOL':
    case 'PICKLIST':
    case 'SELECT':
    case 'CLASSIFICATION':
    case 'MULTISELECT':
    case 'REFERENCE':
      return ['_eq', '_ne']
    default:
      return ['_eq', '_ne', '_contains', '_not_contains', '_starts_with', '_ends_with']
  }
}

export function fieldTypeLabel(field: AppFormField): string {
  return FIELD_TYPE_LABELS[field.type] ?? field.type
}

function viewTabInputType(field: AppFormField) {
  if (field.type === 'NUMBER' || field.type === 'DECIMAL') return 'number'
  if (field.type === 'DATE') return 'date'
  if (field.type === 'DATETIME') return 'datetime-local'
  if (field.type === 'TIME') return 'time'
  return 'text'
}

/** 筛选值控件；选项字段必须提交选项 id，展示文本仅用于显示。 */
export function ConditionValueControl({
                                        field,
                                        value,
                                        onChange,
                                        className,
                                      }: {
  field: AppFormField
  value: AppViewFilterValue
  onChange: (value: AppViewFilterValue) => void
  className?: string
}) {
  const controlClass = className ?? 'w-[180px]'
  if (field.type === 'BOOL') {
    return (
      <Select value={String(value)} onValueChange={(nextValue) => onChange(nextValue === 'true')}>
        <SelectTrigger className={cn('h-8', controlClass)} aria-label={`${field.label} 筛选值`}>
          <SelectValue placeholder="请选择"/>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">是</SelectItem>
          <SelectItem value="false">否</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  if (field.options?.length) {
    return (
      <Select value={String(value ?? '')} onValueChange={onChange}>
        <SelectTrigger className={cn('h-8', controlClass)} aria-label={`${field.label} 筛选值`}>
          <SelectValue placeholder="请选择"/>
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option) => {
            const optionValue = option.id ?? option.text ?? ''
            return (
              <SelectItem key={optionValue} value={optionValue}>
                {option.text ?? optionValue}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    )
  }
  return (
    <Input
      type={viewTabInputType(field)}
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
      className={cn('h-8', controlClass)}
      placeholder={field.type === 'REFERENCE' ? '记录 ID' : undefined}
      aria-label={`${field.label} 筛选值`}
    />
  )
}

export {defaultConditionValue}

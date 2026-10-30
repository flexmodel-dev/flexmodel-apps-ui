import {Input} from '@/components/ui/input'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import type {AppFormField, AppViewFilterOperator, AppViewFilterValue} from '@/services/appForms'

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

function viewTabInputType(field: AppFormField) {
  if (field.type === 'NUMBER' || field.type === 'DECIMAL') return 'number'
  if (field.type === 'DATE') return 'date'
  if (field.type === 'DATETIME') return 'datetime-local'
  if (field.type === 'TIME') return 'time'
  return 'text'
}

export function ConditionValueControl({
                                        field,
                                        value,
                                        onChange,
                                      }: {
  field: AppFormField
  value: AppViewFilterValue
  onChange: (value: AppViewFilterValue) => void
}) {
  if (field.type === 'BOOL') {
    return (
      <Select value={String(value)} onValueChange={(nextValue) => onChange(nextValue === 'true')}>
        <SelectTrigger className="h-8 w-[180px]">
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
      <Select value={String(value)} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[180px]">
          <SelectValue placeholder="请选择"/>
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option) => {
            const optionValue = option.text ?? option.id ?? ''
            return (
              <SelectItem key={option.id ?? optionValue} value={optionValue}>
                {optionValue}
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
      className="h-8 w-[180px]"
      placeholder={field.type === 'REFERENCE' ? '记录 ID' : undefined}
    />
  )
}


import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {viewTabOperatorLabels, viewTabOperators} from '@/components/biz/RecordFilterControls'
import type {AppFormField, FilterCondition} from '@/services/appForms'
import {cn} from '@/lib/utils'

export type FilterConditionValueType = 'literal' | 'currentUser' | 'field'

const operators: Record<string, string> = {
  ...viewTabOperatorLabels,
  _between: '介于',
  _in: '属于',
  _nin: '不属于',
  IS_NULL: '为空',
  IS_NOT_NULL: '不为空'
}
const valueTypeLabels: Record<FilterConditionValueType, string> = {
  literal: '固定值',
  currentUser: '当前用户',
  field: '字段引用'
}
const triggerClass = (className: string) => cn('h-9', className)

const emptyLeaf = (field: string): FilterCondition => ({[field]: {_eq: ''}})
const storeOperator = (operator: string) => operator === 'IS_NULL' ? '_eq' : operator === 'IS_NOT_NULL' ? '_ne' : operator
const defaultOperand = (operator: string): unknown => operator === 'IS_NULL' || operator === 'IS_NOT_NULL' ? null : ['_in', '_nin', '_between'].includes(operator) ? [] : ''

/** 与服务端 AppPermissionConditions.requireCompatible 保持一致的类型兼容规则。 */
function typesCompatible(left: AppFormField, right: AppFormField) {
  if (left.type === right.type) return true
  const referenceText = (reference: AppFormField, other: AppFormField) =>
    reference.type === 'REFERENCE' && (other.type === 'TEXT' || other.builtin && other.name === 'id')
  return referenceText(left, right) || referenceText(right, left)
}

function fieldReferenceGroups(field: AppFormField, fields: AppFormField[],
                              resolveFormFields?: (formName: string) => AppFormField[]) {
  const groups: Array<{ label: string; items: Array<{ value: string; label: string }> }> = [{
    label: '本表字段',
    items: fields.filter(item => item.name !== field.name && typesCompatible(item, field))
      .map(item => ({value: item.name, label: item.label}))
  }]
  for (const ref of fields.filter(item => item.type === 'REFERENCE' && item.referenceForm)) {
    const items = (resolveFormFields?.(ref.referenceForm!) ?? [])
      .filter(target => typesCompatible(field, target))
      .map(target => ({value: `${ref.name}.${target.name}`, label: `${ref.label} · ${target.label}`}))
    if (items.length) groups.push({label: ref.label, items})
  }
  return groups.filter(group => group.items.length > 0)
}

export function FilterConditionEditor({fields, value, onChange, valueTypes = ['literal'], resolveFormFields}: {
  fields: AppFormField[];
  value?: FilterCondition | null;
  onChange: (value: FilterCondition | null) => void;
  valueTypes?: FilterConditionValueType[];
  resolveFormFields?: (formName: string) => AppFormField[]
}) {
  if (!value) return <Button type="button" variant="secondary" size="sm"
                             onClick={() => onChange(emptyLeaf(fields[0]?.name ?? ''))}>添加条件</Button>
  if ('_and' in value || '_or' in value) {
    const logic = '_or' in value ? '_or' : '_and'
    const children = Array.isArray(value[logic]) ? value[logic] as FilterCondition[] : []
    return <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Select value={logic} onValueChange={next => onChange({[next]: children})}>
          <SelectTrigger aria-label="条件组合方式" className={triggerClass('w-28')}>
            <SelectValue/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_and">全部满足</SelectItem>
            <SelectItem value="_or">任一满足</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="secondary" size="sm"
                onClick={() => onChange({[logic]: [...children, emptyLeaf(fields[0]?.name ?? '')]})}>添加条件</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>清除</Button></div>
      {children.map((child, index) => <FilterConditionEditor key={index} fields={fields} value={child}
                                                             valueTypes={valueTypes}
                                                             resolveFormFields={resolveFormFields}
                                                             onChange={next => {
                                                               const nextChildren = next ? children.map((item, i) => i === index ? next : item) : children.filter((_, i) => i !== index)
                                                               onChange(nextChildren.length ? {[logic]: nextChildren} : null)
                                                             }}/>)
      }
    </div>
  }
  const field = Object.keys(value).find(key => fields.some(item => item.name === key)) ?? fields[0]?.name ?? ''
  const fieldDef = fields.find(item => item.name === field)
  const raw = value[field]
  const ops = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {_eq: raw}
  const stored = Object.keys(ops).find(key => key.startsWith('_')) ?? '_eq'
  const operand = ops[stored]
  const dynamic = operand && typeof operand === 'object' && !Array.isArray(operand) ? operand as Record<string, unknown> : null
  const valueKind: FilterConditionValueType = dynamic && typeof dynamic._field === 'string' && dynamic._field
    ? 'field' : dynamic && '_user' in dynamic ? 'currentUser' : 'literal'
  const refPath = valueKind === 'field' && dynamic ? String(dynamic._field ?? '') : ''
  const operator = operand == null && (stored === '_eq' || stored === '_ne') ? (stored === '_eq' ? 'IS_NULL' : 'IS_NOT_NULL') : stored
  const type = fieldDef?.type
  const comparable = ['NUMBER', 'DECIMAL', 'DATE', 'DATETIME', 'TIME'].includes(type ?? '')
  const choices = [...(fieldDef ? viewTabOperators(fieldDef) : Object.keys(viewTabOperatorLabels)),
    '_in', '_nin', ...(comparable ? ['_between'] : []), 'IS_NULL', 'IS_NOT_NULL']
  const isSet = operator === '_in' || operator === '_nin' || operator === '_between'
  const isNull = operator === 'IS_NULL' || operator === 'IS_NOT_NULL'
  const groups = valueTypes.includes('field') && fieldDef ? fieldReferenceGroups(fieldDef, fields, resolveFormFields) : []
  const offeredTypes = valueTypes.filter(kind =>
    kind === 'literal' || (kind === 'currentUser' && ['REFERENCE', 'TEXT'].includes(type ?? '')) || (kind === 'field' && groups.length > 0))
  const structured = offeredTypes.length > 1 && (operator === '_eq' || operator === '_ne') && !isNull
  const convert = (input: string) => type === 'BOOL' ? input === 'true' : (type === 'NUMBER' || type === 'DECIMAL') && input !== '' ? Number(input) : input
  const text = isSet ? (Array.isArray(operand) ? operand.join(',') : '') : operand == null ? '' : String(operand)
  const apply = (op: string, operandValue: unknown) => onChange({[field]: {[storeOperator(op)]: operandValue}})
  const switchValueType = (kind: FilterConditionValueType) => {
    if (kind === valueKind) return
    if (kind === 'literal') return apply(operator, defaultOperand(operator))
    if (kind === 'currentUser') return apply(operator, {_user: 'id'})
    const path = groups[0]?.items[0]?.value
    if (path) apply(operator, {_field: path})
  }
  return <div className="flex flex-wrap items-center gap-2">
    <Select value={field} onValueChange={next => onChange(emptyLeaf(next))}>
      <SelectTrigger aria-label="条件字段" className={triggerClass('w-40')}>
        <SelectValue/>
      </SelectTrigger>
      <SelectContent>
        {fields.map(item => <SelectItem key={item.name} value={item.name}>{item.label}</SelectItem>)}
      </SelectContent>
    </Select>
    <Select value={operator} onValueChange={next => apply(next, defaultOperand(next))}>
      <SelectTrigger aria-label="比较方式" className={triggerClass('w-28')}>
        <SelectValue/>
      </SelectTrigger>
      <SelectContent>
        {choices.map(key => <SelectItem key={key} value={key}>{operators[key]}</SelectItem>)}
      </SelectContent>
    </Select>
    {structured && <Select value={valueKind} onValueChange={next => switchValueType(next as FilterConditionValueType)}>
      <SelectTrigger aria-label="值类型" className={triggerClass('w-24')}>
        <SelectValue/>
      </SelectTrigger>
      <SelectContent>
        {offeredTypes.map(kind => <SelectItem key={kind} value={kind}>{valueTypeLabels[kind]}</SelectItem>)}
      </SelectContent>
    </Select>}
    {valueKind === 'currentUser' ? null : valueKind === 'field'
      ? <Select value={refPath} onValueChange={next => apply(operator, {_field: next})}>
        <SelectTrigger aria-label="引用字段路径" className={triggerClass('w-52')}>
          <SelectValue/>
        </SelectTrigger>
        <SelectContent>
          {groups.map(group => <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectGroup>)}
        </SelectContent>
      </Select>
      : !isNull && (type === 'BOOL' && !isSet
      ? <Select value={text} onValueChange={next => apply(operator, next === 'true')}>
        <SelectTrigger aria-label="比较值" className={triggerClass('w-24')}>
          <SelectValue placeholder="请选择"/>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">是</SelectItem>
          <SelectItem value="false">否</SelectItem>
        </SelectContent>
      </Select>
      : <Input aria-label="比较值" className="w-40"
               placeholder={isSet ? (operator === '_between' ? '两个值用逗号分隔' : '多个值用逗号分隔') : '比较值'}
               value={text}
               onChange={e => apply(operator, isSet ? e.target.value.split(',').map(item => convert(item.trim())) : convert(e.target.value))}/>)}
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange({
      _and: [value, emptyLeaf(fields[0]?.name ?? '')]
    })}>组合条件</Button>
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>移除</Button>
  </div>
}

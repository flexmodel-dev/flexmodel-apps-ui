import * as React from 'react'
import {Plus, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {PopoverContent} from '@/components/ui/popover'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import type {AppFormField, AppViewFilterOperator} from '@/services/appForms'
import {
  ConditionValueControl,
  defaultConditionValue,
  type ViewTabConditionDraft,
  viewTabOperatorLabels,
  viewTabOperators
} from './RecordFilterControls'

export interface RecordQuery {
  logic: '_and' | '_or'
  conditions: ViewTabConditionDraft[]
  filter: string
}

export function buildRecordQuery(fields: AppFormField[], logic: RecordQuery['logic'], conditions: ViewTabConditionDraft[]): RecordQuery | null {
  if (!conditions.length) return null
  if (conditions.length > 10) throw new Error('最多添加 10 个查询条件')
  const filters = conditions.map(condition => {
    const field = fields.find(item => item.name === condition.fieldName)
    if (!field || !viewTabOperators(field).includes(condition.operator)) throw new Error('查询字段或操作符无效')
    let value = condition.value
    if (typeof value === 'string') value = value.trim()
    if (value === '' || value == null) throw new Error(`请填写「${field.label}」的查询值`)
    if (field.type === 'NUMBER' || field.type === 'DECIMAL') {
      value = Number(value)
      if (!Number.isFinite(value)) throw new Error(`「${field.label}」需要有效数字`)
    }
    if (field.type === 'BOOL' && typeof value !== 'boolean') throw new Error(`请选择「${field.label}」的查询值`)
    return {[field.name]: {[condition.operator]: value}}
  })
  return {logic, conditions: conditions.map(item => ({...item})), filter: JSON.stringify({[logic]: filters})}
}

export function RecordQueryPopover({open, onOpenChange, fields, value, onApply}: {
  open: boolean; onOpenChange: (open: boolean) => void; fields: AppFormField[]
  value: RecordQuery | null; onApply: (value: RecordQuery | null) => void
}) {
  const [logic, setLogic] = React.useState<RecordQuery['logic']>('_and')
  const [conditions, setConditions] = React.useState<ViewTabConditionDraft[]>([])
  const [error, setError] = React.useState('')
  React.useEffect(() => {
    if (!open) return
    setLogic(value?.logic ?? '_and')
    setConditions(value?.conditions.map(item => ({...item})) ?? [])
    setError('')
  }, [open, value])
  const update = (index: number, condition: ViewTabConditionDraft) => {
    setConditions(previous => previous.map((item, i) => i === index ? condition : item))
    setError('')
  }
  const apply = () => {
    try {
      onApply(buildRecordQuery(fields, logic, conditions))
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '查询条件无效')
    }
  }
  return <PopoverContent align="end" sideOffset={8} aria-label="高级查询条件"
                         className="w-[680px] max-w-[calc(100vw-24px)] p-0">
    <div className="border-b px-4 py-3 text-sm font-medium">高级查询</div>
    <div className="max-h-[min(60vh,520px)] overflow-y-auto p-4">
      <div className="space-y-4 text-foreground">
        <div className="flex items-center gap-2 text-sm">
          <span>筛选满足</span>
          <Select value={logic} onValueChange={next => setLogic(next as RecordQuery['logic'])}>
            <SelectTrigger aria-label="条件关系" className="h-8 w-32"><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="_and">全部条件</SelectItem><SelectItem
              value="_or">任一条件</SelectItem></SelectContent>
          </Select><span>的记录</span>
        </div>
        {conditions.map((condition, index) => {
          const field = fields.find(item => item.name === condition.fieldName)
          return <div key={index} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
            <Select value={condition.fieldName} onValueChange={name => {
              const nextField = fields.find(item => item.name === name)
              update(index, {
                fieldName: name,
                operator: '_eq',
                value: nextField ? defaultConditionValue(nextField) : '',
              })
            }}>
              <SelectTrigger aria-label={`查询字段 ${index + 1}`} className="h-8 w-[150px]"><SelectValue
                placeholder="字段"/></SelectTrigger>
              <SelectContent>{fields.map(item => <SelectItem key={item.name}
                                                             value={item.name}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
            {field && <>
              <Select value={condition.operator} onValueChange={operator => update(index, {
                ...condition,
                operator: operator as AppViewFilterOperator
              })}>
                <SelectTrigger aria-label={`查询操作符 ${index + 1}`}
                               className="h-8 w-[120px]"><SelectValue/></SelectTrigger>
                <SelectContent>{viewTabOperators(field).map(operator => <SelectItem key={operator}
                                                                                    value={operator}>{viewTabOperatorLabels[operator]}</SelectItem>)}</SelectContent>
              </Select>
              <ConditionValueControl field={field} value={condition.value}
                                     onChange={next => update(index, {...condition, value: next})}/>
            </>}
            <Button variant="ghost" size="icon" aria-label={`删除查询条件 ${index + 1}`} className="h-8 w-8"
                    onClick={() => setConditions(previous => previous.filter((_, i) => i !== index))}><Trash2
              className="h-4 w-4"/></Button>
          </div>
        })}
        {!conditions.length && <p
          className="text-muted-foreground">{fields.length ? '添加条件以筛选记录，最多 10 个条件。' : '当前表单暂无可筛选字段'}</p>}
        <Button variant="outline" size="sm" disabled={!fields.length || conditions.length >= 10} onClick={() => {
          const field = fields[0]
          if (field) setConditions(previous => [...previous, {
            fieldName: field.name,
            operator: '_eq',
            value: defaultConditionValue(field),
          }])
        }}><Plus className="h-4 w-4"/>添加条件</Button>
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
    </div>
    <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
      <Button variant="ghost" size="sm" className="mr-auto" onClick={() => {
        onApply(null);
        onOpenChange(false)
      }}>清空查询</Button>
      <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
      <Button size="sm" onClick={apply}>应用查询</Button>
    </div>
  </PopoverContent>
}

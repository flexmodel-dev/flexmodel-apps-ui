import * as React from 'react'
import {Plus, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import type {AppFormField} from '@/services/appForms'
import {
  ConditionValueControl,
  defaultConditionValue,
  type ViewTabConditionDraft,
  viewTabOperatorLabels,
  viewTabOperators,
} from '@/components/biz/RecordFilterControls'
import {FieldPicker} from '@/components/biz/views/FieldPicker'
import {MAX_VIEW_FILTER_CONDITIONS} from '@/components/biz/views/viewUtils'

interface Props {
  fields: AppFormField[]
  logic: '_and' | '_or'
  conditions: ViewTabConditionDraft[]
  onChange: (next: { logic: '_and' | '_or'; conditions: ViewTabConditionDraft[] }) => void
}

/** 视图数据筛选编辑器：字段、操作符和值按卡片纵向排列，窄屏不挤压。 */
export function ViewFiltersEditor({fields, logic, conditions, onChange}: Props) {
  const updateCondition = (index: number, condition: ViewTabConditionDraft) => {
    onChange({logic, conditions: conditions.map((item, itemIndex) => (itemIndex === index ? condition : item))})
  }
  const addCondition = () => {
    const field = fields[0]
    if (!field || conditions.length >= MAX_VIEW_FILTER_CONDITIONS) return
    onChange({
      logic,
      conditions: [...conditions, {
        fieldName: field.name,
        operator: '_eq',
        value: defaultConditionValue(field),
      }],
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">筛选满足</span>
        <Select value={logic} onValueChange={(next) => onChange({logic: next as '_and' | '_or', conditions})}>
          <SelectTrigger className="h-8 w-28" aria-label="筛选条件关系"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="_and">全部条件</SelectItem>
            <SelectItem value="_or">任一条件</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">的记录</span>
      </div>
      {!conditions.length && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          未设置筛选条件，视图将显示全部记录
        </p>
      )}
      {conditions.map((condition, index) => {
        const field = fields.find((item) => item.name === condition.fieldName)
        return (
          <div key={index} className="relative space-y-2 rounded-lg border bg-background p-3 pr-10">
            <FieldPicker
              fields={fields}
              value={condition.fieldName}
              placeholder="选择字段"
              onChange={(fieldName) => {
                const nextField = fields.find((item) => item.name === fieldName)
                updateCondition(index, {
                  fieldName: fieldName ?? '',
                  operator: '_eq',
                  value: nextField ? defaultConditionValue(nextField) : '',
                })
              }}
            />
            {field && (
              <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
                <Select
                  value={condition.operator}
                  onValueChange={(operator) => updateCondition(index, {
                    ...condition,
                    operator: operator as ViewTabConditionDraft['operator'],
                  })}
                >
                  <SelectTrigger className="h-8 w-full"
                                 aria-label={`筛选操作符 ${index + 1}`}><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {viewTabOperators(field).map((operator) => (
                      <SelectItem key={operator} value={operator}>{viewTabOperatorLabels[operator]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ConditionValueControl
                  field={field}
                  value={condition.value}
                  onChange={(value) => updateCondition(index, {...condition, value})}
                  className="w-full"
                />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1.5 top-1.5 h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label={`删除筛选条件 ${index + 1}`}
              onClick={() => onChange({logic, conditions: conditions.filter((_, itemIndex) => itemIndex !== index)})}
            >
              <Trash2 className="h-4 w-4"/>
            </Button>
          </div>
        )
      })}
      <Button
        variant="secondary"
        size="sm"
        className="h-8"
        disabled={!fields.length || conditions.length >= MAX_VIEW_FILTER_CONDITIONS}
        onClick={addCondition}
      >
        <Plus className="h-4 w-4"/>添加条件
        {conditions.length >= MAX_VIEW_FILTER_CONDITIONS &&
          <span className="text-xs">（最多 {MAX_VIEW_FILTER_CONDITIONS} 个）</span>}
      </Button>
      {!fields.length && <p className="text-xs text-muted-foreground">当前表单没有可筛选的业务字段。</p>}
    </div>
  )
}

import * as React from 'react'
import {useAppDataRevision} from '@/lib/useAppDataRevision'
import {Check, ChevronDown, Plus, Search, X} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {getAppForms} from '@/services/appForms'
import {approvalDemoForms} from '@/data/mock'
import type {
  ApprovalField,
  ApprovalFlow,
  ApprovalForm,
  Assignment,
  Condition,
  ValueBinding,
} from '@/types/approval'
import {
  formKey,
  literal,
  newCondition,
  uid,
  upstreamNodes,
} from '@/lib/approval'
import {cn, toErrorMessage} from '@/lib/utils'

export const inputClass =
  'h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50'

export function Field({
                        label,
                        children,
                        hint,
                      }: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground">{label}</div>
      {children}
      {hint && (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

export function Choice({
                         value,
                         onChange,
                         options,
                         label,
                         className,
                         disabled,
                       }: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  label?: string
  className?: string
  disabled?: boolean
}) {
  return (
    <select
      aria-label={label}
      className={cn(inputClass, className)}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {!value && <option value="">请选择</option>}
      {value && !options.some((option) => option.value === value) && (
        <option value={value}>{value}（当前不可用）</option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function MultiChoice({
                              value,
                              onChange,
                              options,
                              placeholder = '请选择',
                              tree = false,
                            }: {
  value: string[]
  onChange: (value: string[]) => void
  options: Array<{
    value: string
    label: string
    description?: string
    depth?: number
  }>
  placeholder?: string
  tree?: boolean
}) {
  const [search, setSearch] = React.useState('')
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            inputClass,
            'flex h-auto min-h-9 items-center justify-between gap-2 py-2 text-left',
          )}
        >
          <span className="flex flex-wrap gap-1">
            {value.length ? (
              value.map((id) => (
                <span
                  key={id}
                  className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                >
                  {options.find((option) => option.value === id)?.label ?? id}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/>
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[1100] w-[340px] p-2" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
          <Input
            aria-label="搜索选项"
            className="h-9 pl-9"
            placeholder="搜索名称"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div
          className="max-h-56 overflow-y-auto"
          role={tree ? 'tree' : undefined}
        >
          {options
            .filter((option) =>
              `${option.label} ${option.description ?? ''}`.includes(search),
            )
            .map((option) => (
              <button
                key={option.value}
                role={tree ? 'treeitem' : 'checkbox'}
                aria-checked={value.includes(option.value)}
                onClick={() =>
                  onChange(
                    value.includes(option.value)
                      ? value.filter((id) => id !== option.value)
                      : [...value, option.value],
                  )
                }
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted"
              >
                <span
                  style={{marginLeft: (option.depth ?? 0) * 16}}
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    value.includes(option.value) &&
                    'border-primary bg-primary text-primary-foreground',
                  )}
                >
                  {value.includes(option.value) && (
                    <Check className="h-3 w-3"/>
                  )}
                </span>
                <span>
                  {option.label}
                  {option.description && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </span>
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function useApprovalForms(appId: string) {
  const formRevision = useAppDataRevision(appId, ['form'])
  const [forms, setForms] = React.useState<ApprovalForm[]>(approvalDemoForms)
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [revision, reload] = React.useReducer((value) => value + 1, 0)
  React.useEffect(() => {
    if (!appId) return
    let active = true
    setLoading(true)
    setError('')
    getAppForms(appId)
      .then((items) => {
        if (active)
          setForms([
            ...items.filter(form => !form.builtin).map((form) => ({
              ref: {kind: 'app' as const, name: form.name},
              label: form.label,
              fields: form.fields,
            })),
            ...approvalDemoForms,
          ])
      })
      .catch((cause) => {
        if (active)
          setError(toErrorMessage(cause, '读取应用表单失败'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [appId, revision, formRevision])
  return {forms, error, loading, reload}
}

export function variableOptions(
  flow: ApprovalFlow,
  nodeId: string,
  forms: ApprovalForm[],
) {
  const form = forms.find((item) => formKey(item.ref) === formKey(flow.form))
  const options = [
    {value: 'reviewerIds', label: '流程变量 · 审批人 ID 列表'},
    {value: 'record', label: '发起记录 · 完整记录'},
    ...(form?.fields ?? []).map((field) => ({
      value: `record.${field.name}`,
      label: `发起记录 · ${field.label}`,
    })),
  ]
  for (const node of upstreamNodes(flow.definition.nodes, nodeId) ?? []) {
    const c = node.data.config
    if ('output' in c && c.output) {
      options.push({value: c.output, label: `${node.data.title} · 输出`})
      const fields =
        forms.find((item) => formKey(item.ref) === formKey(c.form))?.fields ??
        []
      const prefix =
        c.kind === 'query' && c.queryMode === 'many'
          ? `${c.output}.0`
          : c.kind === 'update' || c.kind === 'delete'
            ? `${c.output}.records.0`
            : c.output
      fields.forEach((field) =>
        options.push({
          value: `${prefix}.${field.name}`,
          label: `${node.data.title} · ${field.label}`,
        }),
      )
    }
    if (c.kind === 'subflow')
      c.outputs
        .filter((item) => item.field)
        .forEach((item) =>
          options.push({
            value: item.field,
            label: `${node.data.title} · ${item.field}`,
          }),
        )
  }
  return options
}

export function ValueEditor({
                              value,
                              onChange,
                              variables,
                              type = 'TEXT',
                            }: {
  value: ValueBinding
  onChange: (value: ValueBinding) => void
  variables: Array<{ value: string; label: string }>
  type?: string
}) {
  return (
    <div className="flex min-w-0 gap-1.5">
      <Choice
        className="w-[88px] shrink-0 px-2 text-xs"
        label="取值方式"
        value={value.kind}
        onChange={(kind) =>
          onChange({kind: kind as ValueBinding['kind'], value: ''})
        }
        options={[
          {value: 'literal', label: '固定值'},
          {value: 'variable', label: '变量'},
        ]}
      />
      {value.kind === 'variable' ? (
        <Choice
          label="引用变量"
          value={value.value}
          onChange={(path) => onChange({...value, value: path})}
          options={variables}
        />
      ) : type === 'BOOL' ? (
        <Choice
          label="条件值"
          value={value.value}
          onChange={(text) =>
            onChange({...value, value: text, valueType: 'boolean'})
          }
          options={[
            {value: 'true', label: '是'},
            {value: 'false', label: '否'},
          ]}
        />
      ) : (
        <Input
          aria-label="固定值"
          className="h-9 min-w-0"
          type={
            ['NUMBER', 'DECIMAL'].includes(type)
              ? 'number'
              : type === 'DATE'
                ? 'date'
                : type === 'DATETIME'
                  ? 'datetime-local'
                  : 'text'
          }
          placeholder="输入值"
          value={value.value}
          onChange={(event) =>
            onChange({
              ...value,
              value: event.target.value,
              valueType: ['NUMBER', 'DECIMAL'].includes(type)
                ? 'number'
                : 'text',
            })
          }
        />
      )}
    </div>
  )
}

export function ConditionsEditor({
                                   conditions,
                                   match,
                                   onChange,
                                   onMatch,
                                   fields,
                                   variables,
                                 }: {
  conditions: Condition[]
  match: 'all' | 'any'
  onChange: (items: Condition[]) => void
  onMatch: (mode: 'all' | 'any') => void
  fields: ApprovalField[]
  variables: Array<{ value: string; label: string }>
}) {
  const operators = [
    {value: 'eq', label: '等于'},
    {value: 'ne', label: '不等于'},
    {value: 'gt', label: '大于'},
    {value: 'gte', label: '大于等于'},
    {value: 'lt', label: '小于'},
    {value: 'lte', label: '小于等于'},
    {value: 'contains', label: '包含'},
  ]
  return (
    <div className="space-y-3">
      <Choice
        label="条件匹配方式"
        value={match}
        onChange={(value) => onMatch(value as 'all' | 'any')}
        options={[
          {value: 'all', label: '满足全部条件（AND）'},
          {value: 'any', label: '满足任一条件（OR）'},
        ]}
      />
      {conditions.map((condition, index) => {
        const field = fields.find((item) => item.name === condition.field)
        const patch = (update: Partial<Condition>) =>
          onChange(
            conditions.map((item) =>
              item.id === condition.id ? {...item, ...update} : item,
            ),
          )
        const availableOperators =
          field?.type === 'BOOL'
            ? operators.slice(0, 2)
            : ['NUMBER', 'DECIMAL', 'DATE', 'DATETIME'].includes(
              field?.type ?? '',
            )
              ? operators.slice(0, 6)
              : operators.filter((item) =>
                ['eq', 'ne', 'contains'].includes(item.value),
              )
        return (
          <div
            key={condition.id}
            className="space-y-2 rounded-lg border bg-background/50 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                条件 {index + 1}
              </span>
              <button
                title="删除条件"
                onClick={() =>
                  onChange(
                    conditions.filter((item) => item.id !== condition.id),
                  )
                }
              >
                <X className="h-3.5 w-3.5"/>
              </button>
            </div>
            <div className="flex gap-2">
              <Choice
                label="条件字段"
                value={condition.field}
                onChange={(value) =>
                  patch({field: value, operator: 'eq', value: literal()})
                }
                options={fields.map((item) => ({
                  value: item.name,
                  label: item.label,
                }))}
              />
              <Choice
                label="比较方式"
                className="w-[110px] shrink-0"
                value={condition.operator}
                onChange={(value) =>
                  patch({operator: value as Condition['operator']})
                }
                options={availableOperators}
              />
            </div>
            <ValueEditor
              type={field?.type}
              value={condition.value}
              onChange={(value) => patch({value})}
              variables={variables}
            />
          </div>
        )
      })}
      <Button
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={() => onChange([...conditions, newCondition()])}
      >
        <Plus className="h-3.5 w-3.5"/>
        添加条件
      </Button>
    </div>
  )
}

export function AssignmentsEditor({
                                    items,
                                    onChange,
                                    fields,
                                    variables,
                                    free = false,
                                  }: {
  items: Assignment[]
  onChange: (items: Assignment[]) => void
  fields: ApprovalField[]
  variables: Array<{ value: string; label: string }>
  free?: boolean
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const patch = (update: Partial<Assignment>) =>
          onChange(
            items.map((current) =>
              current.id === item.id ? {...current, ...update} : current,
            ),
          )
        return (
          <div
            key={item.id}
            className="space-y-2 rounded-lg border bg-background/50 p-3"
          >
            <div className="flex gap-2">
              {free ? (
                <Input
                  aria-label="目标变量名"
                  placeholder="目标变量名"
                  className="h-9"
                  value={item.field}
                  onChange={(event) => patch({field: event.target.value})}
                />
              ) : (
                <Choice
                  label="赋值字段"
                  value={item.field}
                  onChange={(field) => patch({field})}
                  options={fields
                    .filter((field) => field.name !== 'id')
                    .map((field) => ({
                      value: field.name,
                      label: field.label,
                    }))}
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                title="删除赋值"
                onClick={() =>
                  onChange(items.filter((current) => current.id !== item.id))
                }
              >
                <X className="h-3.5 w-3.5"/>
              </Button>
            </div>
            <ValueEditor
              value={item.value}
              type={fields.find((field) => field.name === item.field)?.type}
              variables={variables}
              onChange={(value) => patch({value})}
            />
          </div>
        )
      })}
      <Button
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={() =>
          onChange([...items, {id: uid(), field: '', value: literal()}])
        }
      >
        <Plus className="h-3.5 w-3.5"/>
        {free ? '添加变量映射' : '添加字段赋值'}
      </Button>
    </div>
  )
}

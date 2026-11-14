import * as React from 'react'
import type {ApprovalForm, FlowTrigger} from '@/types/workflow'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {previewFlowSchedule} from '@/services/workflows'
import {Choice, ConditionsEditor, Field, MultiChoice} from './controls'
import {cn, toErrorMessage} from '@/lib/utils'

const triggerOptions = [
  {value: 'MANUAL', label: '手动触发', detail: '从记录详情手动发起'},
  {value: 'DATA_EVENT', label: '表单事件触发', detail: '记录增删改自动发起'},
  {value: 'SCHEDULE', label: '定时触发', detail: '按 Cron 时间计划执行'},
] as const

export function FlowTriggerEditor({appId, value, forms, onChange, allowedTypes, lockForm, cards}: {
  appId: string; value: FlowTrigger; forms: ApprovalForm[]; onChange: (value: FlowTrigger) => void;
  allowedTypes?: Array<FlowTrigger['type']>; lockForm?: boolean; cards?: boolean
}) {
  const [preview, setPreview] = React.useState<string[]>([])
  const [error, setError] = React.useState('')
  const form = 'formName' in value ? forms.find(f => f.ref.name === value.formName) : undefined
  const options = triggerOptions.filter(option => !allowedTypes || allowedTypes.includes(option.value))
  const select = (type: FlowTrigger['type']) => {
    setPreview([]);
    setError('');
    onChange(type === 'SCHEDULE'
      ? {type, cron: '0 0 9 * * ?', timezone: 'Asia/Shanghai'}
      : type === 'DATA_EVENT' ? {type, formName: form?.ref.name ?? '', operations: ['CREATE']}
        : {type: 'MANUAL', formName: form?.ref.name ?? '', lockRecord: false})
  }
  return <div className="space-y-4">
    <Field label="触发方式">{cards
      ? <div className="grid grid-cols-3 gap-3">{options.map(option => (
        <button key={option.value} onClick={() => select(option.value)}
                className={cn('rounded-lg border p-4 text-left', value.type === option.value && 'border-primary bg-primary/5')}>
          <span className="block text-sm font-medium text-foreground">{option.label}</span>
          <span className="mt-2 block text-xs leading-5">{option.detail}</span>
        </button>))}
      </div>
      : <Choice label="触发方式" value={value.type} options={options}
                onChange={type => select(type as FlowTrigger['type'])}/>}</Field>
    {value.type !== 'SCHEDULE' &&
      <Field label="关联表单"><Choice label="流程关联表单" value={value.formName} disabled={lockForm}
                                      options={forms.filter(f => f.ref.kind === 'app').map(f => ({
                                        value: f.ref.name,
                                        label: f.label
                                      }))}
                                      onChange={formName => onChange({...value, formName})}/></Field>}
    {value.type === 'MANUAL' && <label className="flex items-center gap-2 text-sm"><input type="checkbox"
                                                                                          checked={value.lockRecord}
                                                                                          onChange={e => onChange({
                                                                                            ...value,
                                                                                            lockRecord: e.target.checked
                                                                                          })}/>运行期间锁定主记录</label>}
    {value.type === 'DATA_EVENT' && <>
      <Field label="表单事件"><MultiChoice value={value.operations} options={[
        {value: 'CREATE', label: '新增记录'}, {value: 'UPDATE', label: '修改记录'}, {
          value: 'DELETE',
          label: '删除记录'
        }]}
                                           onChange={operations => onChange({
                                             ...value,
                                             operations: operations as typeof value.operations
                                           })}/></Field>
      {value.operations.includes('UPDATE') && <Field label="监听修改字段" hint="未选择时监听所有业务字段。"><MultiChoice
        value={value.watchedFields ?? []} options={(form?.fields ?? []).map(f => ({value: f.name, label: f.label}))}
        onChange={watchedFields => onChange({...value, watchedFields})}/></Field>}
      <Field label="触发条件"><ConditionsEditor conditions={value.conditions?.conditions ?? []}
                                                match={value.conditions?.match ?? 'all'} fields={form?.fields ?? []}
                                                variables={[]}
                                                onChange={conditions => onChange({
                                                  ...value,
                                                  conditions: {match: value.conditions?.match ?? 'all', conditions}
                                                })}
                                                onMatch={match => onChange({
                                                  ...value,
                                                  conditions: {match, conditions: value.conditions?.conditions ?? []}
                                                })}/></Field>
    </>}
    {value.type === 'SCHEDULE' && <>
      <p className="text-xs text-muted-foreground">到时间启动一个流程实例。业务数据由后续查询数据节点获取。</p>
      <Field label="Cron 表达式"><Input aria-label="Cron 表达式" value={value.cron} onChange={e => {
        setPreview([]);
        onChange({...value, cron: e.target.value})
      }}/></Field>
      <Field label="时区"><Input aria-label="时区" value={value.timezone} onChange={e => {
        setPreview([]);
        onChange({...value, timezone: e.target.value})
      }}/></Field>
      <Field label="开始时间（可选，ISO 8601）"><Input value={value.startAt ?? ''} placeholder="2026-11-08T09:00:00+08:00"
                                                    onChange={e => onChange({
                                                      ...value,
                                                      startAt: e.target.value || undefined
                                                    })}/></Field>
      <Field label="结束时间（可选，ISO 8601）"><Input value={value.endAt ?? ''}
                                                    onChange={e => onChange({
                                                      ...value,
                                                      endAt: e.target.value || undefined
                                                    })}/></Field>
      <Button size="sm" variant="outline" onClick={async () => {
        try {
          setError('');
          setPreview(await previewFlowSchedule(appId, value))
        } catch (e) {
          setError(toErrorMessage(e, '无法计算执行时间'))
        }
      }}>预览未来五次执行时间</Button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <ul className="space-y-1 text-xs text-muted-foreground">{preview.map(time => <li
        key={time}>{new Date(time).toLocaleString('zh-CN', {timeZone: value.timezone})}</li>)}</ul>
    </>}
  </div>
}

import * as React from 'react'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import type {AppFieldConfig, AppFormFieldOption} from '@/services/appForms'

export const dateFormats: Record<string, string[]> = {
  DATE: ['yyyy-MM-dd', 'yyyy/MM/dd', 'yyyy-MM', 'yyyy'],
  DATETIME: ['yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd HH:mm', 'yyyy/MM/dd HH:mm'],
  TIME: ['HH:mm:ss', 'HH:mm'],
}

function Setting({label, children}: {label: string; children: React.ReactNode}) {
  return <label className="grid gap-1.5 text-sm text-foreground"><span>{label}</span>{children}</label>
}

/** 字段管理与设计器共用的类型属性编辑器。 */
export function FieldConfigEditor({type, config = {}, options, onChange, onOptionsChange}: {
  type: string
  config?: AppFieldConfig
  options?: AppFormFieldOption[]
  onChange: (config: AppFieldConfig) => void
  onOptionsChange: (options: AppFormFieldOption[]) => void
}) {
  const text = ['TEXT', 'NTEXT', 'PHONE', 'EMAIL', 'URL'].includes(type)
  const numeric = ['NUMBER', 'DECIMAL'].includes(type)
  const temporal = Boolean(dateFormats[type])
  const choice = ['PICKLIST', 'SELECT', 'CLASSIFICATION', 'MULTISELECT'].includes(type)
  const change = <K extends keyof AppFieldConfig>(key: K, value: AppFieldConfig[K]) => onChange({...config, [key]: value})
  const toggle = (key: 'creatable' | 'updatable' | 'allowNegative' | 'thousandsSeparator', label: string, fallback: boolean) => (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <Checkbox checked={config[key] ?? fallback} onCheckedChange={checked => change(key, checked === true)}/>{label}
    </label>
  )
  const rows = options ?? [
    {id: '1', text: '选项一', defaultSelected: false},
    {id: '2', text: '选项二', defaultSelected: false},
  ]

  return <div className="space-y-4 border-t border-border pt-4">
    <div className="font-medium text-foreground">字段属性</div>
    {type === 'NTEXT' && <Setting label="默认值">
      <Textarea value={config.defaultValue == null ? '' : String(config.defaultValue)}
                onChange={event => change('defaultValue', event.target.value || undefined)}/>
    </Setting>}
    {((text && type !== 'NTEXT') || numeric || temporal) && <Setting label="默认值">
      <Input
        type={numeric ? 'number' : type === 'DATE' ? 'date' : type === 'DATETIME' ? 'datetime-local' : type === 'TIME' ? 'time' : 'text'}
        step={type === 'NUMBER' ? 1 : numeric ? 'any' : temporal ? 1 : undefined}
        value={config.defaultValue == null ? '' : String(config.defaultValue)}
        disabled={config.defaultNow === true}
        onChange={event => change('defaultValue', event.target.value === '' ? undefined : event.target.value)}
      />
    </Setting>}
    {type === 'BOOL' && <Setting label="默认值">
      <Select value={config.defaultValue == null ? 'none' : String(config.defaultValue)}
              onValueChange={value => change('defaultValue', value === 'none' ? undefined : value === 'true')}>
        <SelectTrigger><SelectValue/></SelectTrigger>
        <SelectContent><SelectItem value="none">无</SelectItem><SelectItem value="true">是</SelectItem><SelectItem value="false">否</SelectItem></SelectContent>
      </Select>
    </Setting>}
    {text && <Setting label="最大字符数">
      <Input type="number" min={1} max={type === 'NTEXT' ? 4000 : type === 'TEXT' ? 255 : 512}
             value={config.maxLength ?? ''} placeholder={type === 'NTEXT' ? '4000' : type === 'TEXT' ? '255' : '512'}
             onChange={event => change('maxLength', event.target.value === '' ? undefined : Number(event.target.value))}/>
    </Setting>}
    {['TEXT', 'NTEXT'].includes(type) && <>
      <Setting label="常用值（每行一项，仍可自行输入）">
        <Textarea value={config.commonValues?.join('\n') ?? ''}
                  onChange={event => change('commonValues', event.target.value ? event.target.value.split('\n') : undefined)}/>
      </Setting>
      <Setting label="格式验证（Java 正则表达式，匹配完整字段值）">
        <Input value={config.pattern ?? ''} placeholder="例如：[A-Z]{2}[0-9]{6}"
               onChange={event => change('pattern', event.target.value || undefined)}/>
      </Setting>
      <Setting label="格式错误提示">
        <Input value={config.validationMessage ?? ''} placeholder="留空时显示默认提示"
               onChange={event => change('validationMessage', event.target.value || undefined)}/>
      </Setting>
    </>}
    {numeric && <>
      <div className="flex flex-wrap gap-4">
        {toggle('allowNegative', '允许负数', true)}
        {toggle('thousandsSeparator', '显示千分位', true)}
      </div>
      {type === 'DECIMAL' && <Setting label="小数位数（0–6，留空不限制）">
        <Input type="number" min={0} max={6} value={config.decimalPlaces ?? ''}
               onChange={event => change('decimalPlaces', event.target.value === '' ? undefined : Number(event.target.value))}/>
      </Setting>}
      <div className="grid grid-cols-2 gap-3">
        <Setting label="显示前缀"><Input value={config.prefix ?? ''} maxLength={20} placeholder="例如：¥"
                                     onChange={event => change('prefix', event.target.value || undefined)}/></Setting>
        <Setting label="显示后缀"><Input value={config.suffix ?? ''} maxLength={20} placeholder="例如：元、%"
                                     onChange={event => change('suffix', event.target.value || undefined)}/></Setting>
      </div>
      <p className="text-xs text-muted-foreground">前缀与后缀仅用于显示，不改变存储数值；百分比按录入值显示。</p>
    </>}
    {temporal && <>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox checked={config.defaultNow === true}
                  onCheckedChange={checked => onChange({...config, defaultNow: checked === true, defaultValue: undefined})}/>
        默认使用当前{type === 'DATE' ? '日期' : type === 'TIME' ? '时间' : '日期时间'}
      </label>
      <Setting label="显示格式">
        <Select value={config.dateFormat ?? dateFormats[type][0]} onValueChange={value => change('dateFormat', value)}>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>{dateFormats[type].map(format => <SelectItem key={format} value={format}>{format}</SelectItem>)}</SelectContent>
        </Select>
      </Setting>
    </>}
    {choice && <div className="space-y-2">
      <div className="text-sm text-foreground">选项（标识 / 显示文本 / 默认）</div>
      {rows.map((option, index) => <div key={index} className="flex items-center gap-2">
        <Input aria-label={`选项${index + 1}标识`} className="w-24" value={option.id ?? ''}
               onChange={event => onOptionsChange(rows.map((row, i) => i === index ? {...row, id: event.target.value} : row))}/>
        <Input aria-label={`选项${index + 1}文本`} value={option.text ?? ''}
               onChange={event => onOptionsChange(rows.map((row, i) => i === index ? {...row, text: event.target.value} : row))}/>
        <Checkbox aria-label={`选项${index + 1}默认`} checked={option.defaultSelected === true}
                  onCheckedChange={checked => onOptionsChange(rows.map((row, i) => ({...row,
                    defaultSelected: i === index ? checked === true : type === 'MULTISELECT' && row.defaultSelected === true,
                  })))}/>
        <Button type="button" variant="ghost" size="sm" onClick={() => onOptionsChange(rows.filter((_, i) => i !== index))}>移除</Button>
      </div>)}
      <Button type="button" variant="secondary" size="sm" onClick={() => {
        let id = rows.length + 1
        while (rows.some(row => row.id === String(id))) id++
        onOptionsChange([...rows, {id: String(id), text: `选项${id}`, defaultSelected: false}])
      }}>添加选项</Button>
    </div>}
    {['PICKLIST', 'SELECT', 'MULTISELECT'].includes(type) && <Setting label="显示样式">
      <Select value={config.displayStyle ?? (type === 'MULTISELECT' ? 'CHECKBOX' : 'DROPDOWN')}
              onValueChange={value => change('displayStyle', value as AppFieldConfig['displayStyle'])}>
        <SelectTrigger><SelectValue/></SelectTrigger>
        <SelectContent><SelectItem value="DROPDOWN">下拉列表</SelectItem>
          {type === 'MULTISELECT' ? <SelectItem value="CHECKBOX">复选框</SelectItem> : <SelectItem value="RADIO">单选框</SelectItem>}
        </SelectContent>
      </Select>
    </Setting>}
    <div className="flex flex-wrap gap-4">
      {toggle('creatable', '允许新建时填写', true)}
      {toggle('updatable', '允许修改', true)}
    </div>
  </div>
}

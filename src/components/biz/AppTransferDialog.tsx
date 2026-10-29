import * as React from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Checkbox} from '@/components/ui/checkbox'
import {BizDialog} from '@/components/ui/dialog'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {type AppForm} from '@/services/appForms'
import {
  commitTransfer, downloadTransfer, getTransferForms, previewTransfer, uploadTransfer,
  type TransferColumn, type TransferExport, type TransferPreview, type TransferResult,
  type TransferSheet, type TransferTable, type TransferUpload,
} from '@/services/appTransfers'
import {toErrorMessage} from '@/lib/utils'

interface Props {
  appId: string; currentForm: AppForm; mode: 'import' | 'export' | 'selected'
  selectedIds: string[]; query: Omit<TransferTable, 'formName' | 'scope'>
  onClose: () => void; onImported: () => void
}
const IGNORE = '__ignore__'
const AUTO = '__auto__'
const steps = ['上传文件', '表单映射', '字段映射', '校验预览', '导入结果']

function visibleFields(form: AppForm) {
  const names = new Set(form.layout?.items?.filter(item => item.type === 'FIELD').map(item => item.name))
  return form.fields.filter(field => !field.builtin && names.has(field.name))
}

function Choice({value, label, onChange, disabled = false}: {value: boolean; label: string; onChange: (value: boolean) => void; disabled?: boolean}) {
  return <label className="inline-flex items-center gap-2 text-sm text-foreground">
    <Checkbox checked={value} onCheckedChange={next => onChange(next === true)} disabled={disabled}/>{label}
  </label>
}

export function AppTransferDialog({appId, currentForm, mode, selectedIds, query, onClose, onImported}: Props) {
  const [forms, setForms] = React.useState<AppForm[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [step, setStep] = React.useState(0)
  const [chosen, setChosen] = React.useState<string[]>([currentForm.name])
  const [scope, setScope] = React.useState<TransferTable['scope']>(mode === 'selected' ? 'IDS' : 'FILTERED')
  const [subforms, setSubforms] = React.useState(true)
  const [references, setReferences] = React.useState(false)
  const [fields, setFields] = React.useState<Record<string, string[]>>({})
  const [upload, setUpload] = React.useState<TransferUpload | null>(null)
  const [mappings, setMappings] = React.useState<TransferSheet[]>([])
  const [preview, setPreview] = React.useState<TransferPreview | null>(null)
  const [result, setResult] = React.useState<TransferResult | null>(null)

  React.useEffect(() => {
    let alive = true
    getTransferForms(appId).then(items => { if (alive) setForms(items.filter(form => !form.builtin)) })
      .catch(reason => { if (alive) setError(toErrorMessage(reason, '加载表单失败')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [appId])

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('')
    try { await action() } catch (reason) { setError(toErrorMessage(reason, '操作失败，请重试')) }
    finally { setBusy(false) }
  }
  function exportRequest(template = false): TransferExport {
    return {includeSubforms: subforms, includeReferences: references,
      tables: chosen.map(name => ({formName: name, scope: template || name !== currentForm.name ? 'ALL' : scope,
        ...(name === currentForm.name && !template ? {...query, recordIds: selectedIds} : {}),
        fields: template ? undefined : fields[name],
      }))}
  }
  function updateMapping(sheet: string, update: Partial<TransferSheet>) {
    setPreview(null)
    setMappings(previous => previous.map(mapping => mapping.sheet === sheet ? {...mapping, ...update} : mapping))
  }
  function setTarget(sheet: string, formName: string) {
    setPreview(null)
    setMappings(previous => {
      const rest = previous.filter(mapping => mapping.sheet !== sheet)
      if (formName === IGNORE) return rest
      const suggested = upload?.suggestions.find(mapping => mapping.sheet === sheet && mapping.formName === formName)
      return [...rest, suggested ?? {sheet, formName, headerRow: 1, keyColumn: null, columns: []}]
    })
  }
  function setColumn(mapping: TransferSheet, index: number, selection: string) {
    const rest = mapping.columns.filter(column => column.column !== index)
    if (selection !== IGNORE) {
      const [kind, ...fieldName] = selection.split(':')
      const field = fieldName.join(':')
      const targetForm = forms.find(form => form.name === mapping.formName)?.fields.find(item => item.name === field)?.referenceForm
      const candidates = mappings.filter(item => item.formName === targetForm)
      rest.push({column: index, field, kind: kind as TransferColumn['kind'], targetSheet: kind === 'KEY' && candidates.length === 1 ? candidates[0].sheet : null})
    }
    updateMapping(mapping.sheet, {columns: rest})
  }
  async function selectFile(file?: File) {
    if (!file) return
    await run(async () => {
      const next = await uploadTransfer(appId, file)
      setUpload(next); setMappings(next.suggestions); setPreview(null); setResult(null); setStep(1)
    })
  }
  async function validate() {
    if (!upload) return
    await run(async () => { setPreview(await previewTransfer(appId, upload.uploadId, mappings)); setStep(3) })
  }
  async function commit() {
    if (!preview) return
    await run(async () => {
      setResult(await commitTransfer(appId, preview)); setStep(4); onImported()
    })
  }
  function tablePicker() {
    return <div className="space-y-3">
      <p>选择业务表，每张表对应一个 Sheet。</p>
      {forms.map(form => <div key={form.name} className="rounded-md border border-border p-3 space-y-3">
        <Choice value={chosen.includes(form.name)} label={form.label}
          onChange={checked => setChosen(previous => checked ? [...previous, form.name] : previous.filter(name => name !== form.name))}/>
        {mode !== 'import' && chosen.includes(form.name) && <div className="flex flex-wrap gap-x-4 gap-y-2 pl-6">
          {visibleFields(form).map(field => <Choice key={field.name}
            label={field.label} value={(fields[form.name] ?? visibleFields(form).map(item => item.name)).includes(field.name)}
            onChange={checked => setFields(previous => {
              const names = previous[form.name] ?? visibleFields(form).map(item => item.name)
              return {...previous, [form.name]: checked ? [...names, field.name] : names.filter(name => name !== field.name)}
            })}/>) }
        </div>}
      </div>)}
      <div className="flex flex-wrap gap-4">
        <Choice value={subforms} label="包含子表记录" onChange={setSubforms}/>
        {mode !== 'import' && <Choice value={references} label="补齐引用的业务记录" onChange={setReferences}/>}
      </div>
    </div>
  }

  return <BizDialog open onOpenChange={open => { if (!open && !busy) onClose() }} width={960}
    title={mode === 'import' ? '多表 Excel 导入' : '多表 Excel 导出'}
    footer={<>
      <Button variant="secondary" disabled={busy} onClick={onClose}>{step === 4 ? '完成' : '关闭'}</Button>
      {mode !== 'import' ? <Button disabled={busy || loading || !chosen.length} onClick={() => void run(async () => {
        await downloadTransfer(appId, exportRequest()); setNotice('Excel 已生成，下载已开始。')
      })}>{busy ? '生成中…' : '导出 Excel'}</Button> : <>
        {step > 0 && step < 4 && <Button variant="secondary" disabled={busy} onClick={() => {setError(''); setStep(step - 1)}}>上一步</Button>}
        {step === 1 && <Button disabled={busy || !mappings.length} onClick={() => {setError(''); setStep(2)}}>配置字段</Button>}
        {step === 2 && <Button disabled={busy || !mappings.length} onClick={() => void validate()}>{busy ? '校验中…' : '校验并预览'}</Button>}
        {step === 3 && <Button disabled={busy || !preview || preview.status !== 'READY' || !!preview.errors.length}
          onClick={() => void commit()}>{busy ? '导入中…' : '确认导入'}</Button>}
      </>}
    </>}>
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-md bg-destructive/10 p-3 text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-md border bg-muted p-3 text-foreground">{notice}</div>}
      {loading ? <p>加载表单中…</p> : mode !== 'import' ? <>
        <div className="space-y-2">
          <p>当前表「{currentForm.label}」的范围；额外选择的表导出全部记录。</p>
          <Select value={scope} onValueChange={value => setScope(value as TransferTable['scope'])}>
            <SelectTrigger aria-label="导出范围"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="FILTERED">当前筛选的全部结果</SelectItem>
              <SelectItem value="ALL">当前表全部记录</SelectItem>
              {!!selectedIds.length && <SelectItem value="IDS">勾选的 {selectedIds.length} 条记录</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        {tablePicker()}
        <p className="text-xs">上限：20 张表、整包 5,000 条记录；必要的关联键会自动保留。</p>
      </> : <>
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="导入步骤">
          {steps.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined}
            className={index === step ? 'font-medium text-primary' : 'text-muted-foreground'}>{index + 1}. {label}</li>)}
        </ol>
        {step === 0 && <div className="space-y-4">
          <div className="rounded-md border border-dashed border-border p-4 space-y-2">
            <label htmlFor="transfer-file" className="block font-medium text-foreground">上传 Excel 文件</label>
            <Input id="transfer-file" type="file" accept=".xlsx" disabled={busy}
              onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; void selectFile(file)}}/>
            <p className="text-xs">支持平台文件和普通多 Sheet Excel；文件不超过 10 MB，不支持公式。</p>
          </div>
          {tablePicker()}
          <Button variant="secondary" disabled={busy || !chosen.length} onClick={() => void run(async () => {
            await downloadTransfer(appId, exportRequest(true), true); setNotice('模板已生成，下载已开始。')
          })}>{busy ? '处理中…' : '下载多表模板'}</Button>
        </div>}
        {step === 1 && upload && <div className="space-y-3">
          <p>选择各 Sheet 的目标表单。不需要导入的 Sheet 可忽略。</p>
          {upload.sheets.map(sheet => <div key={sheet.name} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
            <div className="min-w-0"><p className="truncate font-medium text-foreground">{sheet.name}</p><p className="text-xs">共 {sheet.rowCount} 行（含表头）</p></div>
            <Select value={mappings.find(item => item.sheet === sheet.name)?.formName ?? IGNORE} onValueChange={value => setTarget(sheet.name, value)}>
              <SelectTrigger aria-label={`${sheet.name} 目标表单`}><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value={IGNORE}>忽略此 Sheet</SelectItem>{forms.map(form => <SelectItem key={form.name} value={form.name}>{form.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>)}
        </div>}
        {step === 2 && upload && <div className="space-y-5">
          <p className="text-xs">为引用字段选择“包内键”或“已有 ID”；同一行只填写一种。被其他表引用的 Sheet 必须指定包内键列。</p>
          {mappings.map(mapping => {
            const sheet = upload.sheets.find(item => item.name === mapping.sheet)!
            const form = forms.find(item => item.name === mapping.formName)
            const header = sheet.sample[mapping.headerRow - 1] ?? []
            const writable = form?.fields.filter(field => !field.builtin && field.config?.creatable !== false) ?? []
            return <section key={mapping.sheet} className="rounded-md border border-border p-3 space-y-3">
              <p className="font-medium text-foreground">{mapping.sheet} → {form?.label}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">表头行<Input type="number" min={1} max={100} aria-label={`${mapping.sheet} 表头行`}
                  value={mapping.headerRow} onChange={event => updateMapping(mapping.sheet, {headerRow: Math.max(1, Math.min(100, Number(event.target.value) || 1)), columns: [], keyColumn: null})}/></label>
                <div className="space-y-1"><p>包内键列</p><Select value={mapping.keyColumn === null ? AUTO : String(mapping.keyColumn)}
                  onValueChange={value => updateMapping(mapping.sheet, {keyColumn: value === AUTO ? null : Number(value), columns: mapping.columns.filter(column => String(column.column) !== value)})}>
                  <SelectTrigger aria-label={`${mapping.sheet} 包内键列`}><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value={AUTO}>自动生成（此表不被包内引用）</SelectItem>{header.map((cell, index) => <SelectItem key={index} value={String(index)}>{index + 1}. {cell.display || '空列名'}</SelectItem>)}</SelectContent>
                </Select></div>
              </div>
              <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm">
                <thead><tr className="border-b"><th className="py-2 pr-3">源列／样例</th><th className="py-2 pr-3">目标字段</th><th className="py-2">引用 Sheet</th></tr></thead>
                <tbody>{header.map((cell, index) => {
                  const column = mapping.columns.find(item => item.column === index)
                  const targetForm = writable.find(field => field.name === column?.field)?.referenceForm
                  const candidates = mappings.filter(item => item.formName === targetForm)
                  return <tr key={index} className="border-b last:border-0">
                    <td className="max-w-[210px] py-2 pr-3"><p className="truncate text-foreground">{index + 1}. {cell.display || '空列名'}</p>
                      <p className="truncate text-xs">{sheet.sample[mapping.headerRow]?.[index]?.display ?? ''}</p></td>
                    <td className="min-w-[220px] py-2 pr-3"><Select disabled={mapping.keyColumn === index}
                      value={column ? `${column.kind}:${column.field}` : IGNORE} onValueChange={value => setColumn(mapping, index, value)}>
                      <SelectTrigger aria-label={`${mapping.sheet} 第${index + 1}列字段`}><SelectValue placeholder="忽略此列"/></SelectTrigger>
                      <SelectContent><SelectItem value={IGNORE}>{mapping.keyColumn === index ? '包内键列' : '忽略此列'}</SelectItem>
                        {writable.flatMap(field => field.referenceForm ? [
                          <SelectItem key={`${field.name}-key`} value={`KEY:${field.name}`}>{field.label}（包内键）</SelectItem>,
                          <SelectItem key={`${field.name}-id`} value={`EXISTING:${field.name}`}>{field.label}（已有 ID）</SelectItem>,
                        ] : [<SelectItem key={field.name} value={`VALUE:${field.name}`}>{field.label}{field.required ? ' *' : ''}</SelectItem>])}
                      </SelectContent>
                    </Select></td>
                    <td className="min-w-[150px] py-2">{column?.kind === 'KEY' ? <Select value={column.targetSheet ?? IGNORE}
                      onValueChange={value => updateMapping(mapping.sheet, {columns: mapping.columns.map(item => item.column === index ? {...item, targetSheet: value === IGNORE ? null : value} : item)})}>
                      <SelectTrigger aria-label={`${mapping.sheet} 第${index + 1}列引用Sheet`}><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value={IGNORE}>请选择</SelectItem>{candidates.map(item => <SelectItem key={item.sheet} value={item.sheet}>{item.sheet}</SelectItem>)}</SelectContent>
                    </Select> : '—'}</td>
                  </tr>
                })}</tbody>
              </table></div>
            </section>
          })}
        </div>}
        {step === 3 && preview && <div className="space-y-4">
          <p className="font-medium text-foreground">预计新增 {preview.tables.reduce((sum, table) => sum + table.count, 0)} 条记录；有错误时不会写入任何数据。</p>
          <ul className="space-y-1">{preview.tables.map(table => <li key={table.sheet}>{table.sheet}：{table.count} 条</li>)}</ul>
          {!!preview.errors.length && <div role="alert" className="space-y-2 rounded-md border border-destructive/30 p-3 text-destructive">
            <p className="font-medium">发现 {preview.errors.length} 项错误，请返回修改映射或文件。</p>
            {preview.errors.map((issue, index) => <p key={index} className="break-words text-xs">{issue.sheet} {issue.row > 0 ? `第 ${issue.row} 行` : ''} {issue.field}：{issue.message}{issue.value ? `（原值：${issue.value}）` : ''}</p>)}
          </div>}
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs">
            <thead><tr className="border-b"><th className="p-2">Sheet／行</th><th className="p-2">包内键</th><th className="p-2">数据预览（前20条）</th></tr></thead>
            <tbody>{preview.sample.map((row, index) => <tr key={index} className="border-b"><td className="p-2">{row.sheet} / {row.row}</td><td className="p-2">{row.key}</td><td className="max-w-[500px] break-words p-2">{JSON.stringify(row.values)}</td></tr>)}</tbody>
          </table></div>
        </div>}
        {step === 4 && result && <div role="status" className="space-y-3 rounded-md border border-border p-4 text-foreground">
          <p className="text-base font-medium">导入成功，共新增 {result.total} 条记录</p>
          {result.tables.map(table => <p key={table.sheet}>{table.sheet}：{table.count} 条</p>)}
        </div>}
      </>}
    </div>
  </BizDialog>
}

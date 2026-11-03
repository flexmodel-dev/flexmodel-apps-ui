import * as React from 'react'
import {
  AlertCircle,
  Boxes,
  Check,
  CheckCircle2,
  Compass,
  Database,
  FileArchive,
  LayoutGrid,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Table2,
  TriangleAlert,
  Upload,
  Workflow,
} from 'lucide-react'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {BizDialog} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {cn, toErrorMessage} from '@/lib/utils'
import {
  type AppPackageImportResult,
  type AppPackagePreview,
  commitAppPackage,
  getAppPackageImport,
  isAppPackageImportResult,
  MAX_PACKAGE_BYTES,
  uploadAppPackage,
} from '@/services/appPackages'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: () => void
  /** 来自内置模板的预览：跳过上传步骤，直接进入预览确认。 */
  initialPreview?: AppPackagePreview | null
  /** 来自创建弹窗的应用名称，优先于模板默认名。 */
  initialName?: string | null
}

const importSteps = ['创建应用与业务库', '重建表单与字段', '重建导航与工作台', '重建审批与数据权限', '写入业务记录', '激活应用']

/** 后端执行阶段到步骤索引的映射，用于轮询进度高亮。 */
const phaseSteps: Record<string, number> = {
  provision: 0,
  forms: 1,
  references: 1,
  layouts: 1,
  navigation: 2,
  workbenches: 2,
  approvals: 3,
  authorizations: 3,
  records: 4,
  activating: 5,
  done: importSteps.length,
}

function progressStep(phase: string | null) {
  return phase ? phaseSteps[phase] ?? 0 : 0
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return [
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-'),
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(':'),
  ].join(' ')
}

function resourceIcon(key: string) {
  if (key === 'app') return Boxes
  if (key === 'forms') return LayoutGrid
  if (key === 'navigation') return Compass
  if (key === 'workbenches') return Table2
  if (key === 'approvals') return Workflow
  if (key === 'permissions' || key === 'authorizations') return ShieldCheck
  if (key === 'records') return Database
  return FileArchive
}

function StepIndicator({step, labels}: { step: number; labels: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="导入步骤">
      {labels.map((label, index) => {
        const done = index < step || (step === 2 && index === 2)
        const active = index === step && !done
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full border text-[11px]',
              done ? 'border-primary bg-primary text-primary-foreground' : active ? 'border-primary text-primary' : 'border-border text-muted-foreground',
            )}>
              {done ? <Check className="h-3 w-3" strokeWidth={3}/> : index + 1}
            </span>
            <span className={done || active ? 'font-medium text-foreground' : 'text-muted-foreground'}>{label}</span>
            {index < labels.length - 1 ? <span className="mx-1 h-px w-6 bg-border"/> : null}
          </li>
        )
      })}
    </ol>
  )
}

export function AppPackageImportDialog({
                                         open,
                                         onOpenChange,
                                         onImported,
                                         initialPreview = null,
                                         initialName = null,
                                       }: Props) {
  const templateMode = Boolean(initialPreview)
  const steps = templateMode ? ['导入预览', '完成'] : ['选择应用包', '导入预览', '完成']
  const [step, setStep] = React.useState(0)
  const [preview, setPreview] = React.useState<AppPackagePreview | null>(null)
  const [result, setResult] = React.useState<AppPackageImportResult | null>(null)
  const [newName, setNewName] = React.useState('')
  const [isUploading, setIsUploading] = React.useState(false)
  const [isCommitting, setIsCommitting] = React.useState(false)
  const [phase, setPhase] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const [error, setError] = React.useState('')
  const progressRef = React.useRef<HTMLDivElement>(null)

  const busy = isUploading || isCommitting
  const currentStep = progressStep(phase)

  // 进度块在长预览的最下方，开始导入时滚动到可视区
  React.useEffect(() => {
    if (isCommitting) progressRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'})
  }, [isCommitting])

  const reset = React.useCallback(() => {
    setStep(0)
    setPreview(null)
    setResult(null)
    setNewName('')
    setIsUploading(false)
    setIsCommitting(false)
    setPhase(null)
    setDragging(false)
    setError('')
  }, [])

  React.useEffect(() => {
    if (!open) return
    reset()
    if (initialPreview) {
      setPreview(initialPreview)
      setNewName(initialName ?? initialPreview.defaultAppName)
      setStep(1)
    }
  }, [open, initialPreview, initialName, reset])

  const close = (next: boolean) => {
    if (!next && busy) return
    onOpenChange(next)
  }

  const selectFile = async (file?: File) => {
    if (!file) return
    setError('')
    setIsUploading(true)
    try {
      const next = await uploadAppPackage(file)
      setPreview(next)
      setNewName(next.defaultAppName)
      setStep(1)
    } catch (caught) {
      setPreview(null)
      setError(toErrorMessage(caught, '应用包解析失败，请重试。'))
    } finally {
      setIsUploading(false)
    }
  }

  const settle = (next: AppPackageImportResult) => {
    setResult(next)
    setStep(2)
    if (next.status === 'COMMITTED') onImported?.()
  }

  /** 响应丢失时轮询任务回执，直到终态或超时。 */
  const pollImportResult = async (uploadId: string): Promise<AppPackageImportResult | null> => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const status = await getAppPackageImport(uploadId).catch(() => null)
      if (isAppPackageImportResult(status)) {
        if (status.status === 'COMMITTING' || status.status === 'COMPENSATING') {
          setPhase(status.phase ?? null)
          await new Promise(resolve => setTimeout(resolve, 3000))
          continue
        }
        return status
      }
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    return null
  }

  const commit = async () => {
    if (!preview) return
    setError('')
    setIsCommitting(true)
    setPhase('provision')
    const uploadId = preview.uploadId
    // 提交请求是同步执行的，期间轮询状态接口获取当前阶段。
    const timer = window.setInterval(() => {
      void getAppPackageImport(uploadId)
        .then(status => {
          if (isAppPackageImportResult(status)
            && (status.status === 'COMMITTING' || status.status === 'COMPENSATING')) {
            setPhase(status.phase ?? null)
          }
        })
        .catch(() => undefined)
    }, 1000)
    try {
      const next = await commitAppPackage(uploadId, {name: newName.trim(), planHash: preview.planHash})
      settle(next)
    } catch (caught) {
      const recovered = await pollImportResult(uploadId)
      if (recovered) {
        settle(recovered)
        return
      }
      setError(toErrorMessage(caught, '导入结果未知，请稍后在应用列表确认，勿重复提交。'))
    } finally {
      window.clearInterval(timer)
      setIsCommitting(false)
      setPhase(null)
    }
  }

  const footer = step === 2 ? (
    <Button onClick={() => close(false)}>完成</Button>
  ) : step === 1 ? (
    <>
      <Button variant="secondary" disabled={busy} onClick={() => close(false)}>取消</Button>
      {templateMode ? null : (
        <Button variant="secondary" disabled={busy} onClick={reset}>
          <RefreshCw className="h-4 w-4"/> 重新选择
        </Button>
      )}
      <Button
        disabled={busy || preview?.status !== 'READY' || !newName.trim()}
        onClick={() => void commit()}
        aria-busy={isCommitting}
      >
        {isCommitting ? <Loader2 className="h-4 w-4 animate-spin"/> : null}
        {isCommitting ? '正在导入…' : '确认导入'}
      </Button>
    </>
  ) : (
    <Button variant="secondary" disabled={busy} onClick={() => close(false)}>取消</Button>
  )

  return (
    <BizDialog
      open={open}
      onOpenChange={close}
      title={templateMode ? '创建应用' : '导入应用包'}
      width={900}
      height="min(84vh, 820px)"
      footer={footer}
      headerExtra={(
        <span className="inline-block max-w-[240px]" title={preview?.package.fileName}>
          <Badge className="max-w-full bg-muted text-muted-foreground">
            <span className="min-w-0 truncate">{preview?.package.fileName ?? '.flexmodel.zip'}</span>
          </Badge>
        </span>
      )}
    >
      <div className="space-y-5">
        <StepIndicator step={templateMode ? step - 1 : step} labels={steps}/>

        {error && step !== 2 ? (
          <div role="alert"
               className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {step === 0 ? (
          <label
            htmlFor="app-package-file"
            className={cn(
              'group flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
              dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
              busy ? 'cursor-wait opacity-70' : 'hover:border-primary/60 hover:bg-accent/40',
            )}
            onDragOver={event => {
              event.preventDefault()
              if (!busy) setDragging(true)
            }}
            onDragLeave={event => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false)
            }}
            onDrop={event => {
              event.preventDefault()
              setDragging(false)
              if (!busy) void selectFile(event.dataTransfer.files?.[0])
            }}
          >
            <input
              id="app-package-file"
              type="file"
              accept=".flexmodel.zip,.zip"
              className="sr-only"
              disabled={busy}
              aria-label="上传应用包文件"
              onChange={event => {
                const selected = event.target.files?.[0]
                event.target.value = ''
                void selectFile(selected)
              }}
            />
            <span className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full text-primary transition-colors',
              dragging ? 'bg-primary/15' : 'bg-primary/10 group-hover:bg-primary/15',
            )}>
              {busy ? <Loader2 className="h-7 w-7 animate-spin"/> : <Upload className="h-7 w-7"/>}
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-medium text-foreground">
                {busy ? '正在解析应用包…' : dragging ? '松开即可上传' : '拖拽应用包到此处，或点击选择'}
              </span>
              <span className="block text-xs text-muted-foreground">
                .flexmodel.zip · 最大 {formatBytes(MAX_PACKAGE_BYTES)}
              </span>
            </span>
            <span className={cn(
              'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors',
              !busy && 'group-hover:bg-accent group-hover:text-accent-foreground',
            )}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileArchive className="h-4 w-4"/>}
              {busy ? '解析中…' : '选择文件'}
            </span>
          </label>
        ) : null}

        {step === 1 && preview ? (
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileArchive className="h-5 w-5"/>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="m-0 text-base font-medium text-foreground">{preview.source.appName}</h3>
                    <Badge
                      className={preview.status === 'READY' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}>
                      {preview.status === 'READY' ? '校验通过' : '存在阻断项'}
                    </Badge>
                  </div>
                  <p className="mb-0 mt-1 break-all text-xs text-muted-foreground">
                    源应用 {preview.source.appId} · 导出于 {formatDateTime(preview.source.exportedAt)} · 协议
                    v{preview.source.formatVersion}
                  </p>
                </div>
              </div>
              <dl className="mb-0 mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['表单', `${preview.forms.length} 个`],
                  ['字段', `${preview.package.totalFields} 个`],
                  ['记录', preview.package.hasData ? preview.package.totalRecords.toLocaleString('zh-CN') : '未包含'],
                  ['包大小', formatBytes(preview.package.size)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border bg-background px-3 py-2">
                    <dt className="text-[11px] text-muted-foreground">{label}</dt>
                    <dd className="m-0 mt-0.5 text-sm font-medium text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <div>
              <label htmlFor="app-package-name"
                     className="mb-1 block text-sm font-medium text-foreground">新应用名称</label>
              <Input
                id="app-package-name"
                value={newName}
                maxLength={100}
                disabled={busy}
                onChange={event => setNewName(event.target.value)}
                placeholder="请输入新应用名称"
              />
            </div>

            {preview.issues.length ? (
              <div role="alert"
                   className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="h-4 w-4"/>发现 {preview.issues.length} 项阻断问题，修正后才能导入
                </div>
                {preview.issues.map(issue => (
                  <div key={`${issue.code}-${issue.path}`} className="text-xs leading-5">
                    <div>{issue.message}</div>
                    <code
                      className="mt-0.5 block break-all rounded bg-background/60 px-1.5 py-1 font-mono text-[11px]">{issue.path}</code>
                  </div>
                ))}
              </div>
            ) : null}

            {preview.warnings.length ? (
              <div role="status"
                   className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TriangleAlert className="h-4 w-4"/>导入提示 {preview.warnings.length} 项，不影响继续导入
                </div>
                {preview.warnings.map((warning, index) => (
                  <div key={`${index}-${warning}`} className="text-xs leading-5">{warning}</div>
                ))}
              </div>
            ) : null}

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="m-0 text-sm font-medium text-foreground">导入内容</h3>
                <span className="text-xs text-muted-foreground">共 {preview.forms.length} 个业务表单</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {preview.resources.map(resource => {
                  const Icon = resourceIcon(resource.key)
                  return (
                    <div key={resource.key} className={cn(
                      'flex min-w-0 items-start gap-2.5 rounded-md border p-3',
                      resource.key === 'records' && 'sm:col-span-2',
                      resource.included ? 'border-border bg-card' : 'border-dashed border-border bg-muted/20',
                    )}>
                      <Icon
                        className={cn('mt-0.5 h-4 w-4 shrink-0', resource.included ? 'text-primary' : 'text-muted-foreground')}/>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">{resource.label}</span>
                          <span
                            className="shrink-0 text-xs text-muted-foreground">{resource.included ? resource.count.toLocaleString('zh-CN') : '不导入'}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{resource.detail}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section>
              <h3 className="mb-2 mt-0 text-sm font-medium text-foreground">表单与记录</h3>
              <div className="overflow-hidden rounded-md border border-border">
                <div
                  className="hidden grid-cols-[minmax(0,1fr)_80px_100px_90px] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground sm:grid">
                  <span>表单</span><span className="text-right">字段</span><span
                  className="text-right">隐藏字段</span><span className="text-right">记录</span>
                </div>
                {preview.forms.map(form => (
                  <div key={form.name}
                       className="grid grid-cols-1 gap-1 border-b border-border px-3 py-2.5 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_80px_100px_90px] sm:items-center sm:gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{form.label}</div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">{form.name}</div>
                    </div>
                    <div
                      className="flex items-center justify-between gap-2 text-xs text-muted-foreground sm:justify-end">
                      <span className="sm:hidden">字段</span>
                      <span>{form.fieldCount} 个</span>
                    </div>
                    <div
                      className="flex items-center justify-between gap-2 text-xs text-muted-foreground sm:justify-end">
                      <span className="sm:hidden">隐藏字段</span>
                      <span>{form.hiddenFieldCount ? `${form.hiddenFieldCount} 个` : '—'}</span>
                    </div>
                    <div
                      className="flex items-center justify-between gap-2 text-xs text-muted-foreground sm:justify-end">
                      <span className="sm:hidden">记录</span>
                      <span>{preview.package.hasData ? form.dataRows.toLocaleString('zh-CN') : '未包含'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {isCommitting ? (
              <div ref={progressRef} role="status" aria-live="polite"
                   className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary"/>
                  {currentStep < importSteps.length ? `正在${importSteps[currentStep]}…` : '正在完成导入…'}
                </div>
                <ul className="mb-0 mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  {importSteps.map((label, index) => {
                    const finished = index < currentStep
                    const active = index === currentStep
                    return (
                      <li key={label} className={cn('flex items-center gap-2',
                        active ? 'font-medium text-foreground'
                          : finished ? 'text-muted-foreground' : 'text-muted-foreground/70')}>
                        <span className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full border text-[10px]',
                          finished ? 'border-primary bg-primary text-primary-foreground'
                            : active ? 'border-primary text-primary' : 'border-border',
                        )}>
                          {finished
                            ? <Check className="h-2.5 w-2.5" strokeWidth={3}/>
                            : active ? <Loader2 className="h-2.5 w-2.5 animate-spin"/> : index + 1}
                        </span>
                        {label}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 && result && result.status === 'COMMITTED' ? (
          <div className="flex flex-col items-center px-4 py-6 text-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8"/>
            </span>
            <h3
              className="mb-0 mt-4 text-lg font-semibold text-foreground">{templateMode ? '创建完成' : '导入完成'}</h3>
            <p className="mb-0 mt-1 text-sm text-muted-foreground">
              已创建应用「<span className="font-medium text-foreground">{result.appName}</span>」
            </p>
            <div className="mt-4 grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-card px-3 py-2">
                <div className="text-[11px] text-muted-foreground">业务表单</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">{result.forms.length} 个</div>
              </div>
              <div className="rounded-md border border-border bg-card px-3 py-2">
                <div className="text-[11px] text-muted-foreground">业务记录</div>
                <div
                  className="mt-0.5 text-sm font-medium text-foreground">{result.totalRecords.toLocaleString('zh-CN')} 条
                </div>
              </div>
              <div className="rounded-md border border-border bg-card px-3 py-2">
                <div className="text-[11px] text-muted-foreground">完成时间</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">{formatDateTime(result.importedAt)}</div>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 && result && result.status !== 'COMMITTED' ? (
          <div className="flex flex-col items-center px-4 py-6 text-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-8 w-8"/>
            </span>
            <h3 className="mb-0 mt-4 text-lg font-semibold text-foreground">
              {result.status === 'CLEANUP_REQUIRED' ? '导入失败，自动清理未完成' : '导入失败'}
            </h3>
            <p className="mb-0 mt-1 max-w-lg text-sm text-muted-foreground">
              {result.status === 'CLEANUP_REQUIRED'
                ? '目标应用的清理未全部完成，系统将在后台自动重试清理，请勿重复提交该导入任务。'
                : templateMode
                  ? '目标应用残留已清理完成，请稍后重试。'
                  : '目标应用残留已清理完成，请修正问题后重新上传导入。'}
            </p>
            {result.error ? (
              <p
                className="mb-0 mt-3 w-full max-w-lg break-all rounded-md border border-destructive/30 bg-destructive/10 p-3 text-left text-xs leading-5 text-destructive">
                {result.error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </BizDialog>
  )
}

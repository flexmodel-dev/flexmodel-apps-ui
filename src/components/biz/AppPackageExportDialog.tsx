import * as React from 'react'
import {Download, Loader2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {BizDialog} from '@/components/ui/dialog'
import {message} from '@/components/ui/message'
import {toErrorMessage} from '@/lib/utils'
import {downloadAppPackage, MAX_PACKAGE_RECORDS} from '@/services/appPackages'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  appId: string
  appName: string
}

export function AppPackageExportDialog({open, onOpenChange, appId, appName}: Props) {
  const [includeData, setIncludeData] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setIncludeData(false)
      setIsExporting(false)
      setError('')
    }
  }, [open])

  const close = (next: boolean) => {
    if (!next && isExporting) return
    onOpenChange(next)
  }

  const exportPackage = async () => {
    setIsExporting(true)
    setError('')
    try {
      await downloadAppPackage({appId, appName, includeData})
      message.success('应用包已生成，下载已开始。')
      onOpenChange(false)
    } catch (caught) {
      setError(toErrorMessage(caught, '导出失败，请稍后重试。'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <BizDialog
      open={open}
      onOpenChange={close}
      title="导出应用"
      width={460}
      footer={
        <>
          <Button variant="secondary" disabled={isExporting} onClick={() => close(false)}>取消</Button>
          <Button disabled={isExporting} onClick={() => void exportPackage()} aria-busy={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
            {isExporting ? '正在导出…' : '导出'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="mb-0 text-sm text-foreground">
          导出应用「<span className="font-medium">{appName}</span>」的结构配置。
        </p>

        <label
          className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent/30">
          <Checkbox
            checked={includeData}
            onCheckedChange={checked => setIncludeData(checked === true)}
            aria-label="包含记录数据"
            disabled={isExporting}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">包含记录数据</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              最多 {MAX_PACKAGE_RECORDS.toLocaleString('zh-CN')} 条
            </span>
          </span>
        </label>

        {error ? (
          <div role="alert"
               className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </div>
    </BizDialog>
  )
}

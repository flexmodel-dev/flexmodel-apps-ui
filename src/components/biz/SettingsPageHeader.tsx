import type {ReactNode} from 'react'
import {ArrowLeft} from 'lucide-react'
import {Button} from '@/components/ui/button'

/** 设置页面共用的标题、返回和操作区，长标题及窄屏下允许操作自然换行。 */
export function SettingsPageHeader({title, description, onBack, backLabel = '返回', badge, actions, children}: {
  title: ReactNode
  description?: string
  onBack: () => void
  backLabel?: string
  badge?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return <header data-settings-header className="shrink-0 border-b border-border text-foreground">
    <div className="flex flex-wrap items-center gap-4 p-4 sm:px-6">
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
        <Button type="button" variant="outline" size="sm" className="shrink-0"
                onClick={onBack} aria-label={backLabel} title={backLabel}>
          <ArrowLeft className="h-4 w-4"/>返回
        </Button>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="m-0 truncate text-lg font-semibold">{title}</h1>{badge}
          </div>
          {description && <p className="mb-0 mt-1 truncate text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>}
    </div>
    {children}
  </header>
}

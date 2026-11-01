import * as React from 'react'
import {AlertTriangle, RefreshCw} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Skeleton} from '@/components/ui/skeleton'
import {cn} from '@/lib/utils'

/** 顶部细进度条：后台刷新时保留旧内容，避免整块闪成加载态。 */
export function ViewFetchingBar({active, className}: { active: boolean; className?: string }) {
  if (!active) return null
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-primary/15', className)}
    >
      <div className="h-full w-1/3 animate-[view-progress_1.1s_ease-in-out_infinite] rounded-full bg-primary"/>
    </div>
  )
}

/** 首次加载或请求失败的整块状态。 */
export function ViewErrorState({
                                 message,
                                 onRetry,
                                 className,
                               }: {
  message: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div role="alert"
         className={cn('flex min-h-[240px] flex-col items-center justify-center gap-3 px-4 py-10 text-center', className)}>
      <AlertTriangle className="h-6 w-6 text-destructive"/>
      <p className="max-w-md text-sm text-destructive">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4"/>重试
        </Button>
      )}
    </div>
  )
}

/** 已有内容时的轻量错误提示。 */
export function ViewInlineError({message, onRetry}: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert"
         className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0"/>
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <button type="button" className="inline-flex items-center gap-1 font-medium hover:underline" onClick={onRetry}>
          <RefreshCw className="h-3 w-3"/>重试
        </button>
      )}
    </div>
  )
}

/** 各种视图的首次加载骨架，尺寸和最终内容大致一致以避免跳动。 */
export function ViewSkeleton({
                               variant = 'table',
                               rows = 6,
                               className,
                             }: {
  variant?: 'table' | 'cards' | 'list' | 'panel'
  rows?: number
  className?: string
}) {
  if (variant === 'cards') {
    return (
      <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5', className)}
           aria-hidden="true">
        {Array.from({length: rows}).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-xl border bg-card">
            <Skeleton className="h-36 w-full rounded-none"/>
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-2/3"/>
              <Skeleton className="h-3 w-full"/>
              <Skeleton className="h-3 w-4/5"/>
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (variant === 'list') {
    return (
      <div className={cn('space-y-2', className)} aria-hidden="true">
        {Array.from({length: rows}).map((_, index) => (
          <div key={index} className="space-y-2 rounded-lg border p-3">
            <Skeleton className="h-4 w-2/3"/>
            <Skeleton className="h-3 w-1/2"/>
          </div>
        ))}
      </div>
    )
  }
  if (variant === 'panel') {
    return (
      <div className={cn('space-y-4', className)} aria-hidden="true">
        <div className="grid grid-cols-1 gap-4 rounded-xl border p-4 md:grid-cols-2">
          {Array.from({length: rows}).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-20"/>
              <Skeleton className="h-4 w-3/4"/>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className={cn('overflow-hidden rounded-lg border', className)} aria-hidden="true">
      <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
        {Array.from({length: 5}).map((_, index) => (
          <Skeleton key={index} className="h-3 flex-1"/>
        ))}
      </div>
      <div className="divide-y">
        {Array.from({length: rows}).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 px-4 py-3">
            {Array.from({length: 5}).map((_, cellIndex) => (
              <Skeleton key={cellIndex} className={cn('h-3 flex-1', cellIndex === 0 && 'max-w-[38%]')}/>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

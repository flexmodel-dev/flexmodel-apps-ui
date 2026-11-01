import {Button} from '@/components/ui/button'
import {Empty} from '@/components/ui/empty'
import {AppLoading} from '@/components/biz/AppLoading'
import type {AppRecord} from '@/services/appRecords'
import {cn} from '@/lib/utils'

export interface UnscheduledItem {
  record: AppRecord
  title: string
  hint: string
  invalid?: boolean
}

/** 日历/甘特共用的未排期记录列表，支持继续加载和错误重试。 */
export function UnscheduledList({
                                  items,
                                  total,
                                  hasMore,
                                  isLoading,
                                  isFetching,
                                  error,
                                  onRetry,
                                  onLoadMore,
                                  onOpenRecord,
                                }: {
  items: UnscheduledItem[]
  total: number
  hasMore: boolean
  isLoading: boolean
  isFetching: boolean
  error: string | null
  onRetry: () => void
  onLoadMore: () => void
  onOpenRecord: (recordId: string) => void
}) {
  if (isLoading) return <AppLoading center className="min-h-[120px]"/>
  if (error && !items.length) {
    return (
      <div className="space-y-2 p-2 text-center">
        <p className="text-xs text-destructive" role="alert">{error}</p>
        <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={onRetry}>重试</Button>
      </div>
    )
  }
  if (!items.length) return <Empty image={null} description="暂无未排期记录" className="py-6"/>
  return (
    <div className="space-y-0.5">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" className="shrink-0 hover:underline" onClick={onRetry}>重试</button>
        </div>
      )}
      {items.map((item, index) => (
        <button
          key={`${String(item.record.id)}-${index}`}
          type="button"
          className="block w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
          onClick={() => onOpenRecord(String(item.record.id))}
        >
          <span className="block truncate text-sm">{item.title}</span>
          <span
            className={cn('block truncate text-xs', item.invalid ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}
          >
            {item.hint}
          </span>
        </button>
      ))}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full text-xs text-muted-foreground"
          disabled={isFetching}
          onClick={onLoadMore}
        >
          {isFetching ? '加载中…' : `加载更多（已显示 ${items.length} / 共 ${total} 条）`}
        </Button>
      )}
    </div>
  )
}

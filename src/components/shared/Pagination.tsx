import * as React from 'react'
import {ChevronLeft, ChevronRight} from 'lucide-react'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {cn} from '@/lib/utils'

const DEFAULT_SIZE_OPTIONS = [30, 50, 100, 200]

/** 列表分页器：页码窗口 + 首页/末页 + 每页数量，统一使用服务端支持的最大页长。 */
export function Pagination({
                             page,
                             pages,
                             total,
                             size,
                             sizeOptions = DEFAULT_SIZE_OPTIONS,
                             onChange,
                             onSizeChange,
                             className,
                           }: {
  page: number
  pages: number
  total: number
  size: number
  sizeOptions?: number[]
  onChange: (page: number) => void
  onSizeChange?: (size: number) => void
  className?: string
}) {
  const safePages = Math.max(1, pages)
  const current = Math.min(Math.max(1, page), safePages)
  const from = total === 0 ? 0 : (current - 1) * size + 1
  const to = Math.min(current * size, total)
  const windowStart = Math.max(1, Math.min(current - 2, safePages - 4))
  const windowEnd = Math.min(safePages, windowStart + 4)
  const visible = Array.from({length: Math.max(0, windowEnd - windowStart + 1)}, (_, index) => windowStart + index)
  const options = Array.from(new Set([...sizeOptions, size])).sort((left, right) => left - right)

  const navButton = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40'

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground', className)}>
      <span className="whitespace-nowrap tabular-nums">
        共 {total} 条{total > 0 && <span className="hidden sm:inline">（{from}-{to}）</span>}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button" className={navButton} disabled={current <= 1} onClick={() => onChange(current - 1)}
          aria-label="上一页" title="上一页"
        >
          <ChevronLeft className="h-4 w-4"/>
        </button>
        {windowStart > 1 && (
          <>
            <button type="button" className={cn(navButton, current === 1 && 'bg-primary text-primary-foreground')}
                    onClick={() => onChange(1)}>1
            </button>
            {windowStart > 2 && <span className="px-1 text-xs">…</span>}
          </>
        )}
        {visible.map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            aria-label={`第 ${num} 页`}
            aria-current={num === current ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm tabular-nums transition-colors',
              num === current ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {num}
          </button>
        ))}
        {windowEnd < safePages && (
          <>
            {windowEnd < safePages - 1 && <span className="px-1 text-xs">…</span>}
            <button type="button"
                    className={cn(navButton, current === safePages && 'bg-primary text-primary-foreground')}
                    onClick={() => onChange(safePages)}>{safePages}</button>
          </>
        )}
        <button
          type="button" className={navButton} disabled={current >= safePages} onClick={() => onChange(current + 1)}
          aria-label="下一页" title="下一页"
        >
          <ChevronRight className="h-4 w-4"/>
        </button>
        {onSizeChange && (
          <Select value={String(size)} onValueChange={(value) => onSizeChange(Number(value))}>
            <SelectTrigger className="ml-1 h-8 w-[104px] px-2 text-xs" aria-label="每页条数">
              <SelectValue/>
            </SelectTrigger>
            <SelectContent align="end">
              {options.map((option) => (
                <SelectItem key={option} value={String(option)}>{option} 条/页</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}

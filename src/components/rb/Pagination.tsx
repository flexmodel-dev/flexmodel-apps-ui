import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Pagination({
  page,
  pages,
  total,
  size,
  onChange,
  className,
}: {
  page: number
  pages: number
  total: number
  size: number
  onChange: (page: number) => void
  className?: string
}) {
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(page * size, total)
  const start = Math.max(1, page - 2)
  const end = Math.min(pages, start + 4)
  const nums = Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index)

  const baseButton = 'inline-flex h-8 items-center justify-center rounded-md px-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50'

  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-sm text-muted-foreground', className)}>
      <span>
        第 {from}-{to} 条，共 {total} 条
      </span>
      <span>每页 {size} 条</span>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" className={baseButton} disabled={page <= 1} onClick={() => onChange(1)}>
          首页
        </button>
        <button type="button" className={baseButton} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        {nums.map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            className={cn(
              'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors',
              num === page ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {num}
          </button>
        ))}
        <button type="button" className={baseButton} disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" className={baseButton} disabled={page >= pages} onClick={() => onChange(pages)}>
          末页
        </button>
      </div>
    </div>
  )
}

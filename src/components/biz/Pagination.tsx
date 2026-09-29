import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export function Pagination({
  page,
  pages,
  total,
  size,
                             sizeOptions = [20, 50, 100, 500, 1000],
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
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(page * size, total)
  const start = Math.max(1, page - 2)
  const end = Math.min(pages, start + 4)
  const nums = Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index)

  const baseButton = 'inline-flex h-8 items-center justify-center rounded-md px-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50'

  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-sm text-muted-foreground', className)}>
      <span>
        共 {total} 条
      </span>
      <div className="ml-auto flex items-center gap-1">
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
        {onSizeChange && (
          <Select
            value={String(size)}
            onValueChange={(value) => onSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[110px] px-2 text-sm">
              <SelectValue/>
            </SelectTrigger>
            <SelectContent align="end">
              {sizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}条/页
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}

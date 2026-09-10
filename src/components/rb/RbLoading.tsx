import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RbLoading({ className, center }: { className?: string; center?: boolean }) {
  return (
    <div className={cn('flex items-center justify-center text-muted-foreground', center && 'min-h-[200px]', className)}>
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )
}

export function RbNoData({ text = '暂无数据' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-muted-foreground">
      <Loader2 className="h-6 w-6" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

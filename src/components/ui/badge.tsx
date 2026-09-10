import * as React from 'react'
import { cn } from '@/lib/utils'

/** 徽章 */
export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-[7px] py-[2px] text-[11px] font-normal leading-[14px]',
        className
      )}
    >
      {children}
    </span>
  )
}

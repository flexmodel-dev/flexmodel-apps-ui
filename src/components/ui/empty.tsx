import * as React from 'react'
import {cn} from '@/lib/utils'

function EmptyIllustration() {
  return (
    <svg viewBox="0 0 64 44" aria-hidden className="h-11 w-16">
      <ellipse cx="32" cy="39" rx="20" ry="3" fill="currentColor" fillOpacity="0.08"/>
      <path
        d="M10 19.5 27 9l17 10.5v12a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3v-12Z"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path
        d="M10 19.5 27 9l17 10.5M10 19.5v12a3 3 0 0 0 3 3h28a3 3 0 0 0 3-3v-12M10 19.5h34"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M27 9v13" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round"/>
      <path d="M27 22h10.5" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export interface EmptyProps {
  image?: React.ReactNode
  imageClassName?: string
  description?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export function Empty({
                        image = <EmptyIllustration/>,
                        imageClassName,
                        description = '暂无数据',
                        className,
                        children,
                      }: EmptyProps) {
  return (
    <div className={cn('flex w-full flex-col items-center justify-center px-4 py-12 text-center', className)}>
      {image !== null &&
        <div className={cn('mb-3 flex justify-center text-muted-foreground/70', imageClassName)}>{image}</div>}
      {description !== null && <div className="max-w-md text-sm text-muted-foreground">{description}</div>}
      {children && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  )
}

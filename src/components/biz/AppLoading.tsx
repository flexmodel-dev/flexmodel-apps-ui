import * as React from 'react'
import {Loader2} from 'lucide-react'
import {cn} from '@/lib/utils'

const sizeClass = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

export function AppLoading({className, center, size = 'md', label = '加载中'}: {
  className?: string
  center?: boolean
  size?: keyof typeof sizeClass
  label?: string
}) {
  return (
    <div role="status" aria-label={label}
         className={cn('flex items-center justify-center text-muted-foreground', center && 'min-h-[200px]', className)}>
      <Loader2 className={cn('animate-spin', sizeClass[size])} aria-hidden="true"/>
    </div>
  )
}

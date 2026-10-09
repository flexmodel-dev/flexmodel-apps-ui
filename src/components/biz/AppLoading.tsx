import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AppLoading({className, center}: { className?: string; center?: boolean }) {
  return (
    <div className={cn('flex items-center justify-center text-muted-foreground', center && 'min-h-[200px]', className)}>
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )
}

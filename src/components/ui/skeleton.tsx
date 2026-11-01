import {cn} from '@/lib/utils'

/** shadcn 风格骨架块 */
export function Skeleton({className}: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)}/>
}

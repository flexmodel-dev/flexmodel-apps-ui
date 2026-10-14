import {cn} from '@/lib/utils'

export function AppFormSectionTitle({label, className}: { label: string; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2 text-left text-sm text-foreground', className)}>
      <span className="h-4 w-1 shrink-0 rounded-full bg-primary"/>
      <span className="min-w-0 truncate font-semibold">{label}</span>
    </div>
  )
}

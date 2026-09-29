import * as React from 'react'
import {Ban, ChevronsUpDown, type LucideIcon} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {BizDialog} from '@/components/ui/dialog'
import {cn} from '@/lib/utils'

function IconPickerBase<T extends string, V extends T | 'none'>({
                                                                  value,
                                                                  options,
                                                                  icons,
                                                                  onChange,
                                                                  allowNone,
                                                                }: {
  value: V
  options: readonly T[]
  icons: Record<T, LucideIcon>
  onChange: (value: V) => void
  allowNone: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const SelectedIcon: LucideIcon | undefined = value === 'none' ? undefined : icons[value as T]

  const select = (nextValue: V) => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full justify-between px-3"
        onClick={() => setOpen(true)}
      >
        <span className="flex min-w-0 items-center gap-2">
          {SelectedIcon ? <SelectedIcon className="h-4 w-4 shrink-0"/> : <Ban className="h-4 w-4 shrink-0"/>}
          <span className="truncate">{value === 'none' ? '无图标' : value}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground"/>
      </Button>

      <BizDialog
        open={open}
        onOpenChange={setOpen}
        title="选择图标"
        width={520}
      >
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {allowNone && (
            <button
              type="button"
              onClick={() => select('none' as V)}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent',
                value === 'none' && 'border-primary bg-primary/10 text-primary',
              )}
              title="无图标"
            >
              <Ban className="h-5 w-5"/>
            </button>
          )}
          {options.map((name) => {
            const Icon: LucideIcon = icons[name]
            return (
              <button
                key={name}
                type="button"
                onClick={() => select(name as V)}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent',
                  value === name && 'border-primary bg-primary/10 text-primary',
                )}
                title={name}
              >
                <Icon className="h-5 w-5"/>
              </button>
            )
          })}
        </div>
      </BizDialog>
    </>
  )
}

export function IconPicker<T extends string>({
                                               value,
                                               options,
                                               icons,
                                               onChange,
                                             }: {
  value: T
  options: readonly T[]
  icons: Record<T, LucideIcon>
  onChange: (value: T) => void
}) {
  return (
    <IconPickerBase
      value={value}
      options={options}
      icons={icons}
      onChange={onChange}
      allowNone={false}
    />
  )
}

export function OptionalIconPicker<T extends string>({
                                                       value,
                                                       options,
                                                       icons,
                                                       onChange,
                                                     }: {
  value: T | 'none'
  options: readonly T[]
  icons: Record<T, LucideIcon>
  onChange: (value: T | 'none') => void
}) {
  return (
    <IconPickerBase
      value={value}
      options={options}
      icons={icons}
      onChange={onChange}
      allowNone={true}
    />
  )
}

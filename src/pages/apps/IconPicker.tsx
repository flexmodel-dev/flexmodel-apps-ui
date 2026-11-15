import * as React from 'react'
import {Ban, ChevronsUpDown, Search} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {BizDialog} from '@/components/ui/dialog'
import {cn} from '@/lib/utils'
import {appIconGroups, appIcons, type AppIconName} from '@/data/appIcons'

function IconPickerBase({
                          value,
                          onChange,
                          allowNone,
                        }: {
  value: AppIconName | 'none'
  onChange: (value: AppIconName | 'none') => void
  allowNone: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const keyword = query.trim().toLowerCase()

  const searchResults = keyword
    ? appIconGroups.flatMap((group) => group.icons).filter((name) => name.toLowerCase().includes(keyword))
    : null

  const SelectedIcon = value === 'none' ? undefined : appIcons[value]

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setQuery('')
  }

  const select = (nextValue: AppIconName | 'none') => {
    onChange(nextValue)
    handleOpenChange(false)
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
        onOpenChange={handleOpenChange}
        title="选择图标"
        width={580}
      >
        <div className="sticky top-0 z-10 -mx-1.5 bg-background px-1.5 pb-2">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索图标名称"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="mt-3">
          {searchResults ? (
            <IconGrid icons={searchResults} value={value} onSelect={select}/>
          ) : (
            <>
              {allowNone && (
                <section className="mb-4">
                  <GroupLabel label="无图标"/>
                  <div className="flex flex-wrap gap-1.5">
                    <IconTile
                      label="无图标"
                      selected={value === 'none'}
                      onClick={() => select('none')}
                    >
                      <Ban className="h-5 w-5"/>
                    </IconTile>
                  </div>
                </section>
              )}
              {appIconGroups.map((group) => (
                <section key={group.key} className="mb-4 last:mb-0">
                  <GroupLabel label={group.label}/>
                  <IconGrid icons={group.icons} value={value} onSelect={select}/>
                </section>
              ))}
            </>
          )}

          {searchResults && searchResults.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">未找到匹配的图标</div>
          )}
        </div>
      </BizDialog>
    </>
  )
}

function GroupLabel({label}: { label: string }) {
  return <div className="mb-2 text-xs font-semibold font-medium text-muted-foreground">{label}</div>
}

function IconGrid({
                    icons,
                    value,
                    onSelect,
                  }: {
  icons: readonly AppIconName[]
  value: AppIconName | 'none'
  onSelect: (value: AppIconName) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {icons.map((name) => {
        const Icon = appIcons[name]
        return (
          <IconTile
            key={name}
            label={name}
            selected={value === name}
            onClick={() => onSelect(name)}
          >
            <Icon className="h-5 w-5"/>
          </IconTile>
        )
      })}
    </div>
  )
}

function IconTile({
                    label,
                    selected,
                    onClick,
                    children,
                  }: {
  label: string
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent',
        selected && 'border-primary bg-primary/10 text-primary',
      )}
      title={label}
      aria-label={label}
      aria-pressed={selected}
    >
      {children}
    </button>
  )
}

export function IconPicker({
                             value,
                             onChange,
                           }: {
  value: AppIconName
  onChange: (value: AppIconName) => void
}) {
  return (
    <IconPickerBase
      value={value}
      onChange={(nextValue) => {
        if (nextValue !== 'none') onChange(nextValue)
      }}
      allowNone={false}
    />
  )
}

export function OptionalIconPicker({
                                     value,
                                     onChange,
                                   }: {
  value: AppIconName | 'none'
  onChange: (value: AppIconName | 'none') => void
}) {
  return (
    <IconPickerBase
      value={value}
      onChange={onChange}
      allowNone={true}
    />
  )
}

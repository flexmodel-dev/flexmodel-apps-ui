import {APP_PRIMARY_COLORS, type AppPrimaryColor} from '@/theme/appPrimaryColors'
import {cn} from '@/lib/utils'

export function AppPrimaryColorPicker({
                                        value,
                                        onChange,
                                      }: {
  value: AppPrimaryColor
  onChange: (value: AppPrimaryColor) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {APP_PRIMARY_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          onClick={() => onChange(color.value)}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full border border-border/60 transition-all hover:scale-105',
            value === color.value && 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background',
          )}
          style={{backgroundColor: `hsl(${color.primary})`}}
          title={color.label}
          aria-label={color.label}
        />
      ))}
    </div>
  )
}

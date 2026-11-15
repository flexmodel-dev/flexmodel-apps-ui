import * as React from 'react'
import {Search, X} from 'lucide-react'
import {Input} from '@/components/ui/input'
import {cn} from '@/lib/utils'

/** 带搜索图标的输入框，可选清空按钮 */
export function SearchInput({value, onChange, onClear, placeholder, className, ...props}: {
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onClear?: () => void
  placeholder?: string
  className?: string
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'placeholder' | 'className'>) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pl-9 pr-9"
        {...props}
      />
      {onClear && value && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="清空搜索"
        >
          <X className="h-3.5 w-3.5"/>
        </button>
      )}
    </div>
  )
}

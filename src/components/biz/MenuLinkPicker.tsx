import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {entityMenuLinks, systemMenuLinks} from '@/data/mock'

export function MenuLinkPicker({
                                 value,
                                 onChange,
                               }: {
  value?: string
  onChange: (value?: string) => void
}) {
  const menuLinks = [...systemMenuLinks, ...entityMenuLinks]
  const selectedValue = menuLinks.some((link) => link.to === value) ? value : 'none'

  return (
    <Select
      value={selectedValue}
      onValueChange={(nextValue) => onChange(nextValue === 'none' ? undefined : nextValue)}
    >
      <SelectTrigger>
        <SelectValue placeholder="未关联"/>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">未关联</SelectItem>
        <SelectGroup>
          <SelectLabel>系统内置</SelectLabel>
          {systemMenuLinks.map((link) => (
            <SelectItem key={link.id} value={link.to}>
              {link.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator/>
        <SelectGroup>
          <SelectLabel>实体</SelectLabel>
          {entityMenuLinks.map((link) => (
            <SelectItem key={link.id} value={link.to}>
              {link.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

import * as React from 'react'
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
import {getAppMenuTargets, type AppMenuTargets} from '@/services/appMenus'

interface MenuLinkOption {
  id: string
  label: string
  value: string
}

export function MenuLinkPicker({
                                 value,
                                 onChange,
                                 appId,
                               }: {
  value?: string
  onChange: (value?: string) => void
  appId?: string
}) {
  const [appTargets, setAppTargets] = React.useState<AppMenuTargets>({builtIn: [], entities: []})

  React.useEffect(() => {
    if (!appId) {
      setAppTargets({builtIn: [], entities: []})
      return
    }
    let cancelled = false
    getAppMenuTargets(appId)
      .then((targets) => !cancelled && setAppTargets(targets))
      .catch(() => !cancelled && setAppTargets({builtIn: [], entities: []}))
    return () => {
      cancelled = true
    }
  }, [appId])

  const builtInLinks: MenuLinkOption[] = appId
    ? appTargets.builtIn.map((target) => ({
      id: target.id,
      label: target.label ?? target.id,
      value: `${target.type}:${target.id}`,
    }))
    : systemMenuLinks.map((link) => ({
      id: link.id,
      label: link.label,
      value: link.to,
    }))
  const entityLinks: MenuLinkOption[] = appId
    ? appTargets.entities.map((target) => ({
      id: target.id,
      label: target.label ?? target.id,
      value: `${target.type}:${target.id}`,
    }))
    : entityMenuLinks.map((link) => ({
      id: link.id,
      label: link.label,
      value: link.to,
    }))
  const menuLinks = [...builtInLinks, ...entityLinks]
  const selectedValue = menuLinks.find((link) => link.value === value)?.value

  return (
    <Select
      value={selectedValue}
      onValueChange={onChange}
    >
      <SelectTrigger>
        <SelectValue placeholder="请选择关联项"/>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>系统内置</SelectLabel>
          {builtInLinks.map((link) => (
            <SelectItem key={link.id} value={link.value}>
              {link.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator/>
        <SelectGroup>
          <SelectLabel>表单</SelectLabel>
          {entityLinks.map((link) => (
            <SelectItem key={link.id} value={link.value}>
              {link.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

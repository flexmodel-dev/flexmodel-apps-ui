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
import {Input} from '@/components/ui/input'
import {formMenuLinks, systemMenuLinks} from '@/data/mock'
import {getAppMenuTargets, isValidHttpUrl, type AppMenuTargets} from '@/services/appMenus'

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
  const [appTargets, setAppTargets] = React.useState<AppMenuTargets>({
    builtIn: [],
    forms: [],
  })

  React.useEffect(() => {
    if (!appId) {
      setAppTargets({builtIn: [], forms: []})
      return
    }
    let cancelled = false
    getAppMenuTargets(appId)
      .then((targets) => !cancelled && setAppTargets(targets))
      .catch(() => !cancelled && setAppTargets({builtIn: [], forms: []}))
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
  const formLinks: MenuLinkOption[] = appId
    ? appTargets.forms.map((target) => ({
      id: target.id,
      label: target.label ?? target.id,
      value: `${target.type}:${target.id}`,
    }))
    : formMenuLinks.map((link) => ({
      id: link.id,
      label: link.label,
      value: link.to,
    }))
  const menuLinks = [...builtInLinks, ...formLinks]
  const isCustomLink = value?.startsWith('LINK:')
  const customLinkUrl = isCustomLink ? value!.slice('LINK:'.length) : ''
  const customLinkValue = `LINK:${customLinkUrl}`
  const selectedValue = isCustomLink ? customLinkValue : menuLinks.find((link) => link.value === value)?.value

  return (
    <div className="space-y-3">
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
          <SelectGroup>
            <SelectLabel>表单</SelectLabel>
            {formLinks.map((link) => (
              <SelectItem key={link.id} value={link.value}>
                {link.label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator/>
          <SelectGroup>
            <SelectLabel>自定义链接</SelectLabel>
            <SelectItem value={customLinkValue}>自定义链接</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {isCustomLink ? (
        <div>
          <Input
            value={customLinkUrl}
            placeholder="https://example.com"
            onChange={(event) => onChange?.(`LINK:${event.target.value}`)}
          />
          {!isValidHttpUrl(customLinkUrl) ? (
            <p className="mt-1 text-xs text-destructive">请输入有效的 http 或 https 链接。</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

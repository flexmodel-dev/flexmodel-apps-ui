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
import {getAppNavDestinations, isValidHttpUrl, type AppNavDestinations} from '@/services/appNavigation'

interface NavDestinationOption {
  id: string
  label: string
  value: string
}

export function NavDestinationPicker({
                                       value,
                                       onChange,
                                       appId,
                                     }: {
  value?: string
  onChange: (value?: string) => void
  appId?: string
}) {
  const [appDestinations, setAppDestinations] = React.useState<AppNavDestinations>({
    builtIn: [],
    forms: [],
  })

  React.useEffect(() => {
    if (!appId) {
      setAppDestinations({builtIn: [], forms: []})
      return
    }
    let cancelled = false
    getAppNavDestinations(appId)
      .then((destinations) => !cancelled && setAppDestinations(destinations))
      .catch(() => !cancelled && setAppDestinations({builtIn: [], forms: []}))
    return () => {
      cancelled = true
    }
  }, [appId])

  const builtInDestinations: NavDestinationOption[] = appId
    ? appDestinations.builtIn.map((destination) => ({
      id: destination.id,
      label: destination.label ?? destination.id,
      value: `${destination.type}:${destination.id}`,
    }))
    : systemMenuLinks.map((link) => ({
      id: link.id,
      label: link.label,
      value: link.to,
    }))
  const formDestinations: NavDestinationOption[] = appId
    ? appDestinations.forms.map((destination) => ({
      id: destination.id,
      label: destination.label ?? destination.id,
      value: `${destination.type}:${destination.id}`,
    }))
    : formMenuLinks.map((link) => ({
      id: link.id,
      label: link.label,
      value: link.to,
    }))
  const navDestinations = [...builtInDestinations, ...formDestinations]
  const isCustomLink = value?.startsWith('LINK:')
  const customLinkUrl = isCustomLink ? value!.slice('LINK:'.length) : ''
  const customLinkValue = `LINK:${customLinkUrl}`
  const selectedValue = isCustomLink ? customLinkValue : navDestinations.find((link) => link.value === value)?.value

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
            {builtInDestinations.map((link) => (
              <SelectItem key={link.id} value={link.value}>
                {link.label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>表单</SelectLabel>
            {formDestinations.map((link) => (
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

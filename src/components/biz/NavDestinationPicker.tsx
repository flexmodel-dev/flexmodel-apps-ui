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
import {getWorkbenches, type WorkbenchSummary} from '@/services/workbenches'

interface NavDestinationOption {
  id: string
  label: string
  value: string
}

const WORKBENCH_DESTINATION_VALUE = 'BUILTIN:workbench'

export function NavDestinationPicker({
                                       value,
                                       onChange,
                                       appId,
                                       workbenchId,
                                       onWorkbenchChange,
                                     }: {
  value?: string
  onChange: (value?: string) => void
  appId?: string
  workbenchId?: string | null
  onWorkbenchChange?: (workbenchId: string | null) => void
}) {
  const [appDestinations, setAppDestinations] = React.useState<AppNavDestinations>({
    builtIn: [],
    forms: [],
  })
  const [workbenches, setWorkbenches] = React.useState<WorkbenchSummary[]>([])
  const isWorkbenchSelected = appId && value === WORKBENCH_DESTINATION_VALUE

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

  React.useEffect(() => {
    if (!isWorkbenchSelected) return
    let cancelled = false
    getWorkbenches(appId!)
      .then((loaded) => !cancelled && setWorkbenches(loaded))
      .catch(() => !cancelled && setWorkbenches([]))
    return () => {
      cancelled = true
    }
  }, [isWorkbenchSelected, appId])

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
      {isWorkbenchSelected ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">工作台</label>
          <Select
            value={workbenchId || undefined}
            onValueChange={(next) => onWorkbenchChange?.(next || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="未选择时默认第一个工作台"/>
            </SelectTrigger>
            <SelectContent>
              {workbenches.map((workbench) => (
                <SelectItem key={workbench.id} value={workbench.id}>
                  {workbench.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
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

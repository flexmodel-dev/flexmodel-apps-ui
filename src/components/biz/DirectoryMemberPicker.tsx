import * as React from 'react'
import {Check, ChevronDown, Search, X} from 'lucide-react'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {AppLoading} from '@/components/biz/AppLoading'
import {getDirectory} from '@/services/directory'
import {cn, toErrorMessage} from '@/lib/utils'
import type {Directory, DirectoryEntityType, DirectorySelection} from '@/types/directory'

const allTypes: DirectoryEntityType[] = ['USER', 'ROLE', 'ORGANIZATION']
const labels = {USER: '用户', ROLE: '角色', ORGANIZATION: '组织架构'}
const keyOf = (value: DirectorySelection) => `${value.type}:${value.id}`

export interface DirectoryMemberPickerProps {
  appId?: string
  directory?: Directory
  value: DirectorySelection[]
  onChange: (value: DirectorySelection[]) => void
  types?: DirectoryEntityType[]
  multiple?: boolean
  disabled?: boolean
  allowIncludeChildren?: boolean
  label?: string
}

/** 通用目录选择器；动态范围和具体业务存储格式由调用方适配。 */
export function DirectoryMemberPicker({
                                        appId,
                                        directory: supplied,
                                        value,
                                        onChange,
                                        types = allTypes,
                                        multiple = true,
                                        disabled = false,
                                        allowIncludeChildren = true,
                                        label = '选择用户、角色或组织'
                                      }: DirectoryMemberPickerProps) {
  const [directory, setDirectory] = React.useState<Directory | undefined>(supplied)
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [type, setType] = React.useState<DirectoryEntityType>(types[0] ?? 'USER')
  const [open, setOpen] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  React.useEffect(() => {
    if (supplied) {
      setDirectory(supplied);
      return
    }
    if (!appId) {
      setError('缺少目录所属应用');
      return
    }
    let active = true
    setDirectory(undefined);
    setLoading(true);
    setError('')
    getDirectory(appId).then(data => {
      if (active) setDirectory(data)
    })
      .catch(caught => {
        if (active) setError(toErrorMessage(caught, '加载人员目录失败'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [appId, supplied, retry])
  const activeType = types.includes(type) ? type : types[0]
  const options = (kind: DirectoryEntityType) => kind === 'USER'
    ? (directory?.members ?? []).map(member => ({
      id: member.id,
      name: member.name,
      description: member.role,
      parentId: undefined as string | undefined
    }))
    : kind === 'ROLE' ? (directory?.roles ?? []).map(role => ({
        ...role,
        description: undefined,
        parentId: undefined as string | undefined
      }))
      : (directory?.organizations ?? []).map(org => ({...org, description: undefined}))
  const nameOf = (selection: DirectorySelection) => options(selection.type).find(item => item.id === selection.id)?.name ?? `${selection.id}（当前不可用）`
  const toggle = (id: string) => {
    const selection: DirectorySelection = {type: activeType, id}
    const exists = value.some(item => keyOf(item) === keyOf(selection))
    onChange(exists ? value.filter(item => keyOf(item) !== keyOf(selection)) : multiple ? [...value, selection] : [selection])
    if (!multiple) setOpen(false)
  }
  const depthOf = (id: string) => {
    const visited = new Set<string>();
    let depth = 0;
    let current = directory?.organizations.find(org => org.id === id)
    while (current?.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      depth++;
      current = directory?.organizations.find(org => org.id === current?.parentId)
    }
    return Math.min(depth, 8)
  }
  return <div className="space-y-2">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button type="button" variant="secondary" className="w-full justify-between"
                                      disabled={disabled} aria-label={label}>
        <span>{value.length ? `已选择 ${value.length} 项` : label}</span><ChevronDown className="h-4 w-4"/>
      </Button></PopoverTrigger>
      <PopoverContent align="start" className="z-[1100] w-80 max-w-[calc(100vw-2rem)] space-y-2 p-3">
        <div className="flex gap-1" role="tablist" aria-label="目录类型">{types.map(kind => <button type="button"
                                                                                                    key={kind}
                                                                                                    role="tab"
                                                                                                    aria-selected={activeType === kind}
                                                                                                    className={cn('flex-1 rounded-md px-2 py-2 text-sm', activeType === kind ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}
                                                                                                    onClick={() => {
                                                                                                      setType(kind);
                                                                                                      setSearch('')
                                                                                                    }}>{labels[kind]}</button>)}</div>
        <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/>
          <Input aria-label="搜索目录" placeholder="搜索名称" className="pl-8" value={search}
                 onChange={event => setSearch(event.target.value)}/></div>
        {loading && <AppLoading size="sm" className="py-3" label="正在加载目录成员"/>}
        {error && <div role="alert" className="space-y-2 text-sm text-destructive">{error}<Button type="button"
                                                                                                  variant="secondary"
                                                                                                  onClick={() => setRetry(n => n + 1)}>重试</Button>
        </div>}
        <div className="max-h-64 overflow-y-auto" role="group" aria-label={labels[activeType]}>
          {!loading && !error && options(activeType).filter(item => `${item.name} ${item.description ?? ''}`.toLowerCase().includes(search.toLowerCase())).map(item => {
            const checked = value.some(selection => selection.type === activeType && selection.id === item.id)
            return <button type="button" key={item.id} role="checkbox" aria-checked={checked}
                           onClick={() => toggle(item.id)}
                           className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
                           style={{paddingLeft: activeType === 'ORGANIZATION' ? 8 + depthOf(item.id) * 16 : 8}}>
              <span
                className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', checked && 'border-primary bg-primary text-primary-foreground')}>
                {checked && <Check className="h-3 w-3"/>}</span><span>{item.name}</span>
              {item.description && <span className="truncate text-xs text-muted-foreground">{item.description}</span>}
            </button>
          })}
          {!loading && !error && options(activeType).length === 0 &&
            <p className="p-2 text-sm text-muted-foreground">暂无{labels[activeType]}</p>}
        </div>
      </PopoverContent>
    </Popover>
    {value.length > 0 && <div className="flex flex-wrap gap-2">{value.map(item => <div key={keyOf(item)}
                                                                                       className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
      <span>{labels[item.type]} · {nameOf(item)}</span>
      {item.type === 'ORGANIZATION' && allowIncludeChildren && <label className="ml-1 flex items-center gap-1">
        <input type="checkbox" disabled={disabled} checked={item.includeChildren ?? false}
               onChange={event => onChange(value.map(v => keyOf(v) === keyOf(item) ? {
                 ...v,
                 includeChildren: event.target.checked
               } : v))}/>含子组织</label>}
      {!disabled && <button type="button" aria-label={`移除${nameOf(item)}`}
                            onClick={() => onChange(value.filter(v => keyOf(v) !== keyOf(item)))}><X
        className="h-3 w-3"/></button>}
    </div>)}</div>}
  </div>
}

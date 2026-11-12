import * as React from 'react'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {OptionalIconPicker} from '@/components/biz/IconPicker'
import {NavDestinationPicker} from '@/components/biz/NavDestinationPicker'
import {type AppIconName, isAppIconName} from '@/data/appIcons'
import {toErrorMessage} from '@/lib/utils'
import {
  type AppNav, type AppNavInput, createAppNav, getAppNavigation, isValidHttpUrl,
  navOrderInput, reorderAppNavigation, updateAppNav,
} from '@/services/appNavigation'

export interface NavEditorDraft {
  nav?: AppNav
  parentId?: string
  type?: AppNav['type']
  topLevel?: boolean
  text?: string
  link?: string
  insertAfterId?: string
}

export function NavEditorDialog({appId, draft, onClose, onSaved}: {
  appId: string
  draft: NavEditorDraft
  onClose: () => void
  onSaved: (nav: AppNav) => Promise<void>
}) {
  const nav = draft.nav
  const topLevel = nav ? !nav.parentId : Boolean(draft.topLevel)
  const type = nav?.type ?? draft.type ?? 'ENTRY'
  const parentId = nav?.parentId ?? draft.parentId
  const [text, setText] = React.useState(nav?.name ?? draft.text ?? '')
  const [link, setLink] = React.useState(nav?.destination ? `${nav.destination.type}:${nav.destination.id}` : draft.link)
  const [workbenchId, setWorkbenchId] = React.useState(nav?.destination?.workbenchId ?? null)
  const [robotId, setRobotId] = React.useState(nav?.destination?.robotId ?? null)
  const [icon, setIcon] = React.useState<AppIconName | 'none'>(isAppIconName(nav?.iconName) ? nav.iconName : 'none')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const createdNavId = React.useRef<string>()
  const separator = link?.indexOf(':') ?? -1
  const destination: AppNavInput['destination'] = separator < 0 ? null : {
    type: link!.slice(0, separator) as NonNullable<AppNavInput['destination']>['type'],
    id: link!.slice(separator + 1),
    ...(link === 'BUILTIN:workbench' ? {workbenchId} : {}),
    ...(link === 'BUILTIN:chatbot' ? {robotId} : {}),
  }
  const valid = Boolean(text.trim()) && (topLevel || Boolean(parentId))
    && (type === 'GROUP' || Boolean(destination?.id && (destination.type !== 'LINK' || isValidHttpUrl(destination.id))))
  const title = draft.insertAfterId ? '新增分组' : `${nav ? '编辑' : '新增'}${topLevel ? '一级菜单' : type === 'GROUP' ? '分组' : '菜单'}`

  const save = async () => {
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    try {
      const input: AppNavInput = {
        type, name: text.trim(), parentId: parentId ?? null,
        iconName: topLevel || icon === 'none' ? null : icon,
        destination: type === 'GROUP' ? null : destination,
      }
      const navId = nav?.id ?? createdNavId.current
      const saved = navId ? await updateAppNav(appId, navId, input) : await createAppNav(appId, input)
      // 排序或刷新失败后重试更新已创建的分组，避免重复新增。
      if (!nav) createdNavId.current = saved.id
      if (draft.insertAfterId) {
        // shortcut: 创建与排序分两次请求；需要原子插入时由后端支持指定位置。
        const loadedNavs = await getAppNavigation(appId)
        const savedNav = loadedNavs.find((item) => item.id === saved.id)
        const nextNavs = loadedNavs.filter((item) => item.id !== saved.id)
        const anchorIndex = nextNavs.findIndex((item) => item.id === draft.insertAfterId)
        if (anchorIndex < 0 || !savedNav) throw new Error('分组已发生变化，请刷新页面后重试。')
        nextNavs.splice(anchorIndex + 1, 0, savedNav)
        await reorderAppNavigation(appId, navOrderInput(nextNavs))
      }
      await onSaved(saved)
      onClose()
    } catch (caught) {
      const detail = toErrorMessage(caught, '保存菜单失败，请稍后重试。')
      setError(draft.insertAfterId && createdNavId.current
        ? `分组已创建，请重试以完成保存；关闭弹窗会保留该分组。${detail}`
        : detail)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BizDialog open onOpenChange={(open) => !open && !saving && onClose()} title={title}
               footer={<>
                 <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>取消</Button>
                 <Button type="button" disabled={!valid || saving}
                         onClick={() => void save()}>{saving ? '保存中…' : '保存'}</Button>
               </>}>
      {error && <p role="alert" className="mb-3 text-destructive">{error}</p>}
      <div className="space-y-3">
        <label htmlFor="nav-name" className="block text-xs font-medium text-foreground">名称</label>
        <Input id="nav-name" value={text} onChange={(event) => setText(event.target.value)} placeholder="请输入名称"
               disabled={saving}/>
        {type === 'ENTRY' && <>
          <p className="text-xs font-medium text-foreground">关联项</p>
          <NavDestinationPicker appId={appId} value={link} onChange={(value) => {
            setLink(value)
            if (value !== 'BUILTIN:workbench') setWorkbenchId(null)
            if (value !== 'BUILTIN:chatbot') setRobotId(null)
          }} workbenchId={workbenchId} onWorkbenchChange={setWorkbenchId} robotId={robotId} onRobotChange={setRobotId}/>
        </>}
        {!topLevel && <>
          <p className="text-xs font-medium text-foreground">图标</p>
          <OptionalIconPicker value={icon} onChange={setIcon}/>
        </>}
      </div>
    </BizDialog>
  )
}

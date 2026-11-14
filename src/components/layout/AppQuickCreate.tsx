import * as React from 'react'
import {Link} from 'react-router-dom'
import {Plus, Search, Send, Table2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {AppLoading} from '@/components/biz/AppLoading'
import {getApprovalFlows} from '@/services/workflows'
import type {ApprovalFlow} from '@/types/workflow'
import {toErrorMessage} from '@/lib/utils'
import {headerActionClass} from './TopHeaderShell'

export function AppQuickCreate({appId, forms, loading, onCreateRecord}: {
  appId?: string
  forms: Array<{ id: string; label: string }>
  loading: boolean
  onCreateRecord: (formName: string, launchFlow?: ApprovalFlow) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState('flow')
  const [query, setQuery] = React.useState('')
  const [flows, setFlows] = React.useState<ApprovalFlow[]>([])
  const [flowsLoading, setFlowsLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [reload, setReload] = React.useState(0)
  const openingForm = React.useRef(false)
  const searchInput = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open || !appId) return
    let cancelled = false
    setFlowsLoading(true)
    setError('')
    setFlows([])
    getApprovalFlows(appId)
      .then(result => {
        if (!cancelled) setFlows(result)
      })
      .catch(caught => {
        if (!cancelled) setError(toErrorMessage(caught, '加载流程失败'))
      })
      .finally(() => {
        if (!cancelled) setFlowsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, appId, reload])

  const search = query.trim().toLowerCase()
  const flowItems = flows.flatMap(flow => {
    const trigger = flow.publishedTrigger
    if (flow.status !== 'enabled' || trigger?.type !== 'MANUAL') return []
    const form = forms.find(item => item.id === trigger.formName)
    return form && `${flow.name} ${form.label}`.toLowerCase().includes(search) ? [{flow, form}] : []
  })
  const formItems = forms.filter(form => form.label.toLowerCase().includes(search))
  const choose = (formName: string, flow?: ApprovalFlow) => {
    openingForm.current = true
    setOpen(false)
    onCreateRecord(formName, flow)
  }
  const itemClass = 'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <Popover open={open} onOpenChange={value => {
      setOpen(value);
      setQuery('')
    }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="快捷新建" aria-label="快捷新建" className={headerActionClass}>
          <Plus className="h-5 w-5"/>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        aria-label="快捷新建"
        className="flex max-h-[min(60dvh,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
        onOpenAutoFocus={event => {
          event.preventDefault();
          searchInput.current?.focus()
        }}
        onCloseAutoFocus={event => {
          if (openingForm.current) event.preventDefault()
          openingForm.current = false
        }}
      >
        <Tabs value={tab} onValueChange={value => {
          setTab(value);
          setQuery('')
        }} className="flex min-h-0 flex-col">
          <div className="shrink-0 space-y-3 border-b p-3">
            <TabsList aria-label="新建类型" className="grid w-full grid-cols-2">
              <TabsTrigger value="flow">发起流程</TabsTrigger>
              <TabsTrigger value="record">新增数据</TabsTrigger>
            </TabsList>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
              <Input
                ref={searchInput}
                aria-label={tab === 'flow' ? '搜索流程' : '搜索表单'}
                placeholder={tab === 'flow' ? '搜索流程或关联表单' : '搜索表单'}
                value={query}
                onChange={event => setQuery(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <TabsContent value="flow" className="min-h-0 overflow-y-auto overscroll-contain p-1.5">
            {loading || (appId && flowsLoading) ? <AppLoading center className="py-6"/> : error ? (
              <div className="space-y-2 p-3 text-sm">
                <p role="alert" className="text-destructive">{error}</p>
                <Button variant="secondary" size="sm" onClick={() => setReload(value => value + 1)}>重试</Button>
              </div>
            ) : flowItems.length === 0 ? (
              <div className="space-y-2 px-3 py-6 text-center text-sm text-muted-foreground">
                <p>{search ? '没有匹配的流程' : flows.length ? '已配置流程，暂无可发起的流程' : '暂无可发起的流程'}</p>
                {!search && <>
                  <p className="text-xs">这里只显示已发布并启用、绑定可见表单的手动流程。</p>
                  {appId && <Button variant="secondary" size="sm" asChild>
                    <Link to={`/admin/apps/${appId}/settings/workflows`}
                          onClick={() => setOpen(false)}>工作流设置</Link>
                  </Button>}
                </>}
              </div>
            ) : flowItems.map(({flow, form}) => (
              <button key={flow.id} type="button" className={itemClass} onClick={() => choose(form.id, flow)}>
                <Send className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/>
                <span className="min-w-0 space-y-1">
                  <span className="block break-words">{flow.name}</span>
                  <span className="block break-words text-xs text-muted-foreground">关联表单：{form.label}</span>
                </span>
              </button>
            ))}
          </TabsContent>
          <TabsContent value="record" className="min-h-0 overflow-y-auto overscroll-contain p-1.5">
            {loading ? <AppLoading center className="py-6"/> : formItems.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {search ? '没有匹配的表单' : '当前应用菜单暂未绑定表单'}
              </p>
            ) : formItems.map(form => (
              <button key={form.id} type="button" className={itemClass} onClick={() => choose(form.id)}>
                <Table2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/>
                <span className="min-w-0 break-words">{form.label}</span>
              </button>
            ))}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

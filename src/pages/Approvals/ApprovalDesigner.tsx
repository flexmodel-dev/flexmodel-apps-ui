import * as React from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import type {FixedLayoutPluginContext} from '@flowgram.ai/fixed-layout-editor'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  Maximize,
  Minus,
  Moon,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Redo2,
  Save,
  Settings2,
  ShieldCheck,
  Sun,
  Undo2,
  Workflow,
} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {BizDialog} from '@/components/ui/dialog'
import {Drawer, DrawerContent, DrawerTitle} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {message} from '@/components/ui/message'
import {AppLoading} from '@/components/biz/AppLoading'
import {getAppById} from '@/services/apps'
import {
  getApprovalDirectory,
  getApprovalFlows,
  saveApprovalFlow,
  publishFlow,
  validateApprovalFlow
} from '@/services/approvals'
import {ApprovalDirectoryContext} from './directory'
import type {ApprovalDocument, ApprovalFlow, ApprovalNode, MemberDirectory, ValidationIssue} from '@/types/approval'
import {cloneNode, createApprovalNode, flattenNodes, validateFlow,} from '@/lib/approval'
import {cn, toErrorMessage} from '@/lib/utils'
import {useDarkMode} from '@/lib/useDarkMode'
import FlowCanvas, {findNode} from './FlowCanvas'
import NodePanel from './NodePanel'
import SimulationPanel from './SimulationPanel'
import {useApprovalForms} from './controls'
import {FlowStatus} from './ApprovalList'

export default function ApprovalDesigner() {
  const {appId = '', flowId = ''} = useParams()
  const navigate = useNavigate()
  const [flow, setFlow] = React.useState<ApprovalFlow | null>(null)
  const [flows, setFlows] = React.useState<ApprovalFlow[]>([])
  const [directory, setDirectory] = React.useState<MemberDirectory>({members: [], organizations: []})
  const [saving, setSaving] = React.useState(false)
  const [appName, setAppName] = React.useState('')
  const [loadError, setLoadError] = React.useState('')
  const [selected, setSelected] = React.useState('')
  const [panelOpen, setPanelOpen] = React.useState(true)
  const [narrow, setNarrow] = React.useState(() => window.innerWidth < 1024)
  const [preview, setPreview] = React.useState(false)
  const [issues, setIssues] = React.useState<ValidationIssue[]>([])
  const [showIssues, setShowIssues] = React.useState(false)
  const [validationStarted, setValidationStarted] = React.useState(false)
  const [saved, setSaved] = React.useState('')
  const [ctx, setCtx] = React.useState<FixedLayoutPluginContext | null>(null)
  const [, refresh] = React.useReducer((value) => value + 1, 0)
  const [leavePath, setLeavePath] = React.useState('')
  const [deleteNodeId, setDeleteNodeId] = React.useState('')
  const [dark, setDark] = useDarkMode()
  const {
    forms,
    error: formError,
    reload,
    loading: formsLoading,
  } = useApprovalForms(appId)
  const dirty = !!flow && JSON.stringify(flow) !== saved
  const dirtyRef = React.useRef(false)
  dirtyRef.current = dirty
  const historyIndex = React.useRef<number>(window.history.state?.idx ?? 0)
  React.useEffect(() => {
    let active = true
    getAppById(appId)
      .then(async (app) => {
        if (!active) return
        const [loaded, loadedDirectory] = await Promise.all([getApprovalFlows(appId), getApprovalDirectory(appId)])
        if (!active) return
        setDirectory(loadedDirectory)
        const current = loaded.find((item) => item.id === flowId)
        if (!current) throw new Error('流程不存在或已被删除')
        setAppName(app.name)
        setFlows(loaded)
        setFlow(current)
        setSaved(JSON.stringify(current))
        setLoadError('')
      })
      .catch((error) => {
        if (active)
          setLoadError(toErrorMessage(error, '读取流程失败'))
      })
    return () => {
      active = false
    }
  }, [appId, flowId])
  React.useEffect(() => {
    const resize = () => setNarrow(window.innerWidth < 1024)
    window.addEventListener('resize', resize)
    const unload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', unload)
    let reverting = false
    const pop = (event: PopStateEvent) => {
      if (reverting) {
        reverting = false
        return
      }
      if (
        dirtyRef.current &&
        !window.confirm('当前流程有未保存的修改，确认离开吗？')
      ) {
        event.stopImmediatePropagation()
        const target = event.state?.idx ?? historyIndex.current - 1
        reverting = true
        window.history.go(historyIndex.current - target || 1)
      }
    }
    window.addEventListener('popstate', pop, true)
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('beforeunload', unload)
      window.removeEventListener('popstate', pop, true)
    }
  }, [])
  const onReady = React.useCallback(
    (value: FixedLayoutPluginContext) => setCtx(value),
    [],
  )
  const onDocumentChange = React.useCallback(
    (value: FixedLayoutPluginContext) => {
      const definition = value.document.toJSON() as ApprovalDocument
      setFlow((current) =>
        current &&
        JSON.stringify(current.definition) !== JSON.stringify(definition)
          ? {...current, definition}
          : current,
      )
      refresh()
    },
    [],
  )
  const select = (id: string) => {
    setSelected(id)
    setPanelOpen(true)
    if (id && ctx?.document.getNode(id))
      void ctx.playground.scrollToView({
        bounds: ctx.document.getNode(id)!.bounds,
        scrollToCenter: true,
      })
  }
  const requestLeave = (path: string) => {
    if (dirty) setLeavePath(path)
    else navigate(path)
  }
  const save = async (): Promise<boolean> => {
    if (!flow) return false
    setSaving(true)
    try {
      const current = await saveApprovalFlow({
        ...flow,
        status: flow.status,
      })
      setFlow(current)
      setSaved(JSON.stringify(current))
      setFlows(await getApprovalFlows(appId))
      message.success('流程草稿已保存到服务器')
      return true
    } catch (error) {
      message.error(toErrorMessage(error, '保存失败'))
      return false
    } finally {
      setSaving(false)
    }
  }
  const check = async () => {
    if (!flow) return false
    setValidationStarted(true)
    try {
      const result = await validateApprovalFlow(flow)
      setIssues(result)
      setShowIssues(!!result.length)
      return result.length === 0
    } catch (error) {
      message.error(toErrorMessage(error, '校验失败，请重试'));
      return false
    }
  }
  React.useEffect(() => {
    if (validationStarted && flow) setIssues(validateFlow(flow, flows, forms))
  }, [validationStarted, flow, flows, forms])
  const updateNode = (node: ApprovalNode) => {
    if (!ctx) return
    ctx.operation.startTransaction()
    ctx.operation.setFormValue(node.id, 'title', node.data.title)
    ctx.operation.setFormValue(node.id, 'config', node.data.config)
    ctx.operation.endTransaction()
    onDocumentChange(ctx)
  }
  const addBranch = (id: string) => {
    if (!ctx || !flow) return
    const gateway = findNode(flow.definition.nodes, id)
    const branch = createApprovalNode('branch')
    branch.data.title = `条件分支 ${gateway?.blocks?.length ?? 1}`
    ctx.operation.addBlock(id, branch, {
      index: Math.max(0, (gateway?.blocks?.length ?? 1) - 1),
    })
    onDocumentChange(ctx)
    select(branch.id)
  }
  const move = (id: string, delta: number) => {
    if (!ctx) return
    const entity = ctx.document.getNode(id)
    const parent = entity?.originParent ?? entity?.parent
    if (!entity || !parent) return
    const index = parent.blocks.findIndex((item) => item.id === id)
    ctx.operation.moveNode(id, {parent, index: Math.max(0, index + delta)})
    onDocumentChange(ctx)
  }
  React.useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  })
  const backPath = `/admin/apps/${appId}/settings/approvals`
  if (!flow)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Workflow className="h-9 w-9 text-primary"/>
        {loadError
          ? <p className="text-sm text-muted-foreground">{loadError}</p>
          : <AppLoading className="p-0" label="正在加载流程设计器"/>}
        {loadError && (
          <Button variant="outline" onClick={() => navigate(backPath)}>
            返回审批流程
          </Button>
        )}
      </div>
    )
  const currentNode = findNode(flow.definition.nodes, selected)
  const panel = (
    <ApprovalDirectoryContext.Provider value={directory}><NodePanel
      flow={flow}
      flows={flows}
      forms={forms}
      node={currentNode}
      onFlowChange={setFlow}
      onChange={updateNode}
      onSelect={select}
      onClose={() => setPanelOpen(false)}
      onCopy={() => {
        if (!ctx || !currentNode) return
        const duplicate = ctx.operation.addFromNode(
          currentNode.id,
          cloneNode(currentNode),
        )
        onDocumentChange(ctx)
        select(duplicate.id)
      }}
      onDelete={() => setDeleteNodeId(selected)}
      onAddBranch={addBranch}
      onMove={move}
      onOpenSubflow={(id) =>
        requestLeave(`/admin/apps/${appId}/approvals/${id}/design`)
      }
    /></ApprovalDirectoryContext.Provider>
  )
  return (
    <div className="flex h-screen min-h-0 flex-col bg-card text-foreground">
      <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            title="返回审批流程"
            onClick={() => requestLeave(backPath)}
          >
            <ArrowLeft className="h-4 w-4"/>
          </Button>
          <div className="mr-1 hidden h-7 border-l sm:block"/>
          <span
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
            <Workflow className="h-5 w-5"/>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="max-w-[35vw] truncate text-sm font-semibold">
                {flow.name}
              </h1>
              <span className="hidden sm:inline-flex">
                <FlowStatus status={flow.status}/>
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="truncate">{appName} / 审批流程</span>
              <span>·</span>
              <span className="inline-flex shrink-0 items-center gap-1">
                {dirty ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-primary"/>
                    有未保存修改
                  </>
                ) : (
                  <>
                    <Check className="h-2.5 w-2.5"/>
                    已保存到服务器
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            title="切换明暗主题"
            variant="ghost"
            size="xs"
            onClick={() => setDark(value => !value)}
          >
            {dark ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={formsLoading}
            onClick={async () => {
              if (await check()) setPreview(true)
            }}
          >
            <Play className="h-3.5 w-3.5"/>
            <span className="hidden sm:inline">模拟预览</span>
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            <Save className="h-3.5 w-3.5"/>
            <span className="hidden sm:inline">保存草稿</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" title="流程操作">
                <MoreHorizontal className="h-4 w-4"/>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={async () => {
                  if (await check()) message.success('流程配置检查通过')
                }}
              >
                <ShieldCheck className="h-4 w-4"/>
                检查流程
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  if (dirty) {
                    message.error('请先保存草稿，再发布启用');
                    return
                  }
                  if (!(await check())) return
                  try {
                    const enabled = await publishFlow(flow)
                    setFlow(enabled)
                    setSaved(JSON.stringify(enabled))
                    setFlows(await getApprovalFlows(appId))
                    message.success('流程新版本已发布')
                  } catch (error) {
                    message.error(
                      toErrorMessage(error, '启用失败'),
                    )
                  }
                }}
              >
                <Play className="h-4 w-4"/>
                发布新版本
              </DropdownMenuItem>
              <DropdownMenuSeparator/>
              <DropdownMenuItem onSelect={() => select('')}>
                <Settings2 className="h-4 w-4"/>
                流程设置
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {formError && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/5 px-6 py-2 text-xs text-destructive"
        >
          <span>应用表单读取失败：{formError}。可继续体验示例表单。</span>
          <button onClick={reload} className="shrink-0 underline">
            重新加载
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <main className="approval-workspace min-w-0 flex-1 overflow-hidden">
          <div className="pointer-events-none absolute left-5 right-5 top-5 z-10 flex justify-between">
            <div
              className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-card/95 px-3 py-2 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primary"/>
              <span className="text-xs font-medium">流程设计</span>
              <span className="mx-1 h-3 border-l"/>
              <span className="text-[10px] text-muted-foreground">
                {
                  flattenNodes(flow.definition.nodes).filter(
                    (node) => !['branch', 'start', 'end'].includes(node.type),
                  ).length
                }{' '}
                个步骤
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              title="流程设置"
              className="pointer-events-auto bg-card"
              onClick={() => {
                setSelected('')
                setPanelOpen((value) => !value || !!selected)
              }}
            >
              {panelOpen ? (
                <PanelRightClose className="h-4 w-4"/>
              ) : (
                <PanelRightOpen className="h-4 w-4"/>
              )}
              <span className="hidden md:inline">配置面板</span>
            </Button>
          </div>
          <FlowCanvas
            key={flowId}
            initialData={flow.definition}
            document={flow.definition}
            defaultForm={flow.form}
            selected={selected}
            issues={issues}
            onSelect={(id) => {
              setSelected(id)
              setPanelOpen(true)
            }}
            onChange={onDocumentChange}
            onReady={onReady}
          />
          <div
            className="absolute bottom-6 left-5 z-10 flex items-center gap-0.5 rounded-lg border bg-card p-1 shadow-sm">
            <Button
              variant="ghost"
              size="xs"
              title="撤销"
              disabled={!ctx?.history.canUndo()}
              onClick={async () => {
                await ctx?.history.undo()
                if (ctx) onDocumentChange(ctx)
              }}
            >
              <Undo2 className="h-3.5 w-3.5"/>
            </Button>
            <Button
              variant="ghost"
              size="xs"
              title="重做"
              disabled={!ctx?.history.canRedo()}
              onClick={async () => {
                await ctx?.history.redo()
                if (ctx) onDocumentChange(ctx)
              }}
            >
              <Redo2 className="h-3.5 w-3.5"/>
            </Button>
            <span className="mx-1 h-4 border-l"/>
            <Button
              variant="ghost"
              size="xs"
              title="缩小画布"
              onClick={() => {
                ctx?.playground.config.zoomout()
                refresh()
              }}
            >
              <Minus className="h-3.5 w-3.5"/>
            </Button>
            <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
              {Math.round((ctx?.playground.config.zoom ?? 1) * 100)}%
            </span>
            <Button
              variant="ghost"
              size="xs"
              title="放大画布"
              onClick={() => {
                ctx?.playground.config.zoomin()
                refresh()
              }}
            >
              <Plus className="h-3.5 w-3.5"/>
            </Button>
            <span className="mx-1 h-4 border-l"/>
            <Button
              variant="ghost"
              size="xs"
              title="适应画布"
              onClick={async () => {
                await ctx?.tools.fitView(false)
                refresh()
              }}
            >
              <Maximize className="h-3.5 w-3.5"/>
            </Button>
          </div>
          <div
            className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[9px] text-muted-foreground/70">
            点击节点配置 · 拖动节点调整顺序 · 滚轮移动画布 · Ctrl / ⌘ + S 保存
          </div>
        </main>
        {panelOpen && !narrow && (
          <aside className="z-10 w-[400px] shrink-0 border-l">{panel}</aside>
        )}
      </div>
      {issues.length > 0 && (
        <div className="z-20 shrink-0 border-t border-destructive/20 bg-card">
          <button
            className="flex w-full items-center justify-between px-6 py-2 text-xs text-destructive"
            onClick={() => setShowIssues((value) => !value)}
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5"/>
              {issues.length} 项配置待完善，点击查看
            </span>
            <ChevronDown
              className={cn('h-3.5 w-3.5', showIssues && 'rotate-180')}
            />
          </button>
          {showIssues && (
            <div className="max-h-32 overflow-y-auto border-t px-6 py-2">
              {issues.map((issue, index) => (
                <button
                  key={`${issue.nodeId}-${index}`}
                  className="block py-1 text-left text-xs text-muted-foreground"
                  onClick={() => select(issue.nodeId)}
                >
                  <span className="text-foreground">
                    {findNode(flow.definition.nodes, issue.nodeId)?.data
                      .title ?? '流程设置'}
                  </span>{' '}
                  · {issue.message}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {narrow && (
        <Drawer open={panelOpen} onOpenChange={setPanelOpen}>
          <DrawerContent
            aria-describedby={undefined}
            className="w-[min(92vw,400px)] p-0"
            hideClose
          >
            <DrawerTitle className="sr-only">节点配置</DrawerTitle>
            {panel}
          </DrawerContent>
        </Drawer>
      )}
      {preview && (
        <ApprovalDirectoryContext.Provider value={directory}><SimulationPanel
          key={flowId}
          open={preview}
          onOpenChange={setPreview}
          flow={flow}
          flows={flows}
          forms={forms}
          onLocate={(id) => {
            if (findNode(flow.definition.nodes, id)) select(id)
          }}
        /></ApprovalDirectoryContext.Provider>
      )}
      <BizDialog
        open={!!leavePath}
        onOpenChange={(open) => !open && setLeavePath('')}
        title="还有未保存的修改"
        footer={
          <>
            <Button variant="outline" onClick={() => setLeavePath('')}>
              继续编辑
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                dirtyRef.current = false
                navigate(leavePath)
              }}
            >
              放弃修改
            </Button>
            <Button
              onClick={async () => {
                if (await save()) {
                  dirtyRef.current = false
                  navigate(leavePath)
                }
              }}
            >
              保存并离开
            </Button>
          </>
        }
      >
        <p>离开前保存当前流程，方便下次继续编辑。</p>
      </BizDialog>
      <BizDialog
        open={!!deleteNodeId}
        onOpenChange={(open) => !open && setDeleteNodeId('')}
        title="删除流程节点"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteNodeId('')}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (ctx) {
                  ctx.operation.deleteNode(deleteNodeId)
                  onDocumentChange(ctx)
                }
                setSelected('')
                setDeleteNodeId('')
              }}
            >
              确认删除
            </Button>
          </>
        }
      >
        <p>
          确认删除「{findNode(flow.definition.nodes, deleteNodeId)?.data.title}
          」吗？
          {findNode(flow.definition.nodes, deleteNodeId)?.type === 'gateway' &&
            '网关中的所有分支和节点也会一起删除。'}
          可以通过撤销恢复。
        </p>
      </BizDialog>
    </div>
  )
}

import 'reflect-metadata'
import * as React from 'react'
import {
  ConstantKeys,
  EditorRenderer,
  FixedLayoutEditorProvider,
  FlowLayoutDefault,
  FlowNodeBaseType,
  FlowNodeSplitType,
  FlowRendererKey,
  useClientContext,
  useNodeRender,
  useService,
  type AdderProps,
  type FixedLayoutPluginContext,
  type FixedLayoutProps,
  type FlowNodeRegistry,
} from '@flowgram.ai/fixed-layout-editor'
import {
  createMinimapPlugin,
  FlowMinimapService,
  MinimapRender,
} from '@flowgram.ai/minimap-plugin'
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Circle,
  FilePlus2,
  FileSearch,
  GitBranch,
  GripVertical,
  Layers,
  PencilLine,
  Plus,
  Trash2,
  UserRoundCheck,
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {approvalDirectory} from '@/data/mock'
import type {
  ApprovalDocument,
  ApprovalNode,
  FormRef,
  NodeKind,
  ValidationIssue,
} from '@/types/workflow'
import {
  createApprovalNode,
  nodeLabels,
  signLabels,
  sourceLabels,
} from '@/lib/workflow'
import {cn} from '@/lib/utils'
import '@flowgram.ai/fixed-layout-editor/index.css'
import './workflow.css'

export const nodeIcons = {
  start: Circle,
  end: CheckCheck,
  notification: Bell,
  approval: UserRoundCheck,
  gateway: GitBranch,
  branch: GitBranch,
  create: FilePlus2,
  update: PencilLine,
  query: FileSearch,
  delete: Trash2,
  subflow: Layers,
}
export const addableKinds: NodeKind[] = [
  'notification',
  'approval',
  'gateway',
  'create',
  'update',
  'query',
  'delete',
  'subflow',
]
const descriptions: Partial<Record<NodeKind, string>> = {
  notification: '指定接收人并发送站内消息',
  approval: '指定执行人，配置签核方式',
  gateway: '根据条件进入不同分支',
  create: '向表单写入一条新记录',
  update: '更新符合条件的记录',
  query: '查询数据，传递给后续节点',
  delete: '删除符合条件的记录',
  subflow: '复用另一个工作流',
}

interface CanvasState {
  selected: string
  issues: ValidationIssue[]
  onSelect: (id: string) => void
  onChange: (ctx: FixedLayoutPluginContext) => void
  document: ApprovalDocument
  defaultForm: FormRef
}

const CanvasContext = React.createContext<CanvasState>(null!)
const blank = () => null

function DragPreview({
                       dragStart,
                     }: {
  dragStart?: { form?: { getValueIn: (path: string) => unknown } }
}) {
  return (
    <div className="w-48 rounded-lg border border-primary bg-card px-4 py-3 text-xs text-primary shadow-sm">
      {String(dragStart?.form?.getValueIn('title') ?? '移动节点')}
    </div>
  )
}

function DropHighlight() {
  return <div className="h-1 w-48 rounded bg-primary"/>
}

function DraggableAdder() {
  return (
    <div className="h-3 w-3 rounded-full border-2 border-primary bg-card"/>
  )
}

function summary(node: ApprovalNode): string {
  const c = node.data.config
  if (c.kind === 'notification') return c.titleTemplate || '请配置通知内容'
  if (c.kind === 'approval')
    return (
      c.rules
        .map((rule) => {
          if (rule.source === 'users')
            return (
              rule.values
                .map(
                  (id) =>
                    approvalDirectory.members.find((member) => member.id === id)
                      ?.name ?? '未知成员',
                )
                .join('、') || '请选择审批人'
            )
          return `${sourceLabels[rule.source]}${rule.scope === 'manager' ? '的直接上级' : ''}`
        })
        .join(' + ') || '请配置执行人'
    )
  if ('form' in c)
    return c.form.kind === 'demo'
      ? c.form.name === 'expense'
        ? '报销单（示例）'
        : '审批归档（示例）'
      : c.form.name
  if (c.kind === 'branch')
    return c.fallback
      ? '其他条件均不满足时进入'
      : c.conditions.length
        ? `${c.match === 'all' ? '全部' : '任一'} ${c.conditions.length} 项条件满足`
        : '请设置分支条件'
  if (c.kind === 'gateway')
    return `${node.blocks?.length ?? 0} 条路径 · 首个命中分支`
  if (c.kind === 'subflow')
    return c.flowId ? '同步执行 · 等待子流程完成' : '请选择要调用的流程'
  return c.kind === 'start' ? '提交记录后发起审批' : '流程处理完成'
}

function NodeCard() {
  const render = useNodeRender()
  const state = React.useContext(CanvasContext)
  const node: ApprovalNode = findNode(state.document.nodes, render.id) ?? {
    id: render.id,
    type: render.type as NodeKind,
    data: render.data,
  }
  if (!node.data?.config || !nodeIcons[node.type]) return null
  const Icon = nodeIcons[node.type],
    endpoint = node.type === 'start' || node.type === 'end',
    branch = node.type === 'branch'
  const selected = state.selected === node.id,
    invalid = state.issues.some((issue) => issue.nodeId === node.id)
  const c = node.data.config
  return (
    <div
      data-node-id={node.id}
      data-node-type={node.type}
      className={cn(
        'approval-node group cursor-pointer rounded-xl border bg-card shadow-sm',
        endpoint ? 'w-[230px]' : branch ? 'w-[240px]' : 'w-[268px]',
        selected
          ? 'border-primary ring-2 ring-primary/15'
          : invalid
            ? 'border-destructive'
            : 'border-border',
        render.dragging && 'opacity-40',
      )}
      onMouseEnter={render.onMouseEnter}
      onMouseLeave={render.onMouseLeave}
      onMouseDown={(event) => {
        if (
          !endpoint &&
          !branch &&
          !(event.target as HTMLElement).closest('button')
        )
          render.startDrag(event)
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.stopPropagation()
        state.onSelect(node.id)
      }}
      role="button"
      tabIndex={0}
      aria-label={`配置${node.data.title}`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          state.onSelect(node.id)
        }
      }}
    >
      <div
        className={cn(
          'flex items-center gap-3 px-4',
          endpoint ? 'py-3' : 'py-3.5',
        )}
      >
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            endpoint
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="h-4 w-4"/>
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">
            {node.data.title}
          </div>
          {endpoint && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {summary(node)}
            </div>
          )}
          {!endpoint && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              {nodeLabels[node.type]}
            </div>
          )}
        </div>
        {!endpoint && !branch && (
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40"/>
        )}
        {selected && endpoint && <Check className="h-3.5 w-3.5 text-primary"/>}
      </div>
      {!endpoint && (
        <div className="mx-4 border-t py-2.5">
          <p className="truncate text-[11px] text-muted-foreground">
            {summary(node)}
          </p>
          {c.kind === 'approval' && (
            <span className="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {signLabels[c.signMode]}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function findNode(
  nodes: ApprovalNode[],
  id: string,
): ApprovalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNode(node.blocks ?? [], id)
    if (found) return found
  }
}

function NodeAdder({from}: AdderProps) {
  const ctx = useClientContext() as FixedLayoutPluginContext
  const state = React.useContext(CanvasContext)
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="添加流程节点"
          onMouseDown={(event) => event.stopPropagation()}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-card text-primary shadow-sm"
        >
          <Plus className="h-3.5 w-3.5"/>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[1100] w-[290px] p-2"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="px-2 py-2 text-[11px] font-medium text-muted-foreground">
          添加流程节点
        </div>
        {addableKinds.map((kind, index) => {
          const Icon = nodeIcons[kind]
          return (
            <React.Fragment key={kind}>
              {index === 2 && <div className="my-2 border-t"/>}
              <button
                className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted"
                onClick={() => {
                  const next = createApprovalNode(kind)
                  if ('form' in next.data.config)
                    next.data.config.form = state.defaultForm
                  const entity = ctx.operation.addFromNode(from, next)
                  setOpen(false)
                  state.onChange(ctx)
                  state.onSelect(entity.id)
                }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4"/>
                </span>
                <span className="flex-1">
                  <span className="block text-xs font-medium">
                    {nodeLabels[kind]}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {descriptions[kind]}
                  </span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground"/>
              </button>
            </React.Fragment>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

const registries: FlowNodeRegistry[] = Object.keys(nodeLabels).map((type) => ({
  type,
  ...(type === 'gateway'
    ? {extend: FlowNodeSplitType.DYNAMIC_SPLIT}
    : type === 'branch'
      ? {extend: FlowNodeBaseType.BLOCK}
      : {}),
  meta: {
    draggable: !['start', 'end', 'branch'].includes(type),
    deleteDisable: ['start', 'end'].includes(type),
    copyDisable: ['start', 'end', 'branch'].includes(type),
    defaultExpanded: true,
    expandable: false,
    ...(type === 'start' ? {isStart: true} : {}),
    ...(type === 'end' ? {isNodeEnd: true} : {}),
  },
  formMeta: {render: blank},
}))

function WatchDocument({
                         onReady,
                       }: {
  onReady: (ctx: FixedLayoutPluginContext) => void
}) {
  const ctx = useClientContext() as FixedLayoutPluginContext
  const minimap = useService(FlowMinimapService)
  const {onChange} = React.useContext(CanvasContext)
  React.useEffect(() => {
    const updateColors = () => {
      const theme = getComputedStyle(document.documentElement)
      minimap.init({
        canvasStyle: {
          canvasWidth: 140,
          canvasHeight: 96,
          canvasBackground: 'transparent',
          viewportBackground: 'transparent',
          nodeColor: `hsl(${theme.getPropertyValue('--primary').trim()} / 0.45)`,
          viewportBorderColor: `hsl(${theme.getPropertyValue('--muted-foreground').trim()} / 0.6)`,
          overlayColor: 'transparent',
        },
      })
      minimap.render()
    }
    updateColors()
    const observer = new MutationObserver(updateColors)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-primary'],
    })
    return () => observer.disconnect()
  }, [minimap])
  React.useEffect(() => {
    onReady(ctx)
    let timer: ReturnType<typeof setTimeout> | undefined
    const notify = () => {
      clearTimeout(timer)
      timer = setTimeout(() => onChange(ctx), 0)
    }
    const tree = ctx.document.originTree.onTreeChange(notify)
    const history = ctx.history.onApply(notify)
    const zoom = ctx.playground.onZoom(notify)
    return () => {
      clearTimeout(timer)
      tree.dispose()
      history.dispose()
      zoom.dispose()
    }
  }, [ctx, onChange, onReady])
  return (
    <div className="absolute bottom-6 right-6 z-10 hidden overflow-hidden rounded-lg border bg-card shadow-sm md:block">
      <MinimapRender
        service={minimap}
        panelStyles={{
          backgroundColor: 'hsl(var(--card))',
          border: 'none',
          boxShadow: 'none',
        }}
        containerStyles={{
          pointerEvents: 'auto',
          position: 'relative',
          top: 'unset',
          right: 'unset',
          bottom: 'unset',
          left: 'unset',
        }}
        inactiveStyle={{opacity: 1, scale: 1, translateX: 0, translateY: 0}}
      />
    </div>
  )
}

interface Props extends CanvasState {
  initialData: ApprovalDocument
  onReady: (ctx: FixedLayoutPluginContext) => void
}

export default function FlowCanvas(props: Props) {
  const initial = React.useRef(props.initialData)
  const options = React.useMemo<FixedLayoutProps>(
    () => ({
      initialData: initial.current,
      defaultLayout: FlowLayoutDefault.VERTICAL_FIXED_LAYOUT,
      nodeRegistries: registries,
      nodeEngine: {enable: true},
      variableEngine: {enable: false},
      history: {enable: true},
      constants: {
        [ConstantKeys.BASE_COLOR]: 'hsl(var(--border))',
        [ConstantKeys.BASE_ACTIVATED_COLOR]: 'hsl(var(--primary))',
        [ConstantKeys.NODE_SPACING]: 56,
        [ConstantKeys.BRANCH_SPACING]: 40,
      },
      background: {backgroundColor: 'transparent', dotSize: 0},
      playground: {
        autoResize: true,
        autoFocus: false,
        preventGlobalGesture: true,
      },
      selectBox: {enable: false},
      materials: {
        renderDefaultNode: NodeCard,
        components: {
          [FlowRendererKey.ADDER]: NodeAdder,
          [FlowRendererKey.BRANCH_ADDER]: blank,
          [FlowRendererKey.COLLAPSE]: blank,
          [FlowRendererKey.SLOT_ADDER]: blank,
          [FlowRendererKey.SELECTOR_BOX_POPOVER]: blank,
          [FlowRendererKey.DRAG_NODE]: DragPreview,
          [FlowRendererKey.DRAG_HIGHLIGHT_ADDER]: DropHighlight,
          [FlowRendererKey.DRAG_BRANCH_HIGHLIGHT_ADDER]: DropHighlight,
          [FlowRendererKey.DRAGGABLE_ADDER]: DraggableAdder,
        },
      },
      plugins: () => [
        createMinimapPlugin({
          disableLayer: true,
          enableDisplayAllNodes: true,
          canvasStyle: {
            canvasWidth: 140,
            canvasHeight: 96,
            canvasBackground: 'transparent',
            viewportBackground: 'transparent',
          },
        }),
      ],
      onAllLayersRendered: (ctx) => {
        void ctx.tools.fitView(false)
      },
    }),
    [],
  )
  return (
    <CanvasContext.Provider value={props}>
      <FixedLayoutEditorProvider {...options}>
        <EditorRenderer className="approval-canvas h-full w-full"/>
        <WatchDocument onReady={props.onReady}/>
      </FixedLayoutEditorProvider>
    </CanvasContext.Provider>
  )
}

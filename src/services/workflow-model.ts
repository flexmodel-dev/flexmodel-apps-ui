import type {ApprovalFlow, ApprovalNode, FormRef} from '../types/workflow'

export interface FlowElement {
  key: string
  type: number
  incoming: string[]
  outgoing: string[]
  properties: Record<string, unknown>
}

export interface ApprovalFlowRecord {
  id: string;
  name: string;
  flowKey: string;
  description: string;
  model: { flowElementList: FlowElement[] };
  status: ApprovalFlow['status'];
  updatedAt?: string;
  publishedTrigger?: ApprovalFlow['publishedTrigger'];
  deploymentId?: string;
  hasDraftChanges?: boolean
}

// FlowGram's tree is an editor view; only the Flow graph crosses the API boundary.
export function encodeApprovalFlow(flow: ApprovalFlow): ApprovalFlowRecord {
  const graph = new Map<string, FlowElement>()
  const index = (nodes: ApprovalNode[], parent: string) => nodes.forEach((node, order) => {
    graph.set(node.id, {
      key: node.id,
      type: ({start: 2, end: 3, gateway: 6, branch: 1} as Record<string, number>)[node.type] ?? 4,
      incoming: [],
      outgoing: [],
      properties: {
        name: node.data.title,
        config: {...node.data.config},
        designer: {parent, order, container: node.blocks !== undefined}
      }
    })
    index(node.blocks ?? [], node.id)
  })
  index(flow.definition.nodes, '')
  const link = (source: FlowElement, target: FlowElement) => {
    source.outgoing.push(target.key);
    target.incoming.push(source.key)
  }
  const connect = (nodes: ApprovalNode[], next?: string): string | undefined => {
    let target = next
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i], element = graph.get(node.id)!
      if (node.type === 'gateway') {
        for (const branch of node.blocks ?? []) {
          const first = connect(branch.blocks ?? [], target), edge = graph.get(branch.id)!
          link(element, edge)
          if (first) link(edge, graph.get(first)!)
          edge.properties.defaultConditions = String(branch.data.config.kind === 'branch' && branch.data.config.fallback)
          // The server derives trusted expressions from the typed condition config.
          edge.properties.conditionsequenceflow = ''
        }
      } else if (target) {
        const key = `sequence_${node.id}`
        if (graph.has(key)) throw new Error('节点标识与连线标识冲突')
        const edge: FlowElement = {
          key,
          type: 1,
          incoming: [],
          outgoing: [],
          properties: {conditionsequenceflow: '', defaultConditions: 'false'}
        }
        graph.set(key, edge);
        link(element, edge);
        link(edge, graph.get(target)!)
      }
      target = node.id
    }
    return target
  }
  connect(flow.definition.nodes)
  const start = flow.definition.nodes[0]
  if (start) {
    const cfg = graph.get(start.id)!.properties.config as { kind: string; trigger?: unknown }
    cfg.trigger = start.data.config.kind === 'start' && start.data.config.trigger ? start.data.config.trigger : {
      type: 'MANUAL',
      formName: flow.form.name,
      lockRecord: false
    }
  }
  return {
    id: flow.id,
    name: flow.name,
    flowKey: flow.flowKey ?? '',
    description: flow.description,
    model: {flowElementList: [...graph.values()]},
    status: flow.status,
    updatedAt: flow.updatedAt
  }

}

export function decodeApprovalFlow(record: ApprovalFlowRecord, appId: string): ApprovalFlow {
  const {flowElementList: elements} = record.model as { flowElementList: FlowElement[] }
  const nodes = new Map<string, ApprovalNode>(),
    groups = new Map<string, Array<{ node: ApprovalNode; order: number }>>()
  let form: FormRef = {kind: 'app', name: ''}
  for (const element of elements) {
    const config = element.properties.config as ApprovalNode['data']['config'] | undefined
    if (!config) continue
    const designer = element.properties.designer as { parent: string; order: number; container?: boolean }
    const node: ApprovalNode = {
      id: element.key,
      type: config.kind,
      data: {title: String(element.properties.name ?? ''), config}
    }
    if (designer.container) node.blocks = []
    nodes.set(node.id, node)
    const group = groups.get(designer.parent) ?? []
    group.push({node, order: designer.order});
    groups.set(designer.parent, group)
    if (config.kind === 'start') form = {
      kind: 'app',
      name: config.trigger && 'formName' in config.trigger ? config.trigger.formName : ''
    }
  }
  for (const [parent, group] of groups) {
    group.sort((a, b) => a.order - b.order)
    if (parent) nodes.get(parent)!.blocks = group.map(item => item.node)
  }
  return {
    id: record.id,
    appId,
    flowKey: record.flowKey,
    name: record.name,
    description: record.description,
    form,
    status: record.status,
    publishedTrigger: record.publishedTrigger,
    deploymentId: record.deploymentId, hasDraftChanges: record.hasDraftChanges,
    updatedAt: record.updatedAt ?? '',
    definition: {nodes: (groups.get('') ?? []).map(item => item.node)}
  }
}

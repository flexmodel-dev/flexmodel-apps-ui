import type {ApprovalFlow, ApprovalNode, FormRef} from '../types/approval'

export interface FlowElement {
  key: string
  type: number
  incoming: string[]
  outgoing: string[]
  properties: Record<string, unknown>
}

export interface ApprovalFlowRecord {
  flow_module_id: string
  flow_name: string
  flow_key: string
  flow_model: string
  status: number
  remark: string
  revision?: number
  archive?: number
  is_deleted?: number
  created_by?: string
  updated_by?: string
  created_at?: string
  updated_at?: string
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
        config: node.data.config,
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
  if (start) graph.get(start.id)!.properties.form = flow.form
  return {
    flow_module_id: flow.id,
    flow_name: flow.name,
    flow_key: flow.flowKey ?? (flow.id ? `form_${flow.id}` : ''),
    flow_model: JSON.stringify({flowElementList: [...graph.values()]}),
    status: flow.status === 'enabled' ? 2 : flow.status === 'disabled' ? 3 : 1,
    remark: flow.description,
    revision: flow.revision,
    updated_at: flow.updatedAt
  }
}

export function decodeApprovalFlow(record: ApprovalFlowRecord, appId: string): ApprovalFlow {
  const {flowElementList: elements} = JSON.parse(record.flow_model) as { flowElementList: FlowElement[] }
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
    if (config.kind === 'start') form = element.properties.form as FormRef
  }
  for (const [parent, group] of groups) {
    group.sort((a, b) => a.order - b.order)
    if (parent) nodes.get(parent)!.blocks = group.map(item => item.node)
  }
  return {
    id: record.flow_module_id,
    appId,
    flowKey: record.flow_key,
    name: record.flow_name,
    description: record.remark,
    form,
    status: record.status === 2 ? 'enabled' : record.status === 3 ? 'disabled' : 'draft',
    revision: record.revision,
    updatedAt: record.updated_at ?? '',
    definition: {nodes: (groups.get('') ?? []).map(item => item.node)}
  }
}

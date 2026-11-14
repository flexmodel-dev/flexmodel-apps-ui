import {describe, expect, it} from 'vitest'
import {
  approvalDirectory,
  approvalSampleRecords,
  approvalSampleVariables,
  createApprovalTemplates,
  users,
} from '../data/mock'
import {
  chooseBranch,
  cloneNode,
  createApprovalNode,
  hasSubflowCycle,
  newRule,
  matchesConditions,
  bindingValue,
  resolveMembers,
  sourceLabels,
  upstreamNodes,
  validateFlow,
} from './workflow'
import {ApprovalSimulation} from './workflowSimulation'
import type {ApprovalFlow, ResolveContext} from '../types/workflow'

const context = (): ResolveContext => ({
  initiatorId: users[3].id,
  variables: structuredClone(approvalSampleVariables),
  nodeMembers: {},
})
const simulation = (flow: ApprovalFlow, flows = [flow]) =>
  new ApprovalSimulation(
    flow,
    flows,
    approvalDirectory,
    context(),
    approvalSampleRecords,
  )

describe('执行人解析', () => {
  it('以所选成员计算直接上级、直接下级和全部下级', () => {
    expect(
      resolveMembers(
        [{...newRule(), source: 'initiator', scope: 'manager'}],
        context(),
        approvalDirectory,
      ),
    ).toEqual([users[2].id])
    const direct = resolveMembers(
      [
        {
          ...newRule(),
          source: 'users',
          values: [users[0].id],
          scope: 'directReports',
        },
      ],
      context(),
      approvalDirectory,
    )
    expect(direct).toContain(users[2].id)
    expect(direct).not.toContain(users[3].id)
    expect(
      resolveMembers(
        [
          {
            ...newRule(),
            source: 'users',
            values: [users[0].id],
            scope: 'allReports',
          },
        ],
        context(),
        approvalDirectory,
      ),
    ).toContain(users[3].id)
  })
  it('按来源与选取顺序去重，过滤无效用户', () => {
    expect(
      resolveMembers(
        [
          {...newRule(), values: [users[4].id, users[2].id, users[7].id]},
          {...newRule(), source: 'roles', values: ['会计']},
        ],
        context(),
        approvalDirectory,
      ),
    ).toEqual([users[4].id, users[2].id])
  })
  it('组织范围支持包含下级组织', () => {
    const base = {
      ...newRule(),
      source: 'organizations' as const,
      values: ['002-001'],
    }
    expect(
      resolveMembers(
        [{...base, includeChildren: false}],
        context(),
        approvalDirectory,
      ),
    ).toEqual([users[0].id])
    expect(resolveMembers([base], context(), approvalDirectory)).toHaveLength(7)
  })
  it('动态节点和变量使用各自的模拟上下文', () => {
    const ctx = {
      ...context(),
      nodeMembers: {upstream: [users[2].id]},
    }
    expect(
      resolveMembers(
        [
          {...newRule(), source: 'node', values: ['upstream']},
          {...newRule(), source: 'variable', values: ['reviewerIds']},
        ],
        ctx,
        approvalDirectory,
      ),
    ).toEqual([users[2].id, users[4].id])
  })
  it('成员来源与规则不再包含脚本，旧来源必须重新选择', () => {
    expect(sourceLabels).not.toHaveProperty('script')
    expect(newRule()).not.toHaveProperty('script')
    const [flow] = createApprovalTemplates('test')
    const node = createApprovalNode('approval')
    flow.definition.nodes = [
      createApprovalNode('start'),
      node,
      createApprovalNode('end'),
    ]
    if (node.data.config.kind === 'approval')
      Object.assign(node.data.config.rules[0], {source: 'script'})
    expect(validateFlow(flow, [flow])).toContainEqual({
      nodeId: node.id,
      message: '执行人来源已不支持，请重新选择',
    })
  })
})

describe('条件与结构校验', () => {
  it('文本数字保持字符串，日期可按时间顺序比较', () => {
    expect(
      bindingValue({kind: 'literal', value: '123', valueType: 'text'}, {}),
    ).toBe('123')
    expect(
      matchesConditions(
        [
          {
            id: 'date',
            field: 'date',
            operator: 'gte',
            value: {kind: 'literal', value: '2026-10-20', valueType: 'text'},
          },
        ],
        'all',
        {date: '2026-10-21'},
        {},
      ),
    ).toBe(true)
  })
  it('复制包含数据操作的分支时同步重建内部变量引用', () => {
    const gateway = createApprovalNode('gateway'),
      query = createApprovalNode('query'),
      update = createApprovalNode('update')
    if (query.data.config.kind === 'query') query.data.config.output = 'lookup'
    if (update.data.config.kind === 'update')
      update.data.config.assignments = [
        {
          id: 'copy-ref',
          field: 'title',
          value: {kind: 'variable', value: 'lookup.0.title'},
        },
      ]
    gateway.blocks![0].blocks = [query, update]
    const [copiedQuery, copiedUpdate] = cloneNode(gateway).blocks![0].blocks!
    expect(
      'output' in copiedQuery.data.config &&
      copiedUpdate.data.config.kind === 'update' &&
      copiedUpdate.data.config.assignments[0].value.value,
    ).toBe(
      `${'output' in copiedQuery.data.config ? copiedQuery.data.config.output : ''}.0.title`,
    )
  })
  it('优先匹配首个分支，否则进入唯一默认分支', () => {
    const [flow] = createApprovalTemplates('test')
    const gateway = flow.definition.nodes.find(
      (node) => node.type === 'gateway',
    )!
    expect(chooseBranch(gateway, context().variables)?.data.title).toBe(
      '大额报销',
    )
    expect(chooseBranch(gateway, {record: {amount: 200}})?.data.title).toBe(
      '常规报销',
    )
    const copy = cloneNode(gateway.blocks![0])
    gateway.blocks!.splice(1, 0, copy)
    expect(chooseBranch(gateway, context().variables)?.id).toBe(
      gateway.blocks![0].id,
    )
  })
  it('不允许引用其他条件路径或未必执行的分支节点', () => {
    const [flow] = createApprovalTemplates('test')
    const gateway = flow.definition.nodes.find(
      (node) => node.type === 'gateway',
    )!
    const sibling = createApprovalNode('approval')
    gateway.blocks![1].blocks = [sibling]
    const branchApproval = gateway.blocks![0].blocks![0]
    expect(
      upstreamNodes(flow.definition.nodes, sibling.id)?.map((node) => node.id),
    ).not.toContain(branchApproval.id)
    const downstream = flow.definition.nodes.find(
      (node) => node.type === 'update',
    )!
    expect(
      upstreamNodes(flow.definition.nodes, downstream.id)?.map(
        (node) => node.id,
      ),
    ).not.toContain(branchApproval.id)
  })
  it('检测直接与间接子流程循环，允许共享子流程', () => {
    const [flow, child] = createApprovalTemplates('test')
    expect(hasSubflowCycle(flow, [flow, child])).toBe(false)
    const node = createApprovalNode('subflow')
    node.data.config = {
      kind: 'subflow',
      flowId: flow.id,
      inputs: [],
      outputs: [],
    }
    child.definition.nodes.splice(1, 0, node)
    expect(hasSubflowCycle(flow, [flow, child])).toBe(true)
    expect(
      validateFlow(flow, [flow, child]).some((issue) =>
        issue.message.includes('循环'),
      ),
    ).toBe(true)
  })
  it('复制分支时重建节点 ID 与内部执行人引用', () => {
    const a = createApprovalNode('approval'),
      b = createApprovalNode('approval'),
      gateway = createApprovalNode('gateway')
    if (b.data.config.kind === 'approval')
      b.data.config.rules = [{...newRule(), source: 'node', values: [a.id]}]
    gateway.blocks![0].blocks = [a, b]
    const clone = cloneNode(gateway)
    const [ca, cb] = clone.blocks![0].blocks!
    expect(ca.id).not.toBe(a.id)
    expect(
      cb.data.config.kind === 'approval' && cb.data.config.rules[0].values,
    ).toEqual([ca.id])
  })
})

describe('逐步模拟审批', () => {
  const approvalFlow = (mode: 'all' | 'any' | 'sequential') => {
    const [flow] = createApprovalTemplates('test')
    const node = createApprovalNode('approval')
    node.data.config = {
      kind: 'approval',
      rules: [{...newRule(), values: [users[2].id, users[4].id]}],
      signMode: mode,
    }
    flow.definition.nodes = [
      createApprovalNode('start'),
      node,
      createApprovalNode('end'),
    ]
    return flow
  }
  it('会签必须全员同意，或签一人同意即可继续', () => {
    const all = simulation(approvalFlow('all'))
    all.decide(users[2].id, 'approve')
    expect(all.status).toBe('waiting')
    all.decide(users[4].id, 'approve')
    expect(all.status).toBe('completed')
    const any = simulation(approvalFlow('any'))
    any.decide(users[4].id, 'approve')
    expect(any.status).toBe('completed')
  })
  it('依次审批不能越过当前执行人', () => {
    const sequential = simulation(approvalFlow('sequential'))
    expect(sequential.canDecide(users[4].id)).toBe(false)
    sequential.decide(users[4].id, 'approve')
    expect(sequential.events[1].decisions).toEqual({})
    sequential.decide(users[2].id, 'approve')
    expect(sequential.canDecide(users[4].id)).toBe(true)
    sequential.decide(users[4].id, 'approve')
    expect(sequential.status).toBe('completed')
  })
  it('或签的上游执行人仅包含实际同意者', () => {
    const flow = approvalFlow('any')
    const sim = simulation(flow)
    expect(sim.context.nodeMembers[flow.definition.nodes[1].id]).toBeUndefined()
    sim.decide(users[2].id, 'approve')
    expect(sim.context.nodeMembers[flow.definition.nodes[1].id]).toEqual([
      users[2].id,
    ])
  })
  it.each(['all', 'any', 'sequential'] as const)(
    '%s 任一拒绝立即终止',
    (mode) => {
      const sim = simulation(approvalFlow(mode))
      sim.decide(users[2].id, 'reject')
      expect(sim.status).toBe('rejected')
      sim.decide(users[4].id, 'approve')
      expect(sim.status).toBe('rejected')
      expect(sim.events.some((event) => event.type === 'end')).toBe(false)
    },
  )
  it('完整模板可审批、分流、更新并同步归档，原始数据保持不变', () => {
    const flows = createApprovalTemplates('test'),
      original = structuredClone(approvalSampleRecords)
    const sim = simulation(flows[0], flows)
    sim.decide(users[2].id, 'approve')
    expect(sim.status).toBe('waiting')
    sim.decide(users[4].id, 'approve')
    expect(sim.status).toBe('completed')
    expect(sim.records['demo:expense'][0].status).toBe('已通过')
    expect(sim.records['demo:archive']).toHaveLength(1)
    expect(sim.events.some((event) => event.depth === 1)).toBe(true)
    expect(approvalSampleRecords).toEqual(original)
    expect(approvalSampleVariables.record.status).toBe('待审批')
  })
  it('查询、删除及子流程输入输出映射在独立上下文中运行', () => {
    const [flow, child] = createApprovalTemplates('test')
    const query = createApprovalNode('query'),
      remove = createApprovalNode('delete'),
      subflow = createApprovalNode('subflow')
    if (query.data.config.kind === 'query') {
      query.data.config.output = 'found'
      query.data.config.queryMode = 'one'
    }
    if (remove.data.config.kind === 'delete')
      remove.data.config.conditions = [
        {
          id: 'delete',
          field: 'id',
          operator: 'eq',
          value: {kind: 'literal', value: 'EXP-002'},
        },
      ]
    subflow.data.config = {
      kind: 'subflow',
      flowId: child.id,
      inputs: [
        {
          id: 'in',
          field: 'record',
          value: {kind: 'variable', value: 'found'},
        },
      ],
      outputs: [
        {
          id: 'out',
          field: 'savedArchive',
          value: {kind: 'variable', value: 'archiveRecord'},
        },
      ],
    }
    flow.definition.nodes = [
      createApprovalNode('start'),
      query,
      remove,
      subflow,
      createApprovalNode('end'),
    ]
    const sim = simulation(flow, [flow, child])
    expect(sim.status).toBe('completed')
    expect(sim.records['demo:expense']).toHaveLength(1)
    expect(sim.context.variables.savedArchive).toMatchObject({
      title: approvalSampleVariables.record.title,
    })
  })
  it('没有解析到成员或不存在变量时报告失败', () => {
    const flow = approvalFlow('all')
    const node = flow.definition.nodes[1]
    if (node.data.config.kind === 'approval')
      node.data.config.rules = [{...newRule(), source: 'variable', values: ['missingMembers']}]
    expect(simulation(flow).status).toBe('failed')
  })
})

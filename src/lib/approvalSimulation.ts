import type {
  ApprovalFlow,
  ApprovalNode,
  Assignment,
  MemberDirectory,
  RecordStore,
  ResolveContext,
  SimulationEvent,
  SignMode,
  ValueBinding,
} from '../types/approval'
import {
  renderNotificationTemplate,
  bindingValue,
  chooseBranch,
  formKey,
  matchesConditions,
  resolveMembers,
  uid,
  validateFlow,
} from './approval'
import {toErrorMessage} from '@/lib/utils'

export class ApprovalSimulation {
  readonly events: SimulationEvent[] = []
  readonly records: RecordStore
  readonly context: ResolveContext
  status: 'running' | 'waiting' | 'completed' | 'rejected' | 'failed' =
    'running'
  error = ''
  private iterator: Generator<void>
  private pending?: { event: SimulationEvent; mode: SignMode }

  constructor(
    readonly flow: ApprovalFlow,
    readonly flows: ApprovalFlow[],
    readonly directory: MemberDirectory,
    context: ResolveContext,
    records: RecordStore,
  ) {
    this.context = structuredClone(context)
    this.records = structuredClone(records)
    this.iterator = this.execute(
      flow.definition.nodes,
      this.context.variables,
      0,
    )
    const issues = validateFlow(flow, flows)
    if (issues.length) {
      this.status = 'failed'
      this.error = issues[0].message
      return
    }
    this.advance()
  }

  private read(binding: ValueBinding, variables: Record<string, unknown>) {
    const result = bindingValue(binding, variables)
    if (binding.kind === 'variable' && result === undefined)
      throw new Error(
        `变量「${binding.value}」暂无值，请检查当前路径或模拟输入`,
      )
    return result
  }

  private assignments(items: Assignment[], variables: Record<string, unknown>) {
    return Object.fromEntries(
      items.map((item) => [item.field, this.read(item.value, variables)]),
    )
  }

  private event(
    node: ApprovalNode,
    depth: number,
    detail: string,
    input?: unknown,
    output?: unknown,
  ): SimulationEvent {
    const event: SimulationEvent = {
      id: uid(),
      nodeId: node.id,
      type: node.type,
      title: node.data.title,
      depth,
      detail,
      status: 'completed',
      input: structuredClone(input),
      output: structuredClone(output),
    }
    this.events.push(event)
    return event
  }

  private* execute(
    nodes: ApprovalNode[],
    variables: Record<string, unknown>,
    depth: number,
  ): Generator<void> {
    if (depth > 20) throw new Error('子流程层级过深')
    for (const node of nodes) {
      const c = node.data.config
      if (c.kind === 'start') this.event(node, depth, '模拟流程已发起')
      else if (c.kind === 'end') this.event(node, depth, '本流程处理完成')
      else if (c.kind === 'notification') {
        try {
          const members = resolveMembers(c.rules, {...this.context, variables}, this.directory)
          const output = members.length ? {
            status: 'preview',
            members,
            title: renderNotificationTemplate(c.titleTemplate, variables, 200),
            content: renderNotificationTemplate(c.contentTemplate, variables, 5000)
          } : {status: 'skipped', members}
          this.event(node, depth, '仅预览通知，不真实投递', undefined, output)
        } catch (error) {
          this.event(node, depth, '通知失败，模拟继续', undefined, {status: 'failed', reason: String(error)})
        }
      } else if (c.kind === 'approval') {
        const members = resolveMembers(
          c.rules,
          {...this.context, variables},
          this.directory,
        )
        if (!members.length)
          throw new Error(
            `「${node.data.title}」未解析到执行人，请检查执行人规则`,
          )
        const event = this.event(node, depth, '等待审批人处理')
        event.status = 'waiting'
        event.members = members
        event.decisions = {}
        this.pending = {event, mode: c.signMode}
        this.status = 'waiting'
        yield
      } else if (c.kind === 'gateway') {
        const branch = chooseBranch(node, variables)
        if (!branch) throw new Error('未找到可用的条件分支')
        this.event(
          node,
          depth,
          `命中「${branch.data.title}」`,
          variables.record ?? variables,
          {branchId: branch.id},
        )
        this.event(branch, depth, '按分支优先级匹配，执行当前路径')
        yield* this.execute(branch.blocks ?? [], variables, depth)
      } else if (c.kind === 'subflow') {
        const child = this.flows.find(
          (item) => item.id === c.flowId && item.appId === this.flow.appId,
        )
        if (!child) throw new Error('子流程不存在')
        const issues = validateFlow(child, this.flows)
        if (issues.length)
          throw new Error(`子流程「${child.name}」：${issues[0].message}`)
        const childVariables = {
          ...structuredClone(variables),
          ...this.assignments(c.inputs, variables),
        }
        const event = this.event(
          node,
          depth,
          `进入子流程「${child.name}」`,
          childVariables,
        )
        event.status = 'waiting'
        yield* this.execute(child.definition.nodes, childVariables, depth + 1)
        const outputs = this.assignments(c.outputs, childVariables)
        Object.assign(variables, outputs)
        event.output = structuredClone(outputs)
        event.detail = `子流程「${child.name}」已完成`
        event.status = 'completed'
      } else if ('form' in c) {
        const key = formKey(c.form)
        const records = this.records[key] ?? (this.records[key] = [])
        const matches = records.filter((record) =>
          matchesConditions(c.conditions, c.match, record, variables),
        )
        const values = this.assignments(c.assignments, variables)
        let output: unknown
        if (c.kind === 'create') {
          output = {id: `sim-${uid().slice(0, 8)}`, ...values}
          records.push(output as Record<string, unknown>)
        } else if (c.kind === 'update') {
          matches.forEach((record) => Object.assign(record, values))
          output = {affectedCount: matches.length, records: matches}
        } else if (c.kind === 'delete') {
          this.records[key] = records.filter(
            (record) => !matches.includes(record),
          )
          output = {affectedCount: matches.length, records: matches}
        } else output = c.queryMode === 'one' ? (matches[0] ?? null) : matches
        if (c.output) variables[c.output] = structuredClone(output)
        this.event(
          node,
          depth,
          c.kind === 'create'
            ? '已新增 1 条模拟记录'
            : c.kind === 'query'
              ? `查询到 ${matches.length} 条模拟记录`
              : `影响 ${matches.length} 条模拟记录`,
          {form: key, conditions: c.conditions, values},
          output,
        )
      }
    }
  }

  private advance() {
    try {
      this.status = 'running'
      const next = this.iterator.next()
      if (next.done) this.status = 'completed'
    } catch (error) {
      this.status = 'failed'
      this.error = toErrorMessage(error, '模拟失败')
      this.events
        .filter((event) => event.status === 'waiting')
        .forEach((event) => {
          event.status = 'failed'
        })
    }
  }

  canDecide(memberId: string) {
    if (this.status !== 'waiting' || !this.pending) return false
    const {event, mode} = this.pending
    return (
      !!event.members?.includes(memberId) &&
      !event.decisions?.[memberId] &&
      (mode !== 'sequential' ||
        event.members.find((id) => !event.decisions?.[id]) === memberId)
    )
  }

  decide(memberId: string, decision: 'approve' | 'reject') {
    if (!this.canDecide(memberId) || !this.pending) return
    const {event, mode} = this.pending
    event.decisions![memberId] = decision
    if (decision === 'reject') {
      this.events
        .filter((item) => item.status === 'waiting')
        .forEach((item) => {
          item.status = 'rejected'
        })
      event.status = 'rejected'
      event.detail = '审批被拒绝，流程已终止'
      this.status = 'rejected'
      this.pending = undefined
      this.iterator.return(undefined)
      return
    }
    if (
      mode === 'any' ||
      event.members!.every((id) => event.decisions![id] === 'approve')
    ) {
      event.status = 'completed'
      event.detail = '审批通过'
      this.context.nodeMembers[event.nodeId] = event.members!.filter(
        (id) => event.decisions![id] === 'approve',
      )
      this.pending = undefined
      this.advance()
    }
  }
}

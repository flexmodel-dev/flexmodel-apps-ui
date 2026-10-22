import type {
  ApprovalDocument,
  ApprovalFlow,
  ApprovalForm,
  ApprovalNode,
  AssigneeRule,
  Condition,
  MemberDirectory,
  NodeKind,
  ResolveContext,
  ValidationIssue,
  ValueBinding,
} from '../types/approval'

export const nodeLabels: Record<NodeKind, string> = {
  start: '流程发起',
  end: '流程结束',
  notification: '发送通知',
  approval: '审批节点',
  gateway: '条件网关',
  branch: '条件分支',
  create: '新增记录',
  update: '更新记录',
  query: '查询记录',
  delete: '删除记录',
  subflow: '子流程',
}
export const sourceLabels = {
  users: '指定用户',
  roles: '指定角色',
  organizations: '指定组织架构',
  initiator: '流程发起人',
  node: '流程节点执行人',
  variable: '流程变量',
}
export const scopeLabels = {
  self: '本人',
  directReports: '直接下级',
  allReports: '所有下级',
  manager: '直接上级',
}
export const signLabels = {all: '会签', any: '或签', sequential: '依次审批'}
export const uid = () => crypto.randomUUID()

export function notificationTemplatePaths(template: string) {
  const pattern = /\{\{\s*([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*)\s*}}/g
  const remaining = template.replace(pattern, '')
  if (remaining.includes('{{') || remaining.includes('}}')) throw new Error('通知变量格式无效')
  return [...template.matchAll(pattern)].map(match => match[1])
}

export function renderNotificationTemplate(template: string, variables: Record<string, unknown>, max: number) {
  notificationTemplatePaths(template)
  const value = template.replace(/\{\{\s*([\w.]+)\s*}}/g, (_slot, path: string) => {
    let current: unknown = variables
    for (const part of path.split('.')) current = current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part) ? (current as Record<string, unknown>)[part] : undefined
    return current == null ? '' : typeof current === 'object' ? JSON.stringify(current) : String(current)
  })
  if (!value.trim() || value.length > max) throw new Error('通知内容为空或超过长度限制')
  return value
}

export const formKey = (form: { kind: string; name: string }) =>
  `${form.kind}:${form.name}`
export const literal = (value = ''): ValueBinding => ({
  kind: 'literal',
  value,
})
export const newCondition = (): Condition => ({
  id: uid(),
  field: '',
  operator: 'eq',
  value: literal(),
})
export const newRule = (): AssigneeRule => ({
  id: uid(),
  source: 'users',
  values: [],
  scope: 'self',
  includeChildren: true,
})

export function createApprovalNode(type: NodeKind): ApprovalNode {
  const id = uid()
  const data: ApprovalNode['data'] = {
    title: nodeLabels[type],
    config: {kind: 'start'},
  }
  switch (type) {
    case 'notification':
      data.config = {
        kind: type,
        rules: [newRule()],
        titleTemplate: '流程提醒',
        contentTemplate: '记录 {{record.id}} 已更新'
      }
      break
    case 'approval':
      data.config = {kind: type, rules: [newRule()], signMode: 'all'}
      break
    case 'branch':
      data.config = {
        kind: type,
        fallback: false,
        match: 'all',
        conditions: [newCondition()],
      }
      break
    case 'create':
    case 'update':
    case 'query':
    case 'delete':
      data.config = {
        kind: type,
        form: {kind: 'demo', name: 'expense'},
        match: 'all',
        conditions: [],
        assignments: [],
        output: `result_${id.slice(0, 6)}`,
        queryMode: 'many',
      }
      break
    case 'subflow':
      data.config = {kind: type, flowId: '', inputs: [], outputs: []}
      break
    default:
      data.config = {kind: type}
  }
  if (type === 'gateway') {
    const first = createApprovalNode('branch'),
      fallback = createApprovalNode('branch')
    first.data.title = '条件分支 1'
    fallback.data = {
      title: '其他情况',
      config: {kind: 'branch', fallback: true, match: 'all', conditions: []},
    }
    return {id, type, data, blocks: [first, fallback]}
  }
  return {id, type, data, ...(type === 'branch' ? {blocks: []} : {})}
}

export function flattenNodes(nodes: ApprovalNode[]): ApprovalNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.blocks ?? [])])
}

/** Only dominating nodes are referenceable; nodes in a different conditional path are excluded. */
export function upstreamNodes(
  nodes: ApprovalNode[],
  targetId: string,
  previous: ApprovalNode[] = [],
): ApprovalNode[] | undefined {
  const seen = [...previous]
  for (const node of nodes) {
    if (node.id === targetId) return seen
    if (node.blocks) {
      const result = upstreamNodes(node.blocks, targetId, seen)
      if (result) return result
    }
    seen.push(node)
  }
}

export function cloneNode(node: ApprovalNode): ApprovalNode {
  const copy = structuredClone(node)
  const ids = new Map(flattenNodes([copy]).map((item) => [item.id, uid()]))
  const outputs = new Map(
    flattenNodes([copy]).flatMap((item) =>
      'output' in item.data.config && item.data.config.output
        ? [
          [
            item.data.config.output,
            `result_${ids.get(item.id)!.slice(0, 6)}`,
          ] as const,
        ]
        : [],
    ),
  )
  const remapPath = (path: string) => {
    const [root, ...rest] = path.split('.')
    return [outputs.get(root) ?? root, ...rest].join('.')
  }
  const remapBinding = (binding: ValueBinding) => {
    if (binding.kind === 'variable') binding.value = remapPath(binding.value)
  }
  for (const item of flattenNodes([copy])) {
    item.id = ids.get(item.id)!
    const config = item.data.config
    if (config.kind === 'approval' || config.kind === 'notification')
      config.rules.forEach((rule) => {
        rule.id = uid()
        if (rule.source === 'node')
          rule.values = rule.values.map((id) => ids.get(id) ?? id)
        if (rule.source === 'variable') rule.values = rule.values.map(remapPath)
      })
    if (config.kind === 'notification') {
      const remapTemplate = (text: string) => text.replace(/\{\{\s*([\w.]+)\s*}}/g, (_slot, path: string) => '{{' + remapPath(path) + '}}')
      config.titleTemplate = remapTemplate(config.titleTemplate);
      config.contentTemplate = remapTemplate(config.contentTemplate)
    }
    if ('output' in config) config.output = `result_${item.id.slice(0, 6)}`
    if ('conditions' in config)
      config.conditions.forEach((condition) => {
        remapBinding(condition.value)
        if (config.kind === 'branch')
          condition.field = remapPath(condition.field)
      })
    if ('assignments' in config)
      config.assignments.forEach((assignment) => remapBinding(assignment.value))
    if (config.kind === 'subflow')
      config.inputs.forEach((input) => remapBinding(input.value))
  }
  copy.data.title += '（副本）'
  return copy
}

export function getPath(value: unknown, path: string): unknown {
  if (!path) return value
  return path
    .split('.')
    .reduce<unknown>(
      (current, part) =>
        current != null && typeof current === 'object'
          ? (current as Record<string, unknown>)[part]
          : undefined,
      value,
    )
}

export function bindingValue(
  binding: ValueBinding,
  variables: Record<string, unknown>,
): unknown {
  if (binding.kind === 'variable') return getPath(variables, binding.value)
  if (binding.valueType === 'text') return binding.value
  if (binding.valueType === 'number')
    return binding.value === '' ? '' : Number(binding.value)
  if (binding.valueType === 'boolean') return binding.value === 'true'
  if (binding.value === '') return ''
  try {
    return JSON.parse(binding.value)
  } catch {
    return binding.value
  }
}

export function matchesConditions(
  conditions: Condition[],
  mode: 'all' | 'any',
  record: Record<string, unknown>,
  variables: Record<string, unknown>,
): boolean {
  const results = conditions.map((condition) => {
    const left = getPath(record, condition.field),
      right = bindingValue(condition.value, variables)
    if (left === undefined || right === undefined) return false
    const compareLeft =
      typeof left === 'string' && typeof right === 'string'
        ? left
        : Number(left)
    const compareRight =
      typeof left === 'string' && typeof right === 'string'
        ? right
        : Number(right)
    switch (condition.operator) {
      case 'eq':
        return left === right
      case 'ne':
        return left !== right
      case 'contains':
        return String(left).includes(String(right))
      case 'gt':
        return compareLeft > compareRight
      case 'gte':
        return compareLeft >= compareRight
      case 'lt':
        return compareLeft < compareRight
      case 'lte':
        return compareLeft <= compareRight
    }
  })
  return mode === 'all' ? results.every(Boolean) : results.some(Boolean)
}

export function chooseBranch(
  node: ApprovalNode,
  variables: Record<string, unknown>,
) {
  const branches = node.blocks ?? []
  return (
    branches.find((branch) => {
      const c = branch.data.config
      return (
        c.kind === 'branch' &&
        !c.fallback &&
        matchesConditions(c.conditions, c.match, variables, variables)
      )
    }) ??
    branches.find(
      (branch) =>
        branch.data.config.kind === 'branch' && branch.data.config.fallback,
    )
  )
}

export function resolveMembers(
  rules: AssigneeRule[],
  context: ResolveContext,
  directory: MemberDirectory,
): string[] {
  const valid = new Set(directory.members.map((member) => member.id))
  const resolve = (rule: AssigneeRule): string[] => {
    let members: string[] = []
    switch (rule.source) {
      case 'users':
        members = rule.values
        break
      case 'roles':
        members = directory.members
          .filter((member) => (member.roleIds ?? [member.role]).some(id => rule.values.includes(id)))
          .map((member) => member.id)
        break
      case 'organizations': {
        const selected = new Set(rule.values)
        if (rule.includeChildren) {
          let changed = true
          while (changed) {
            changed = false
            directory.organizations.forEach((org) => {
              if (
                org.parentId &&
                selected.has(org.parentId) &&
                !selected.has(org.id)
              ) {
                selected.add(org.id)
                changed = true
              }
            })
          }
        }
        members = directory.members
          .filter((member) => (member.organizationIds ?? [member.organization]).some(id => selected.has(id)))
          .map((member) => member.id)
        break
      }
      case 'initiator':
        members = [context.initiatorId]
        break
      case 'node':
        members = rule.values.flatMap((id) => context.nodeMembers[id] ?? [])
        break
      case 'variable': {
        const value = getPath(context.variables, rule.values[0] ?? '')
        members = Array.isArray(value)
          ? value.map(String)
          : value
            ? [String(value)]
            : []
        break
      }
    }
    members = members.filter((id) => valid.has(id))
    if (rule.scope === 'self') return members
    if (rule.scope === 'manager')
      return members.flatMap(
        (id) =>
          directory.members.find((member) => member.id === id)?.managerId ?? [],
      )
    const selected = new Set(members),
      result = new Set<string>()
    let frontier = members
    while (frontier.length) {
      const children = directory.members
        .filter(
          (member) =>
            member.managerId &&
            frontier.includes(member.managerId) &&
            !selected.has(member.id) &&
            !result.has(member.id),
        )
        .map((member) => member.id)
      children.forEach((id) => result.add(id))
      if (rule.scope === 'directReports') break
      frontier = children
    }
    return [...result]
  }
  return [...new Set(rules.flatMap(resolve))].filter((id) => valid.has(id))
}

export function hasSubflowCycle(
  flow: ApprovalFlow,
  flows: ApprovalFlow[],
): boolean {
  const lookup = new Map([...flows, flow].map((item) => [item.id, item]))
  const visit = (id: string, path: Set<string>): boolean => {
    if (path.has(id)) return true
    const current = lookup.get(id)
    if (!current) return false
    const next = new Set([...path, id])
    return flattenNodes(current.definition.nodes).some(
      (node) =>
        node.data.config.kind === 'subflow' &&
        visit(node.data.config.flowId, next),
    )
  }
  return visit(flow.id, new Set())
}

export function validateFlow(
  flow: ApprovalFlow,
  flows: ApprovalFlow[],
  forms?: ApprovalForm[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const nodes = flattenNodes(flow.definition.nodes)
  const add = (nodeId: string, message: string) =>
    issues.push({nodeId, message})
  if (!flow.name.trim()) add('', '请填写流程名称')
  if (forms && !forms.some((form) => formKey(form.ref) === formKey(flow.form)))
    add('', '关联表单不存在，请重新选择')
  for (const node of nodes) {
    const config = node.data.config
    const previous = upstreamNodes(flow.definition.nodes, node.id) ?? []
    const outputNames = previous.flatMap((item) =>
      'output' in item.data.config && item.data.config.output
        ? [item.data.config.output]
        : item.data.config.kind === 'subflow'
          ? item.data.config.outputs.map((output) => output.field)
          : [],
    )
    const availableRoots = new Set(['record', 'initiator', 'reviewerIds', ...outputNames])
    const bindings: ValueBinding[] = [
      ...('conditions' in config
        ? config.conditions.map((item) => item.value)
        : []),
      ...('assignments' in config
        ? config.assignments.map((item) => item.value)
        : []),
      ...(config.kind === 'subflow'
        ? config.inputs.map((item) => item.value)
        : []),
      ...((config.kind === 'approval' || config.kind === 'notification')
        ? config.rules
          .filter((rule) => rule.source === 'variable')
          .map((rule) => ({
            kind: 'variable' as const,
            value: rule.values[0] ?? '',
          }))
        : []),
    ]
    if (
      bindings.some(
        (binding) =>
          binding.kind === 'variable' &&
          binding.value &&
          !availableRoots.has(binding.value.split('.')[0]),
      )
    )
      add(node.id, '引用变量不在当前上游路径，请重新选择')
    if (
      'output' in config &&
      config.output &&
      (!/^[A-Za-z_$][\w$]*$/.test(config.output) ||
        availableRoots.has(config.output))
    )
      add(
        node.id,
        '输出变量名需使用不重复的字母、数字或下划线，且不能以数字开头',
      )
    if (config.kind === 'notification') {
      for (const [text, max] of [[config.titleTemplate, 200], [config.contentTemplate, 5000]] as const) {
        if (!text.trim() || text.length > max) add(node.id, '请填写有效的通知标题和正文')
        try {
          for (const path of notificationTemplatePaths(text)) if (!availableRoots.has(path.split('.')[0])) add(node.id, '通知引用变量不在当前上游路径')
        } catch {
          add(node.id, '通知变量格式无效')
        }
      }
    }
    if (!node.data.title.trim()) add(node.id, '请填写节点名称')
    if (config.kind === 'approval' || config.kind === 'notification') {
      if (!config.rules.length) add(node.id, '请添加执行人规则')
      for (const rule of config.rules) {
        if (!Object.prototype.hasOwnProperty.call(sourceLabels, rule.source)) {
          add(node.id, '执行人来源已不支持，请重新选择')
          continue
        }
        if (
          rule.source !== 'initiator' &&
          !rule.values.length
        )
          add(node.id, `请选择${sourceLabels[rule.source]}`)
        if (
          rule.source === 'node' &&
          rule.values.some(
            (id) =>
              !(upstreamNodes(flow.definition.nodes, node.id) ?? []).some(
                (item) => item.id === id && item.type === 'approval',
              ),
          )
        )
          add(node.id, '执行人引用的审批节点不在当前上游路径')
      }
    }
    if (
      config.kind === 'gateway' &&
      ((node.blocks ?? []).filter(
          (branch) =>
            branch.data.config.kind === 'branch' && branch.data.config.fallback,
        ).length !== 1 ||
        (node.blocks?.length ?? 0) < 2)
    )
      add(node.id, '网关需至少两个分支，且有且仅有一个默认分支')
    if (
      config.kind === 'branch' &&
      !config.fallback &&
      !config.conditions.length
    )
      add(node.id, '请设置分支条件')
    if (
      'conditions' in config &&
      config.conditions.some((item) => !item.field || !item.value.value.trim())
    )
      add(node.id, '请完整填写筛选条件')
    if ('form' in config && !config.form.name) add(node.id, '请选择目标表单')
    if ('form' in config && forms) {
      const form = forms.find(
        (item) => formKey(item.ref) === formKey(config.form),
      )
      if (!form) add(node.id, '目标表单不存在，请重新选择')
      else if (
        [...config.conditions, ...config.assignments].some(
          (item) => !form.fields.some((field) => field.name === item.field),
        )
      )
        add(node.id, '引用的目标字段不存在，请重新选择')
    }
    if (
      (config.kind === 'update' || config.kind === 'delete') &&
      !config.conditions.length
    )
      add(node.id, '更新和删除记录必须设置筛选条件')
    if (
      (config.kind === 'create' || config.kind === 'update') &&
      !config.assignments.length
    )
      add(node.id, '请至少设置一个字段赋值')
    if (
      'assignments' in config &&
      config.assignments.some(
        (item) =>
          !item.field || (item.value.kind === 'variable' && !item.value.value),
      )
    )
      add(node.id, '请完整填写字段赋值')
    if (
      config.kind === 'subflow' &&
      !flows.some(
        (item) => item.id === config.flowId && item.appId === flow.appId,
      )
    )
      add(node.id, '请选择当前应用的子流程')
    if (
      config.kind === 'subflow' &&
      [...config.inputs, ...config.outputs].some(
        (item) =>
          !/^[A-Za-z_$][\w$]*$/.test(item.field) ||
          (item.value.kind === 'variable' && !item.value.value),
      )
    )
      add(node.id, '请完整填写子流程的变量映射，目标名需为有效变量名')
  }
  if (hasSubflowCycle(flow, flows))
    add(
      nodes.find((node) => node.type === 'subflow')?.id ?? '',
      '子流程存在循环引用，请调整调用关系',
    )
  return issues
}

export function emptyDocument(): ApprovalDocument {
  return {nodes: [createApprovalNode('start'), createApprovalNode('end')]}
}

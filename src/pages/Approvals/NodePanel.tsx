import * as React from 'react'
import {useDirectory} from './directory'
import {DirectoryMemberPicker} from '@/components/rb/DirectoryMemberPicker'
import {getAuthSession} from '@/services/auth'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Copy,
  GitBranch,
  Info,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {approvalSampleVariables} from '@/data/mock'
import type {
  ApprovalConfig,
  ApprovalFlow,
  ApprovalForm,
  ApprovalNode,
  AssigneeRule,
  MemberSource,
  MemberScope,
  SignMode,
} from '@/types/approval'
import {
  flattenNodes,
  formKey,
  newRule,
  nodeLabels,
  resolveMembers,
  scopeLabels,
  signLabels,
  sourceLabels,
  upstreamNodes,
} from '@/lib/approval'
import {
  AssignmentsEditor,
  Choice,
  ConditionsEditor,
  Field,
  MultiChoice,
  variableOptions,
} from './controls'
import {cn} from '@/lib/utils'

interface Props {
  flow: ApprovalFlow
  flows: ApprovalFlow[]
  forms: ApprovalForm[]
  node?: ApprovalNode
  onFlowChange: (flow: ApprovalFlow) => void
  onChange: (node: ApprovalNode) => void
  onSelect: (id: string) => void
  onClose: () => void
  onCopy: () => void
  onDelete: () => void
  onAddBranch: (gatewayId: string) => void
  onMove: (id: string, delta: number) => void
  onOpenSubflow: (id: string) => void
}

function Section({
                   title,
                   children,
                   description,
                 }: {
  title: string
  children: React.ReactNode
  description?: string
}) {
  return (
    <section className="space-y-4 border-b px-5 py-5 last:border-b-0">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

function AssigneeEditor({
                          rules,
                          onChange,
                          flow,
                          node,
                          forms,
                        }: {
  rules: AssigneeRule[]
  onChange: (rules: AssigneeRule[]) => void
  flow: ApprovalFlow
  node: ApprovalNode
  forms: ApprovalForm[]
}) {
  const approvalDirectory = useDirectory()
  const [showMembers, setShowMembers] = React.useState(false)
  const parsed = resolveMembers(
    rules,
    {
      initiatorId: getAuthSession()?.user.id ?? '',
      variables: approvalSampleVariables,
      nodeMembers: {},
    },
    approvalDirectory,
  )
  const previous = (upstreamNodes(flow.definition.nodes, node.id) ?? []).filter(
    (item) => item.type === 'approval',
  )
  const move = (index: number, delta: number) => {
    const copy = [...rules]
    ;[copy[index], copy[index + delta]] = [copy[index + delta], copy[index]]
    onChange(copy)
  }
  return (
    <div className="space-y-3">
      {rules.map((rule, index) => {
        const patch = (update: Partial<AssigneeRule>) =>
          onChange(
            rules.map((item) =>
              item.id === rule.id ? {...item, ...update} : item,
            ),
          )
        return (
          <div key={rule.id} className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between border-b bg-background/70 px-3 py-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                规则 {String(index + 1).padStart(2, '0')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  title="规则上移"
                  disabled={index === 0}
                  className="disabled:opacity-25"
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-3.5 w-3.5"/>
                </button>
                <button
                  title="规则下移"
                  disabled={index === rules.length - 1}
                  className="disabled:opacity-25"
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5"/>
                </button>
                <button
                  title="删除执行人规则"
                  onClick={() =>
                    onChange(rules.filter((item) => item.id !== rule.id))
                  }
                >
                  <X className="h-3.5 w-3.5"/>
                </button>
              </div>
            </div>
            <div className="space-y-4 p-3">
              <Field label="成员来源">
                <Choice
                  label={`规则${index + 1}成员来源`}
                  value={rule.source}
                  onChange={(value) =>
                    patch({source: value as MemberSource, values: []})
                  }
                  options={Object.entries(sourceLabels).map(
                    ([value, label]) => ({
                      value,
                      label: `${['users', 'roles', 'organizations'].includes(value) ? '静态成员' : '动态成员'} · ${label}`,
                    }),
                  )}
                />
              </Field>
              {(rule.source === 'users' || rule.source === 'roles') && <DirectoryMemberPicker
                directory={approvalDirectory} types={[rule.source === 'users' ? 'USER' : 'ROLE']}
                label={rule.source === 'users' ? '选择用户' : '选择角色'}
                value={rule.values.map(id => ({type: rule.source === 'users' ? 'USER' : 'ROLE', id}))}
                onChange={items => patch({values: items.map(item => item.id)})}/>}
              {rule.source === 'organizations' && (
                <>
                  <DirectoryMemberPicker directory={approvalDirectory} types={['ORGANIZATION']} allowIncludeChildren={false}
                    label="选择组织架构" value={rule.values.map(id => ({type: 'ORGANIZATION', id}))}
                    onChange={items => patch({values: items.map(item => item.id)})}/>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={rule.includeChildren}
                      onChange={(event) =>
                        patch({includeChildren: event.target.checked})
                      }
                    />
                    包含下级组织的成员
                  </label>
                </>
              )}
              {rule.source === 'initiator' && (
                <div className="rounded-md bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  自动获取当前流程的发起人，可配合“直接上级”配置主管审批。
                </div>
              )}
              {rule.source === 'node' && (
                <>
                  <MultiChoice
                    value={rule.values}
                    onChange={(values) => patch({values})}
                    options={previous.map((item) => ({
                      value: item.id,
                      label: item.data.title,
                    }))}
                    placeholder="选择上游审批节点"
                  />
                  {previous.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      当前路径还没有可引用的上游审批节点。
                    </p>
                  )}
                </>
              )}
              {rule.source === 'variable' && (
                <Field
                  label="成员变量"
                  hint="变量值应为用户 ID 或用户 ID 数组。"
                >
                  <Choice
                    label="成员变量"
                    value={rule.values[0] ?? ''}
                    onChange={(value) =>
                      patch({values: value ? [value] : []})
                    }
                    options={variableOptions(flow, node.id, forms)}
                  />
                </Field>
              )}
              <Field label="人员范围" hint="相对于当前规则选出的成员计算。">
                <Choice
                  label={`规则${index + 1}人员范围`}
                  value={rule.scope}
                  onChange={(scope) => patch({scope: scope as MemberScope})}
                  options={Object.entries(scopeLabels).map(
                    ([value, label]) => ({value, label}),
                  )}
                />
              </Field>
            </div>
          </div>
        )
      })}
      <Button
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={() => onChange([...rules, newRule()])}
      >
        <Plus className="h-3.5 w-3.5"/>
        添加执行人规则
      </Button>
      <div className="rounded-lg bg-primary/5 p-3">
        <button
          className="flex w-full items-center justify-between text-xs"
          onClick={() => setShowMembers((value) => !value)}
        >
          <span className="flex items-center gap-2 font-medium">
            <Users className="h-3.5 w-3.5 text-primary"/>
            示例解析结果
          </span>
          <span className="text-primary">
            {parsed.length} 人 · {showMembers ? '收起' : '查看'}
          </span>
        </button>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          以当前登录用户预览人员范围；实际执行人在节点激活时由服务器解析并保存，按规则和选取顺序去重。
        </p>
        {showMembers && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {parsed.map((id) => (
              <span
                key={id}
                className="rounded border bg-card px-2 py-1 text-xs"
              >
                {
                  approvalDirectory.members.find((member) => member.id === id)
                    ?.name
                }
              </span>
            ))}
            {!parsed.length && (
              <span className="text-xs text-muted-foreground">
                暂无成员，请补充规则或使用模拟输入。
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function NodePanel(props: Props) {
  const {flow, flows, forms, node, onChange} = props
  const config = node?.data.config
  const patch = (update: Partial<ApprovalConfig>) => {
    if (node)
      onChange({
        ...node,
        data: {
          ...node.data,
          config: {...node.data.config, ...update} as ApprovalConfig,
        },
      })
  }
  const variables = node ? variableOptions(flow, node.id, forms) : []
  const selectedForm =
    config && 'form' in config
      ? forms.find((form) => formKey(form.ref) === formKey(config.form))
      : undefined
  const flowForm = forms.find(
    (form) => formKey(form.ref) === formKey(flow.form),
  )
  const gatewayFields = (flowForm?.fields ?? []).map((field) => ({
    ...field,
    name: `record.${field.name}`,
  }))
  const title = node ? nodeLabels[node.type] : '流程设置'
  const parentGateway =
    node?.type === 'branch'
      ? flattenNodes(flow.definition.nodes).find(
        (item) =>
          item.type === 'gateway' &&
          item.blocks?.some((branch) => branch.id === node.id),
      )
      : undefined
  const deletableBranch =
    config?.kind === 'branch' &&
    !config.fallback &&
    (parentGateway?.blocks?.length ?? 0) > 2
  const protectedNode =
    !node ||
    ['start', 'end'].includes(node.type) ||
    (node.type === 'branch' && !deletableBranch)
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex h-[65px] shrink-0 items-center justify-between border-b px-5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {node ? '配置节点的行为与数据' : '配置当前应用的审批流程'}
          </p>
        </div>
        <Button
          size="xs"
          variant="ghost"
          title="关闭配置面板"
          onClick={props.onClose}
        >
          <X className="h-4 w-4"/>
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!node && (
          <>
            <Section title="基本信息">
              <Field label="流程名称">
                <Input
                  aria-label="编辑流程名称"
                  value={flow.name}
                  onChange={(event) =>
                    props.onFlowChange({...flow, name: event.target.value})
                  }
                  maxLength={80}
                />
              </Field>
              <Field label="流程说明">
                <Textarea
                  aria-label="流程说明"
                  value={flow.description}
                  onChange={(event) =>
                    props.onFlowChange({
                      ...flow,
                      description: event.target.value,
                    })
                  }
                  placeholder="描述这个流程的用途"
                />
              </Field>
              <Field label="关联表单">
                <Choice
                  label="流程关联表单"
                  value={formKey(flow.form)}
                  options={forms.map((form) => ({
                    value: formKey(form.ref),
                    label: form.label,
                  }))}
                  onChange={(key) =>
                    props.onFlowChange({
                      ...flow,
                      form: forms.find((form) => formKey(form.ref) === key)!
                        .ref,
                    })
                  }
                />
              </Field>
            </Section>
            <Section title="如何搭建流程">
              <div className="space-y-4 text-xs leading-6 text-muted-foreground">
                <p>1. 点击连线上的“＋”，添加审批、网关或数据操作。</p>
                <p>2. 点击节点卡片，在这里配置执行人、条件与字段。</p>
                <p>3. 保存草稿，通过模拟预览检查完整流转。</p>
              </div>
            </Section>
            <Section title="保存与执行">
              <div className="flex gap-2 rounded-lg bg-muted/50 p-3 text-xs leading-6 text-muted-foreground">
                <Info className="mt-1 h-4 w-4 shrink-0"/>
                <p>
                  草稿保存在服务器，发布后可从表单记录提交。模拟预览使用独立数据副本；正式审批会执行已发布的数据操作。
                </p>
              </div>
            </Section>
          </>
        )}
        {node && (
          <Section title="节点信息">
            <Field label="节点名称">
              <Input
                aria-label="节点名称"
                maxLength={80}
                value={node.data.title}
                onChange={(event) =>
                  onChange({
                    ...node,
                    data: {...node.data, title: event.target.value},
                  })
                }
              />
            </Field>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>节点 ID</span>
              <code className="truncate">{node.id}</code>
            </div>
          </Section>
        )}
        {config?.kind === 'start' && (
          <Section title="发起数据">
            <p className="text-xs leading-6 text-muted-foreground">
              发起流程时关联「{flowForm?.label ?? flow.form.name}
              」的一条记录。后续节点可以通过“发起记录”引用字段。
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => props.onSelect('')}
            >
              配置关联表单
            </Button>
          </Section>
        )}
        {config?.kind === 'end' && (
          <Section title="流程完成">
            <p className="text-xs leading-6 text-muted-foreground">
              所有必需的节点处理完成后，流程到达此处。任一审批被拒绝将提前终止。
            </p>
          </Section>
        )}
        {config?.kind === 'notification' && node && <>
          <Section title="接收人"><AssigneeEditor rules={config.rules} onChange={rules => patch({rules})} flow={flow}
                                                  node={node} forms={forms}/></Section>
          <Section title="通知内容" description="支持 {{record.字段名}}、{{initiator}} 和上游输出变量；仅发送站内通知。">
            <Field label="标题"><Input aria-label="通知标题" maxLength={200} value={config.titleTemplate}
                                       onChange={event => patch({titleTemplate: event.target.value})}/></Field>
            <Field label="正文"><Textarea aria-label="通知正文" maxLength={5000} value={config.contentTemplate}
                                          onChange={event => patch({contentTemplate: event.target.value})}/></Field>
            <p className="text-xs text-muted-foreground">无人接收或通知失败会记录原因，流程继续。</p>
          </Section>
        </>}
        {config?.kind === 'approval' && node && (
          <>
            <Section
              title="执行人"
              description="组合静态与动态成员，为不同业务配置合适的审批人。"
            >
              <AssigneeEditor
                rules={config.rules}
                onChange={(rules) => patch({rules})}
                flow={flow}
                node={node}
                forms={forms}
              />
            </Section>
            <Section title="签核方式">
              <div className="space-y-2">
                {(
                  [
                    {value: 'all', description: '所有执行人同意后，流程继续'},
                    {
                      value: 'any',
                      description: '任意一位执行人同意后，流程继续',
                    },
                    {
                      value: 'sequential',
                      description: '按执行人顺序，依次完成审批',
                    },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
                      config.signMode === item.value &&
                      'border-primary/60 bg-primary/5',
                    )}
                  >
                    <input
                      type="radio"
                      name="sign-mode"
                      checked={config.signMode === item.value}
                      onChange={() =>
                        patch({signMode: item.value as SignMode})
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-xs font-medium">
                        {signLabels[item.value]}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] leading-5 text-muted-foreground">
                任一执行人拒绝时，立即终止流程。
              </p>
            </Section>
          </>
        )}
        {config?.kind === 'gateway' && node && (
          <Section
            title="条件分支"
            description="按从左到右的优先级匹配；只执行首个命中分支，否则进入默认分支。"
          >
            <div className="space-y-2">
              {node.blocks?.map((branch, index) => (
                <div
                  key={branch.id}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <button
                    className="min-w-0 flex-1 truncate text-left text-xs font-medium"
                    onClick={() => props.onSelect(branch.id)}
                  >
                    {branch.data.title}
                  </button>
                  {branch.data.config.kind === 'branch' &&
                  branch.data.config.fallback ? (
                    <span className="text-[10px] text-muted-foreground">
                      默认
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        title="分支左移"
                        disabled={index === 0}
                        className="disabled:opacity-20"
                        onClick={() => props.onMove(branch.id, -1)}
                      >
                        <ArrowUp className="h-3 w-3"/>
                      </button>
                      <button
                        title="分支右移"
                        disabled={index >= (node.blocks?.length ?? 0) - 2}
                        className="disabled:opacity-20"
                        onClick={() => props.onMove(branch.id, 1)}
                      >
                        <ArrowDown className="h-3 w-3"/>
                      </button>
                    </div>
                  )}
                  <button
                    title="编辑分支条件"
                    onClick={() => props.onSelect(branch.id)}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground"/>
                  </button>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-dashed"
              onClick={() => props.onAddBranch(node.id)}
            >
              <Plus className="h-3.5 w-3.5"/>
              添加条件分支
            </Button>
          </Section>
        )}
        {config?.kind === 'branch' && (
          <Section
            title={config.fallback ? '默认分支' : '分支条件'}
            description={
              config.fallback
                ? '其他条件均不满足时进入此分支，无需设置条件。'
                : '满足下列规则时进入此分支。分支优先级可在网关中调整。'
            }
          >
            {!config.fallback && (
              <ConditionsEditor
                conditions={config.conditions}
                match={config.match}
                onChange={(conditions) => patch({conditions})}
                onMatch={(match) => patch({match})}
                fields={[
                  ...gatewayFields,
                  ...variables
                    .filter(
                      (variable) =>
                        !gatewayFields.some(
                          (field) => field.name === variable.value,
                        ),
                    )
                    .map((variable) => ({
                      name: variable.value,
                      label: variable.label,
                      type: 'TEXT',
                    })),
                ]}
                variables={variables}
              />
            )}
          </Section>
        )}
        {config && 'form' in config && (
          <>
            <Section title="目标表单">
              <Choice
                label="目标表单"
                value={formKey(config.form)}
                onChange={(key) =>
                  patch({
                    form: forms.find((form) => formKey(form.ref) === key)!.ref,
                    conditions: [],
                    assignments: [],
                  })
                }
                options={forms.map((form) => ({
                  value: formKey(form.ref),
                  label: form.label,
                }))}
              />
              <p className="text-[11px] leading-5 text-muted-foreground">
                数据操作仅在模拟副本中执行。
              </p>
            </Section>
            {config.kind !== 'create' && (
              <Section
                title="筛选条件"
                description={
                  config.kind === 'query'
                    ? '不设置条件时查询全部模拟记录。'
                    : '仅处理满足条件的记录，至少设置一个条件。'
                }
              >
                <ConditionsEditor
                  conditions={config.conditions}
                  match={config.match}
                  onChange={(conditions) => patch({conditions})}
                  onMatch={(match) => patch({match})}
                  fields={selectedForm?.fields ?? []}
                  variables={variables}
                />
              </Section>
            )}
            {(config.kind === 'create' || config.kind === 'update') && (
              <Section title="字段赋值">
                <AssignmentsEditor
                  items={config.assignments}
                  onChange={(assignments) => patch({assignments})}
                  fields={selectedForm?.fields ?? []}
                  variables={variables}
                />
              </Section>
            )}
            <Section title="输出配置">
              {config.kind === 'query' && (
                <Field label="查询结果">
                  <Choice
                    label="查询结果类型"
                    value={config.queryMode}
                    onChange={(queryMode) =>
                      patch({queryMode: queryMode as 'one' | 'many'})
                    }
                    options={[
                      {value: 'one', label: '返回第一条记录'},
                      {value: 'many', label: '返回多条记录'},
                    ]}
                  />
                </Field>
              )}
              <Field label="输出变量名" hint="后续节点可通过变量引用操作结果。">
                <Input
                  aria-label="输出变量名"
                  className="font-mono text-xs"
                  value={config.output}
                  onChange={(event) => patch({output: event.target.value})}
                />
              </Field>
            </Section>
          </>
        )}
        {config?.kind === 'subflow' && (
          <>
            <Section title="调用流程">
              <Choice
                label="选择子流程"
                value={config.flowId}
                onChange={(flowId) => patch({flowId})}
                options={flows
                  .filter((item) => item.id !== flow.id)
                  .map((item) => ({value: item.id, label: item.name}))}
              />
              {config.flowId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => props.onOpenSubflow(config.flowId)}
                >
                  <GitBranch className="h-3.5 w-3.5"/>
                  查看子流程
                  <ArrowUpRight className="h-3.5 w-3.5"/>
                </Button>
              )}
              <p className="text-[11px] leading-5 text-muted-foreground">
                同步等待子流程完成，不允许循环调用。
              </p>
            </Section>
            <Section
              title="输入变量映射"
              description="默认继承当前上下文；可为子流程覆盖指定变量。"
            >
              <AssignmentsEditor
                free
                items={config.inputs}
                onChange={(inputs) => patch({inputs})}
                fields={[]}
                variables={variables}
              />
            </Section>
            <Section
              title="输出变量映射"
              description="将子流程结果写入当前流程变量。"
            >
              <AssignmentsEditor
                free
                items={config.outputs}
                onChange={(outputs) => patch({outputs})}
                fields={[]}
                variables={
                  flows
                    .find((item) => item.id === config.flowId)
                    ?.definition.nodes.flatMap((item) =>
                    'output' in item.data.config
                      ? [
                        {
                          value: item.data.config.output,
                          label: `${item.data.title} · 输出`,
                        },
                      ]
                      : [],
                  ) ?? []
                }
              />
            </Section>
          </>
        )}
      </div>
      {node && !protectedNode && (
        <div className="flex shrink-0 items-center justify-between border-t px-5 py-3">
          {node.type !== 'branch' ? (
            <Button variant="ghost" size="sm" onClick={props.onCopy}>
              <Copy className="h-3.5 w-3.5"/>
              复制节点
            </Button>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              删除分支将同时删除其中的节点
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={props.onDelete}
          >
            <Trash2 className="h-3.5 w-3.5"/>
            删除节点
          </Button>
        </div>
      )}
    </div>
  )
}

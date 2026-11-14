import {FlowRunsDrawer} from './FlowRunsDrawer'
import {FlowTriggerEditor} from './FlowTriggerEditor'
import * as React from 'react'
import {Link, useNavigate} from 'react-router-dom'
import {
  ArrowUpRight,
  CirclePlus,
  Copy,
  FileText,
  GitBranch,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
  Workflow,
} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {BizDialog} from '@/components/ui/dialog'
import {SearchInput} from '@/components/biz/SearchInput'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Pagination} from '@/components/biz/Pagination'
import {message} from '@/components/ui/message'
import {
  createApprovalFlow,
  deleteApprovalFlow,
  duplicateApprovalFlow,
  getApprovalFlows,
  setApprovalFlowStatus,
} from '@/services/workflows'
import {flattenNodes, formKey, validateFlow} from '@/lib/workflow'
import type {ApprovalFlow, FlowTrigger} from '@/types/workflow'
import {Field, useApprovalForms} from './controls'
import {cn, toErrorMessage} from '@/lib/utils'

export const statusLabels = {
  draft: '草稿',
  enabled: '已启用',
  disabled: '已停用',
}

export const triggerLabels: Record<FlowTrigger['type'], string> = {
  MANUAL: '手动触发',
  DATA_EVENT: '表单事件触发',
  SCHEDULE: '定时触发',
}

export function flowTrigger(flow: ApprovalFlow): FlowTrigger | undefined {
  const start = flow.definition.nodes[0]?.data.config
  return start?.kind === 'start' ? start.trigger : undefined
}

export function FlowStatus({status}: { status: ApprovalFlow['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
        status === 'enabled'
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'enabled' ? 'bg-primary' : 'bg-muted-foreground/60',
        )}
      />
      {statusLabels[status]}
    </span>
  )
}

export default function ApprovalList({appId, boundFormName}: { appId?: string; boundFormName?: string }) {
  const navigate = useNavigate()
  const [flows, setFlows] = React.useState<ApprovalFlow[]>([])
  const [error, setError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<string[]>([])
  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [trigger, setTrigger] = React.useState<FlowTrigger>({type: 'MANUAL', formName: '', lockRecord: false})
  const [runFlow, setRunFlow] = React.useState<ApprovalFlow | null>(null)
  const [deleteIds, setDeleteIds] = React.useState<string[]>([])
  const {
    forms,
    error: formError,
    reload: reloadForms,
  } = useApprovalForms(appId ?? '')
  const load = React.useCallback(async () => {
    if (!appId) return
    try {
      const all = await getApprovalFlows(appId)
      setFlows(boundFormName ? all.filter(flow => {
        const trigger = flowTrigger(flow)
        return trigger?.type !== 'SCHEDULE' && trigger?.formName === boundFormName
      }) : all)
      setError('')
    } catch (cause) {
      setError(String(cause instanceof Error ? cause.message : cause))
    }
  }, [appId, boundFormName])
  React.useEffect(() => {
    void load()
  }, [load])
  const perform = async (action: () => void | Promise<unknown>) => {
    try {
      await action()
      await load()
    } catch (cause) {
      message.error(toErrorMessage(cause, '操作失败'))
    }
  }
  const filtered = flows.filter(
    (flow) =>
      flow.name.includes(search) &&
      (status === 'all' || flow.status === status),
  )
  const pages = Math.max(1, Math.ceil(filtered.length / 30))
  const currentPage = Math.min(page, pages),
    rows = filtered.slice((currentPage - 1) * 30, currentPage * 30)
  const manualDefault = (): FlowTrigger => ({
    type: 'MANUAL',
    formName: boundFormName ?? forms.find(form => form.ref.kind === 'app')?.ref.name ?? '',
    lockRecord: false,
  })
  const openCreate = () => {
    setName('')
    setTrigger(manualDefault())
    setCreateOpen(true)
  }
  if (!appId)
    return (
      <div className="rounded-xl border bg-card px-6 py-16 text-center">
        <Workflow className="mx-auto mb-4 h-10 w-10 text-primary"/>
        <h2 className="text-lg font-medium">为应用配置工作流</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          先选择一个应用，再创建和管理它的工作流。
        </p>
        <Button asChild className="mt-6">
          <Link to="/admin/apps">
            前往应用管理
            <ArrowUpRight className="h-4 w-4"/>
          </Link>
        </Button>
      </div>
    )
  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted/70 p-1">
          {[
            {value: 'all', label: '全部流程'},
            {value: 'enabled', label: '已启用'},
            {value: 'draft', label: '草稿'},
            {value: 'disabled', label: '已停用'},
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => {
                setStatus(item.value)
                setPage(1)
                setSelected([])
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs transition-colors',
                item.value === status
                  ? 'bg-card font-medium text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {item.label}
              <span className="ml-1.5 text-[11px] opacity-60">
                {
                  flows.filter(
                    (flow) =>
                      item.value === 'all' || flow.status === item.value,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            aria-label="搜索流程"
            className="w-44"
            placeholder="搜索流程名称"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
              setSelected([])
            }}
          />
          <Button size="sm" onClick={openCreate}>
            <CirclePlus className="h-4 w-4"/>
            新建流程
          </Button>
        </div>
      </div>
      {formError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-md border border-destructive/30 p-3 text-xs text-destructive"
        >
          <span>应用表单读取失败：{formError}。示例表单仍可体验。</span>
          <button onClick={reloadForms} className="ml-3 shrink-0 underline">
            重试
          </button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}
          <button className="ml-3 underline" onClick={load}>
            重试
          </button>
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex items-center justify-between rounded-md bg-muted p-2 text-xs">
          <span>已选择 {selected.length} 条流程</span>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setDeleteIds(selected)}
          >
            <Trash2 className="h-3.5 w-3.5"/>
            删除所选
          </Button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="app-table min-w-[760px]">
            <thead>
            <tr>
              <th className="w-10">
                <input
                  aria-label="选择本页全部流程"
                  type="checkbox"
                  checked={
                    rows.length > 0 &&
                    rows.every((flow) => selected.includes(flow.id))
                  }
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? rows.map((flow) => flow.id) : [],
                    )
                  }
                />
              </th>
              <th>流程名称</th>
              <th>关联表单</th>
              <th>触发方式</th>
              <th>状态</th>
              <th>更新时间</th>
              <th className="w-24">操作</th>
            </tr>
            </thead>
            <tbody>
            {rows.map((flow) => (
              <tr key={flow.id}>
                <td>
                  <input
                    aria-label={`选择${flow.name}`}
                    type="checkbox"
                    checked={selected.includes(flow.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, flow.id]
                          : selected.filter((id) => id !== flow.id),
                      )
                    }
                  />
                </td>
                <td>
                  <button
                    className="flex items-center gap-3 text-left"
                    onClick={() =>
                      navigate(
                        `/admin/apps/${appId}/workflow/${flow.id}/design`,
                      )
                    }
                  >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
                        <GitBranch className="h-4 w-4"/>
                      </span>
                    <span>
                        <span className="block font-medium">{flow.name}</span>
                        <span className="mt-0.5 block max-w-[240px] truncate text-xs text-muted-foreground">
                          {flow.description || '暂无描述'}
                        </span>
                      </span>
                  </button>
                </td>
                <td>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5"/>
                      {forms.find(
                        (form) => formKey(form.ref) === formKey(flow.form),
                      )?.label ?? (flow.form.name || '—')}
                    </span>
                </td>
                <td>
                  <span
                    className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {triggerLabels[flowTrigger(flow)?.type ?? 'MANUAL']}
                  </span>
                </td>
                <td>
                  <FlowStatus status={flow.status}/>{flow.deploymentId && flow.hasDraftChanges &&
                  <span className="ml-2 text-xs text-muted-foreground">有未发布修改</span>}
                </td>
                <td className="text-xs text-muted-foreground">
                  {new Date(flow.updatedAt).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <Button
                      size="xs"
                      variant="ghost"
                      title={`编辑${flow.name}`}
                      onClick={() =>
                        navigate(
                          `/admin/apps/${appId}/workflow/${flow.id}/design`,
                        )
                      }
                    >
                      <Pencil className="h-3.5 w-3.5"/>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="xs"
                          variant="ghost"
                          aria-label={`${flow.name}更多操作`}
                        >
                          <MoreHorizontal className="h-4 w-4"/>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setRunFlow(flow)}>执行记录</DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            perform(async () => {
                              await duplicateApprovalFlow(flow)
                              message.success('已复制为草稿')
                            })
                          }
                        >
                          <Copy className="h-3.5 w-3.5"/>
                          复制流程
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            perform(async () => {
                              if (flow.status !== 'enabled') {
                                const issues = validateFlow(flow, flows, forms)
                                if (issues.length)
                                  throw new Error(issues[0].message)
                              }
                              await setApprovalFlowStatus(flow, flow.status === 'enabled' ? 'disabled' : 'enabled')
                              message.success(
                                flow.status === 'enabled'
                                  ? '流程已停用'
                                  : '流程已发布并启用',
                              )
                            })
                          }
                        >
                          <Play className="h-3.5 w-3.5"/>
                          {flow.status === 'enabled'
                            ? '停用流程'
                            : '启用流程'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => setDeleteIds([flow.id])}
                        >
                          <Trash2 className="h-3.5 w-3.5"/>
                          删除流程
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
          {rows.length === 0 && !error && (
            <div className="py-14 text-center">
              <Workflow className="mx-auto mb-3 h-9 w-9 text-muted-foreground/40"/>
              <p className="text-sm text-muted-foreground">
                {search || status !== 'all'
                  ? '没有找到匹配的流程'
                  : '还没有工作流，从第一个节点开始吧'}
              </p>
              <Button variant="link" onClick={openCreate}>
                新建流程
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-[11px] text-muted-foreground">
            工作流支持手动、表单事件和定时触发；模拟预览使用独立数据副本
          </span>
          <Pagination
            page={currentPage}
            pages={pages}
            total={filtered.length}
            size={30}
            onChange={setPage}
          />
        </div>
      </div>
      <BizDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建工作流"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              disabled={!name.trim() || (trigger.type !== 'SCHEDULE' && !trigger.formName)}
              onClick={() =>
                perform(async () => {
                  const flow = await createApprovalFlow(appId, name.trim(), trigger)
                  setCreateOpen(false)
                  navigate(`/admin/apps/${appId}/workflow/${flow.id}/design`)
                })
              }
            >
              创建并设计
              <ArrowUpRight className="h-4 w-4"/>
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="流程名称">
            <Input
              aria-label="流程名称"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：费用报销审批"
              maxLength={80}
            />
          </Field>
          <FlowTriggerEditor
            appId={appId ?? ''}
            forms={forms}
            value={trigger}
            onChange={setTrigger}
            cards
            allowedTypes={boundFormName ? ['MANUAL', 'DATA_EVENT'] : undefined}
            lockForm={!!boundFormName}
          />
        </div>
      </BizDialog>
      <BizDialog
        open={deleteIds.length > 0}
        onOpenChange={(open) => !open && setDeleteIds([])}
        title="删除工作流"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteIds([])}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                perform(async () => {
                  const references = flows.filter(
                    (flow) =>
                      !deleteIds.includes(flow.id) &&
                      flattenNodes(flow.definition.nodes).some(
                        (node) =>
                          node.data.config.kind === 'subflow' &&
                          deleteIds.includes(node.data.config.flowId),
                      ),
                  )
                  if (references.length)
                    throw new Error(
                      `流程仍被「${references[0].name}」引用，请先移除子流程节点`,
                    )
                  await Promise.all(deleteIds.map((id) => deleteApprovalFlow(appId, id)))
                  setDeleteIds([])
                  setSelected([])
                  message.success('流程已删除')
                })
              }
            >
              确认删除
            </Button>
          </>
        }
      >
        <p>
          确认删除 {deleteIds.length} 条流程吗？历史审批及发布版本将保留。
        </p>
      </BizDialog>
      {runFlow && <FlowRunsDrawer flow={runFlow} onClose={() => setRunFlow(null)}/>}
    </div>
  )
}

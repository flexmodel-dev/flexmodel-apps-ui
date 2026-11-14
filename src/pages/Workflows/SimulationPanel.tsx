import * as React from 'react'
import {useDirectory} from './directory'
import {getAuthSession} from '@/services/auth'
import {
  Check,
  CheckCircle2,
  Clock3,
  Play,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/components/ui/drawer'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
  approvalSampleRecords,
  approvalSampleVariables,
} from '@/data/mock'
import {ApprovalSimulation} from '@/lib/workflowSimulation'
import {formKey} from '@/lib/workflow'
import type {ApprovalFlow, ApprovalForm, RecordStore} from '@/types/workflow'
import {Choice, Field, MultiChoice} from './controls'
import {cn} from '@/lib/utils'

export default function SimulationPanel({
                                          open,
                                          onOpenChange,
                                          flow,
                                          flows,
                                          forms,
                                          onLocate,
                                        }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  flow: ApprovalFlow
  flows: ApprovalFlow[]
  forms: ApprovalForm[]
  onLocate: (id: string) => void
}) {
  const form = forms.find((item) => formKey(item.ref) === formKey(flow.form))
  const approvalDirectory = useDirectory()
  const [initiator, setInitiator] = React.useState(getAuthSession()?.user.id ?? approvalDirectory.members[0]?.id ?? '')
  const [record, setRecord] = React.useState<Record<string, unknown>>(() =>
    flow.form.kind === 'demo'
      ? {...approvalSampleVariables.record}
      : Object.fromEntries(
        (form?.fields ?? []).map((field) => [
          field.name,
          field.name === 'id'
            ? 'SIM-001'
            : ['NUMBER', 'DECIMAL'].includes(field.type)
              ? 0
              : field.type === 'BOOL'
                ? false
                : '',
        ]),
      ),
  )
  const [reviewers, setReviewers] = React.useState(
    approvalSampleVariables.reviewerIds,
  )
  const [simulation, setSimulation] = React.useState<ApprovalSimulation | null>(
    null,
  )
  const [, refresh] = React.useReducer((value) => value + 1, 0)
  const memberOptions = approvalDirectory.members.map((member) => ({
    value: member.id,
    label: member.name,
    description: member.role,
  }))
  const start = () => {
    const records: RecordStore = structuredClone(approvalSampleRecords)
    if (flow.form.kind === 'app')
      records[formKey(flow.form)] = [{id: 'SIM-001', ...record}]
    else
      records[formKey(flow.form)] = [
        {...record},
        ...(records[formKey(flow.form)] ?? []).filter(
          (item) => item.id !== record.id,
        ),
      ]
    setSimulation(
      new ApprovalSimulation(
        structuredClone(flow),
        structuredClone(flows),
        approvalDirectory,
        {
          initiatorId: initiator,
          variables: {record: {...record}, reviewerIds: reviewers},
          nodeMembers: {},
        },
        records,
      ),
    )
  }
  const labels = {
    running: '流转中',
    waiting: '等待审批',
    completed: '流程已完成',
    rejected: '流程已拒绝',
    failed: '模拟失败',
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="w-[min(96vw,520px)] bg-card" hideClose>
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-5">
          <div>
            <DrawerTitle className="text-base font-semibold">
              模拟预览
            </DrawerTitle>
            <DrawerDescription className="mt-1 text-xs text-muted-foreground">
              {flow.name} · 仅在模拟副本中运行
            </DrawerDescription>
          </div>
          <Button
            variant="ghost"
            size="xs"
            title="关闭模拟预览"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4"/>
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {!simulation ? (
            <div className="space-y-6">
              <div className="rounded-lg border bg-background/60 p-4 text-xs leading-6 text-muted-foreground">
                配置发起人和示例数据，逐步体验审批签核、条件路由与自动化操作。所有变化仅作用于本次预览。
              </div>
              <Field label="模拟发起人">
                <Choice
                  label="模拟发起人"
                  value={initiator}
                  onChange={setInitiator}
                  options={memberOptions}
                />
              </Field>
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-medium">
                  发起记录
                  <span className="text-xs font-normal text-muted-foreground">
                    {form?.label}
                  </span>
                </h3>
                <div className="space-y-4 rounded-lg border p-4">
                  {(form?.fields ?? []).map((field) => (
                    <Field key={field.name} label={field.label}>
                      {field.type === 'BOOL' ? (
                        <Choice
                          label={field.label}
                          value={String(record[field.name] ?? false)}
                          onChange={(value) =>
                            setRecord({
                              ...record,
                              [field.name]: value === 'true',
                            })
                          }
                          options={[
                            {value: 'true', label: '是'},
                            {value: 'false', label: '否'},
                          ]}
                        />
                      ) : (
                        <Input
                          aria-label={`模拟${field.label}`}
                          type={
                            ['NUMBER', 'DECIMAL'].includes(field.type)
                              ? 'number'
                              : field.type === 'DATE'
                                ? 'date'
                                : field.type === 'DATETIME'
                                  ? 'datetime-local'
                                  : 'text'
                          }
                          value={String(record[field.name] ?? '')}
                          onChange={(event) =>
                            setRecord({
                              ...record,
                              [field.name]: ['NUMBER', 'DECIMAL'].includes(
                                field.type,
                              )
                                ? Number(event.target.value)
                                : event.target.value,
                            })
                          }
                        />
                      )}
                    </Field>
                  ))}
                </div>
              </div>
              <Field
                label="流程变量：审批人 ID 列表"
                hint="动态成员选择 reviewerIds 时使用。"
              >
                <MultiChoice
                  value={reviewers}
                  onChange={setReviewers}
                  options={memberOptions}
                />
              </Field>
            </div>
          ) : (
            <div className="space-y-5">
              <div
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-4',
                  simulation.status === 'rejected' ||
                  simulation.status === 'failed'
                    ? 'border-destructive/30 bg-destructive/5'
                    : 'border-primary/20 bg-primary/5',
                )}
              >
                <span className="mt-0.5">
                  {simulation.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-primary"/>
                  ) : simulation.status === 'rejected' ||
                  simulation.status === 'failed' ? (
                    <XCircle className="h-5 w-5 text-destructive"/>
                  ) : (
                    <Clock3 className="h-5 w-5 text-primary"/>
                  )}
                </span>
                <div>
                  <h3 className="text-sm font-medium">
                    {labels[simulation.status]}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {simulation.error ||
                      (simulation.status === 'waiting'
                        ? '请以执行人身份同意或拒绝，观察后续流转。'
                        : '可展开节点查看数据，或重置后更换输入再次体验。')}
                  </p>
                </div>
              </div>
              <div className="space-y-0">
                {simulation.events.map((event, index) => (
                  <div
                    key={event.id}
                    className="relative flex gap-3 pb-5"
                    style={{marginLeft: event.depth * 14}}
                  >
                    {index !== simulation.events.length - 1 && (
                      <div className="absolute left-[11px] top-6 h-[calc(100%-20px)] w-px bg-border"/>
                    )}
                    <span
                      className={cn(
                        'z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-card',
                        event.status === 'waiting'
                          ? 'border-primary text-primary'
                          : event.status === 'rejected'
                            ? 'border-destructive text-destructive'
                            : 'text-muted-foreground',
                      )}
                    >
                      {event.status === 'completed' ? (
                        <Check className="h-3 w-3"/>
                      ) : event.status === 'waiting' ? (
                        <Clock3 className="h-3 w-3"/>
                      ) : (
                        <X className="h-3 w-3"/>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <button
                        className="text-left text-xs font-medium"
                        onClick={() => {
                          onLocate(event.nodeId)
                          onOpenChange(false)
                        }}
                      >
                        {event.title}
                        {event.depth > 0 && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            子流程
                          </span>
                        )}
                      </button>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {event.detail}
                      </p>
                      {event.members && (
                        <div className="mt-3 space-y-2">
                          {event.members.map((id) => {
                            const member = approvalDirectory.members.find(
                              (item) => item.id === id,
                            )
                            const decision = event.decisions?.[id]
                            const allowed =
                              simulation.canDecide(id) &&
                              event.status === 'waiting'
                            return (
                              <div
                                key={id}
                                className="flex items-center gap-2 rounded-lg border bg-background/50 p-2.5"
                              >
                                <span
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                                  {member?.name.slice(-2)}
                                </span>
                                <span className="flex-1 text-xs">
                                  {member?.name}
                                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                    {member?.role}
                                  </span>
                                </span>
                                {decision ? (
                                  <span
                                    className={cn(
                                      'text-[11px]',
                                      decision === 'reject'
                                        ? 'text-destructive'
                                        : 'text-primary',
                                    )}
                                  >
                                    {decision === 'approve'
                                      ? '已同意'
                                      : '已拒绝'}
                                  </span>
                                ) : event.status === 'waiting' ? (
                                  <div className="flex gap-1">
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      disabled={!allowed}
                                      onClick={() => {
                                        simulation.decide(id, 'reject')
                                        refresh()
                                      }}
                                      aria-label={`拒绝${member?.name}`}
                                    >
                                      拒绝
                                    </Button>
                                    <Button
                                      size="xs"
                                      disabled={!allowed}
                                      onClick={() => {
                                        simulation.decide(id, 'approve')
                                        refresh()
                                      }}
                                      aria-label={`同意${member?.name}`}
                                    >
                                      同意
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">
                                    无需处理
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {(event.input !== undefined ||
                        event.output !== undefined) && (
                        <details className="mt-2 rounded-md border bg-background/50 p-2.5">
                          <summary className="cursor-pointer text-[11px] text-muted-foreground">
                            查看输入与输出
                          </summary>
                          <pre
                            className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-5">
                            {JSON.stringify(
                              {input: event.input, output: event.output},
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-between border-t bg-card px-6 py-4">
          <span className="text-[10px] text-muted-foreground">
            不会修改真实业务数据
          </span>
          {simulation ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSimulation(null)}
            >
              <RotateCcw className="h-3.5 w-3.5"/>
              重置模拟
            </Button>
          ) : (
            <Button size="sm" onClick={start}>
              <Play className="h-3.5 w-3.5"/>
              开始模拟
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

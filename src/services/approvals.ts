import type {ApprovalFlow, ApprovalMember, FlowTrigger, MemberDirectory, ValidationIssue} from '../types/approval'
import {cloneNode, emptyDocument} from '../lib/approval'
import {requestJson} from './http'
import {cachedFetch, createAppDataCache} from './appDataCache'
import {decodeApprovalFlow, encodeApprovalFlow, type ApprovalFlowRecord} from './approval-model'
import {getDirectory} from './directory'

const base = (appId: string) => `/api/apps/${encodeURIComponent(appId)}/flows`
export const getApprovalFlows = async (appId: string) => (await requestJson<ApprovalFlowRecord[]>(base(appId))).map(record => decodeApprovalFlow(record, appId))
export const getApprovalFlow = async (appId: string, id: string) => decodeApprovalFlow(await requestJson<ApprovalFlowRecord>(`${base(appId)}/${encodeURIComponent(id)}`), appId)
export const getApprovalDirectory = (appId: string) => getDirectory(appId) as Promise<MemberDirectory>

const memberCache = createAppDataCache<Record<string, ApprovalMember>>()

export function getApprovalMembers(appId: string): Promise<Record<string, ApprovalMember>> {
  return cachedFetch(memberCache, appId, () => getApprovalDirectory(appId)
    .then(directory => Object.fromEntries(directory.members.map(member => [member.id, member]))))
}

/** 审批成员目录的 id → 姓名映射（会话内缓存），供列表直接展示发起人姓名 */
export function getApprovalMemberNames(appId: string): Promise<Record<string, string>> {
  return getApprovalMembers(appId).then(members =>
    Object.fromEntries(Object.values(members).map(member => [member.id, member.name])))
}

export const validateApprovalFlow = (flow: ApprovalFlow) => requestJson<ValidationIssue[]>(`${base(flow.appId)}/validate`, {
  method: 'POST',
  body: JSON.stringify(encodeApprovalFlow(flow))
})
export const saveApprovalFlow = async (flow: ApprovalFlow) => decodeApprovalFlow(await requestJson<ApprovalFlowRecord>(`${base(flow.appId)}/${encodeURIComponent(flow.id)}`, {
  method: 'PUT',
  body: JSON.stringify(encodeApprovalFlow(flow))
}), flow.appId)
export const publishFlow = async (flow: ApprovalFlow) => decodeApprovalFlow(await requestJson<ApprovalFlowRecord>(`${base(flow.appId)}/${encodeURIComponent(flow.id)}/publish`, {
  method: 'POST'
}), flow.appId)
export const setApprovalFlowStatus = async (flow: ApprovalFlow, status: 'enabled' | 'disabled') => {
  if (flow.status === 'draft' && status === 'enabled') return publishFlow(flow)
  return decodeApprovalFlow(await requestJson<ApprovalFlowRecord>(`${base(flow.appId)}/${encodeURIComponent(flow.id)}/enabled`, {
    method: 'PUT',
    body: JSON.stringify({enabled: status === 'enabled'})
  }), flow.appId)
}

export async function createApprovalFlow(appId: string, name: string, trigger: FlowTrigger): Promise<ApprovalFlow> {
  const body: ApprovalFlow = {
    id: '', appId, name, description: '', form: {kind: 'app', name: ''},
    status: 'draft', updatedAt: '', definition: emptyDocument()
  }
  body.name = name
  body.form = {kind: 'app', name: 'formName' in trigger ? trigger.formName : ''}
  const start = body.definition.nodes[0]
  body.definition.nodes[0] = {...start, data: {...start.data, config: {kind: 'start', trigger}}}
  const draft = {...body, id: '', appId, status: 'draft' as const, updatedAt: ''}
  return decodeApprovalFlow(await requestJson<ApprovalFlowRecord>(base(appId), {
    method: 'POST',
    body: JSON.stringify(encodeApprovalFlow(draft))
  }), appId)
}

export async function duplicateApprovalFlow(flow: ApprovalFlow) {
  const container = cloneNode({
    id: 'copy-root',
    type: 'gateway',
    data: {title: '', config: {kind: 'gateway'}},
    blocks: flow.definition.nodes
  })
  const draft = {
    ...flow,
    id: '',
    flowKey: '',
    name: `${flow.name}（副本）`,
    definition: {nodes: container.blocks!}
  }
  return decodeApprovalFlow(await requestJson<ApprovalFlowRecord>(base(flow.appId), {
    method: 'POST',
    body: JSON.stringify(encodeApprovalFlow(draft))
  }), flow.appId)
}

export const deleteApprovalFlow = (appId: string, id: string) => requestJson<void>(`${base(appId)}/${encodeURIComponent(id)}`, {method: 'DELETE'})

export interface ApprovalItem {
  triggerType?: 'MANUAL' | 'DATA_EVENT' | 'SCHEDULE' | 'SUBFLOW';
  principal?: string;
  id: string;
  appId: string;
  appName: string;
  title: string;
  formName: string;
  recordId: string
  initiator: string;
  status: string;
  createdAt: string;
  taskId?: string;
  nodeTitle?: string;
  decision?: string
}

export interface ApprovalTask {
  id: string;
  userId: string;
  status: string;
  decision?: string;
  comment?: string;
  decidedAt?: string;
  position: number;
  waitId: string
}

export interface ApprovalUpcomingNode {
  id: string;
  title: string;
  kind: string;
  signMode?: string;
  certain: boolean;
  candidates?: Array<{ id: string; title: string; kind: string; signMode?: string }>
}

export interface ApprovalEndingNode {
  id: string;
  title: string;
  kind: string;
  status?: string
}

export interface ApprovalDetail extends ApprovalItem {
  canManage: boolean
  snapshot: Record<string, unknown>;
  variables: Record<string, unknown>;
  error: string
  tasks: ApprovalTask[];
  waits: Array<{ id: string; title: string; members: string[]; status: string; signMode: string }>
  upcoming: ApprovalUpcomingNode[]
  ending?: ApprovalEndingNode | null
  logs: Array<{ id: string; title: string; kind: string; input: unknown; output: unknown }>
  children: ApprovalItem[];
  notificationDelivery: Array<{ messageId: string; state: string; attempts: number; error: string }>
  delivery: Array<{ messageId: string; state: string; attempts: number; error: string }>
}

export const approvalStatus: Record<string, string> = {
  QUEUED: '提交中',
  RUNNING: '运行中',
  WAITING: '等待审批',
  SUCCEEDED: '已完成',
  REJECTING: '正在拒绝',
  REJECTED: '已拒绝',
  TERMINATING: '正在终止',
  TERMINATED: '已终止',
  FAILED: '执行异常'
}

/** 审批已结束的状态集合 */
export const FINISHED_STATUS = ['SUCCEEDED', 'REJECTED', 'TERMINATED']

export function listPersonalApprovals(view: 'pending' | 'handled' | 'initiated', appId?: string, search = '', page = 1) {
  const params = new URLSearchParams({view, search, page: String(page), size: '30'})
  if (appId) params.set('appId', appId)
  return requestJson<{
    list: ApprovalItem[];
    total: number
  }>(`/api/flows/mine/${view === 'initiated' ? 'instances' : 'tasks'}?${params}`)
}

export const getApprovalDetail = (appId: string, id: string) => requestJson<ApprovalDetail>(`/api/apps/${encodeURIComponent(appId)}/flow-instances/${encodeURIComponent(id)}`)
export const decideApproval = (appId: string, taskId: string, decision: 'approve' | 'reject', comment: string, requestKey: string) => requestJson(`/api/apps/${encodeURIComponent(appId)}/flow-tasks/${encodeURIComponent(taskId)}/decisions`, {
  method: 'POST',
  body: JSON.stringify({decision, comment, requestKey})
})
export const manageApproval = (appId: string, id: string, action: 'retry' | 'terminate') => requestJson(`/api/apps/${encodeURIComponent(appId)}/flow-instances/${encodeURIComponent(id)}/${action}`, {method: 'POST'})
const recordPath = (appId: string, form: string, id: string) => `/api/apps/${encodeURIComponent(appId)}/flow-instances?${new URLSearchParams({
  formName: form,
  recordId: id
})}`
export const retryApprovalNotifications = (appId: string, id: string) => requestJson(`/api/apps/${encodeURIComponent(appId)}/flow-instances/${encodeURIComponent(id)}/retry-notifications`, {method: 'POST'})
export const recordApprovals = (appId: string, form: string, id: string) => requestJson<{
  list: ApprovalItem[];
  total: number
}>(recordPath(appId, form, id)).then(page => page.list)
export const submitApproval = (appId: string, _form: string, id: string, flowId: string, requestKey: string) => requestJson<{
  id: string
}>(`${base(appId)}/${encodeURIComponent(flowId)}/instances`, {
  method: 'POST',
  body: JSON.stringify({recordId: id, requestKey})
})

export const previewFlowSchedule = (appId: string, config: {
  cron: string;
  timezone: string;
  startAt?: string;
  endAt?: string
}) => requestJson<string[]>(`${base(appId)}/cron-preview?${new URLSearchParams({
  cron: config.cron,
  timezone: config.timezone,
  startAt: config.startAt ?? '',
  endAt: config.endAt ?? ''
})}`)
export const listFlowInstances = (appId: string, id: string) => requestJson<{
  list: ApprovalItem[];
  total: number
}>(`${base(appId)}/${encodeURIComponent(id)}/instances`).then(page => page.list)
export const getFlowTriggerLogs = (appId: string, id: string) => requestJson<Array<{
  id: string;
  state: string;
  reason: string;
  instanceId: string;
  createdAt: string
}>>(`${base(appId)}/${encodeURIComponent(id)}/trigger-logs`)

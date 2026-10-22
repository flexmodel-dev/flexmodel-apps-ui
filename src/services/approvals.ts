import type {ApprovalFlow, FormRef, MemberDirectory, ValidationIssue} from '../types/approval'
import {createApprovalTemplates} from '../data/mock'
import {cloneNode, emptyDocument, flattenNodes} from '../lib/approval'
import {requestJson} from './http'
import {cachedFetch, createAppDataCache} from './appDataCache'
import {decodeApprovalFlow, encodeApprovalFlow, type ApprovalFlowRecord} from './approval-model'

const base = (appId: string) => `/api/apps/${encodeURIComponent(appId)}/approval-flows`
export const getApprovalFlows = async (appId: string) => (await requestJson<ApprovalFlowRecord[]>(base(appId))).map(record => decodeApprovalFlow(record, appId))
export const getApprovalFlow = async (appId: string, id: string) => decodeApprovalFlow(await requestJson<ApprovalFlowRecord>(`${base(appId)}/${encodeURIComponent(id)}`), appId)
export const getApprovalDirectory = (appId: string) => requestJson<MemberDirectory>(`/api/apps/${encodeURIComponent(appId)}/approval-directory`)

const memberNameCache = createAppDataCache<Record<string, string>>()

/** 审批成员目录的 id → 姓名映射（会话内缓存），供列表直接展示发起人姓名 */
export function getApprovalMemberNames(appId: string): Promise<Record<string, string>> {
  return cachedFetch(memberNameCache, appId, () =>
    getApprovalDirectory(appId)
      .then((directory) => Object.fromEntries(directory.members.map((member) => [member.id, member.name]))))
}

export const validateApprovalFlow = (flow: ApprovalFlow) => requestJson<ValidationIssue[]>(`${base(flow.appId)}/validate`, {
  method: 'POST',
  body: JSON.stringify(encodeApprovalFlow(flow))
})
export const saveApprovalFlow = async (flow: ApprovalFlow) => decodeApprovalFlow(await requestJson<ApprovalFlowRecord>(`${base(flow.appId)}/${encodeURIComponent(flow.id)}`, {
  method: 'PUT',
  body: JSON.stringify(encodeApprovalFlow(flow))
}), flow.appId)
export const setApprovalFlowStatus = async (flow: ApprovalFlow, status: 'enabled' | 'disabled') => decodeApprovalFlow(await requestJson<ApprovalFlowRecord>(`${base(flow.appId)}/${encodeURIComponent(flow.id)}/status`, {
  method: 'POST',
  body: JSON.stringify({status: status === 'enabled' ? 2 : 3, revision: flow.revision})
}), flow.appId)

export async function createApprovalFlow(appId: string, name: string, template = false, form?: FormRef): Promise<ApprovalFlow> {
  const body = template ? createApprovalTemplates(appId)[0] : {
    name,
    description: '',
    form: form ?? {kind: 'app', name: ''},
    definition: emptyDocument()
  }
  body.name = name
  if (form) body.form = form
  if (template) flattenNodes(body.definition.nodes).forEach(node => {
    const cfg = node.data.config
    if (cfg.kind === 'approval') cfg.rules = [{
      id: crypto.randomUUID(),
      source: 'initiator',
      values: [],
      scope: 'self',
      includeChildren: false
    }]
    if ('form' in cfg && cfg.form.kind === 'demo' && form) cfg.form = form
    if (cfg.kind === 'subflow') cfg.flowId = ''
  })
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
    revision: undefined,
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
  user_id: string;
  status: string;
  decision?: string;
  comment?: string;
  decided_at?: string;
  position: number;
  wait_id: string
}

export interface ApprovalDetail extends ApprovalItem {
  canManage: boolean
  snapshot: Record<string, unknown>;
  variables: Record<string, unknown>;
  error: string
  tasks: ApprovalTask[];
  waits: Array<{ id: string; title: string; members: string[]; status: string; sign_mode: string }>
  logs: Array<{ id: string; title: string; kind: string; input: unknown; output: unknown }>
  children: ApprovalItem[];
  notificationDelivery: Array<{ messageId: string; state: string; attempts: number; error: string }>
  delivery: Array<{ messageId: string; state: string; attempts: number; error: string }>
}

export const approvalStatus: Record<string, string> = {
  SUBMITTING: '提交中',
  RUNNING: '审批中',
  APPROVED: '已通过',
  REJECTING: '正在拒绝',
  REJECTED: '已拒绝',
  TERMINATING: '正在终止',
  TERMINATED: '已终止',
  ERROR: '执行异常'
}

/** 审批已结束的状态集合 */
export const FINISHED_STATUS = ['APPROVED', 'REJECTED', 'TERMINATED']

export function listPersonalApprovals(view: 'pending' | 'handled' | 'initiated', appId?: string, search = '', page = 1) {
  const params = new URLSearchParams({view, search, page: String(page), size: '30'})
  if (appId) params.set('appId', appId)
  return requestJson<{
    list: ApprovalItem[];
    total: number
  }>(`/api/approvals/${view === 'initiated' ? 'instances' : 'tasks'}?${params}`)
}

export const getApprovalDetail = (appId: string, id: string) => requestJson<ApprovalDetail>(`/api/apps/${encodeURIComponent(appId)}/approval-instances/${encodeURIComponent(id)}`)
export const decideApproval = (appId: string, taskId: string, decision: 'approve' | 'reject', comment: string, requestKey: string) => requestJson(`/api/apps/${encodeURIComponent(appId)}/approval-tasks/${encodeURIComponent(taskId)}/decision`, {
  method: 'POST',
  body: JSON.stringify({decision, comment, requestKey})
})
export const manageApproval = (appId: string, id: string, action: 'retry' | 'terminate') => requestJson(`/api/apps/${encodeURIComponent(appId)}/approval-instances/${encodeURIComponent(id)}/${action}`, {method: 'POST'})
const recordPath = (appId: string, form: string, id: string) => `/api/apps/${encodeURIComponent(appId)}/forms/${encodeURIComponent(form)}/records/${encodeURIComponent(id)}/approvals`
export const retryApprovalNotifications = (appId: string, id: string) => requestJson(`/api/apps/${encodeURIComponent(appId)}/approval-instances/${encodeURIComponent(id)}/retry-notifications`, {method: 'POST'})
export const recordApprovals = (appId: string, form: string, id: string) => requestJson<ApprovalItem[]>(recordPath(appId, form, id))
export const submitApproval = (appId: string, form: string, id: string, flowId: string, requestKey: string) => requestJson<{
  id: string
}>(recordPath(appId, form, id), {method: 'POST', body: JSON.stringify({flowId, requestKey})})

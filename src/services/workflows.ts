import type {ApprovalItem} from './approvals'
import type {ApprovalFlow, ApprovalMember, FlowTrigger, MemberDirectory, ValidationIssue} from '../types/workflow'
import {cloneNode, emptyDocument} from '../lib/workflow'
import {requestJson} from './http'
import {cachedFetch, createAppDataCache} from './appDataCache'
import {decodeApprovalFlow, encodeApprovalFlow, type ApprovalFlowRecord} from './workflow-model'
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

/** 工作流成员目录的 id → 姓名映射（会话内缓存），供列表直接展示发起人姓名 */
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

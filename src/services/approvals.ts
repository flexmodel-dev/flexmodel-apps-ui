import {requestJson} from './http'

const base = (appId: string) => `/api/apps/${encodeURIComponent(appId)}/flows`

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


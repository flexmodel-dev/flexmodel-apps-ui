import {requestJson} from './http'
import type {ApprovalDetail} from './approvals'

export interface AppNotification {
  id: string;
  category: 'approval' | 'workflow' | 'discussion';
  title: string;
  content: string
  appId: string;
  appName: string;
  instanceId?: string;
  taskId?: string
  discussionId?: string
  formName?: string
  recordId?: string
  occurredAt: string;
  receivedAt: string;
  readAt: string | null
  canNavigate?: boolean;
  approval?: ApprovalDetail
}

export interface NotificationSummary {
  version: string;
  unread: number;
  byCategory: Record<string, number>
  apps: Array<{ appId: string; name: string; unread: number }>
}

export interface NotificationEvent {
  version: string;
  unread?: number;
  notification?: AppNotification;
  notificationId?: string;
  replay?: boolean
}

export interface NotificationFilter {
  status?: string;
  category?: string;
  appId?: string;
  page?: number;
  size?: number
}

export function listNotifications(filter: NotificationFilter = {}) {
  const params = new URLSearchParams()
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return requestJson<{ list: AppNotification[]; total: number }>(`/api/notifications?${params}`)
}

export const notificationSummary = () => requestJson<NotificationSummary>('/api/notifications/summary')
export const notificationDetail = (id: string) => requestJson<AppNotification>(`/api/notifications/${encodeURIComponent(id)}`)
export const readNotification = (id: string) => requestJson(`/api/notifications/${encodeURIComponent(id)}/read`, {method: 'PUT'})
export const readAllNotifications = (filter: {
  appId?: string;
  category?: string
}) => requestJson('/api/notifications/read-all', {method: 'POST', body: JSON.stringify(filter)})

export {SseDecoder} from './notificationSse'

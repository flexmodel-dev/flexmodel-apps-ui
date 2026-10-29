import {requestJson} from './http'

export interface RecordDiscussionItem {
  id: string
  parentId: string | null
  replyToName?: string | null
  content: string
  authorId: string
  authorName: string
  createdAt: string
  canDelete: boolean
  replyCount: number
  replies: RecordDiscussionItem[]
}

export interface RecordDiscussionPage {
  list: RecordDiscussionItem[]
  total: number
  rootTotal: number
}

export interface CreateRecordDiscussionInput {
  content: string
  parentId?: string | null
  replyToId?: string | null
  mentionedUserIds?: string[]
}

const discussionsPath = (appId: string, formName: string, recordId: string) =>
  `/api/apps/${encodeURIComponent(appId)}/forms/${encodeURIComponent(formName)}/records/${encodeURIComponent(recordId)}/discussions`

export function listRecordDiscussions(appId: string, formName: string, recordId: string, page = 1, size = 20) {
  const params = new URLSearchParams({page: String(page), size: String(size)})
  return requestJson<RecordDiscussionPage>(`${discussionsPath(appId, formName, recordId)}?${params}`)
}

export function createRecordDiscussion(appId: string, formName: string, recordId: string, input: CreateRecordDiscussionInput) {
  return requestJson<RecordDiscussionItem>(discussionsPath(appId, formName, recordId), {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteRecordDiscussion(appId: string, formName: string, recordId: string, discussionId: string) {
  return requestJson<void>(`${discussionsPath(appId, formName, recordId)}/${encodeURIComponent(discussionId)}`, {
    method: 'DELETE',
  })
}

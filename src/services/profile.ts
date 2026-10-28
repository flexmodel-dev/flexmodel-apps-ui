import {getAuthSession} from '@/services/auth'
import {normalizePage, requestJson} from '@/services/http'
import {uploadStorageObject} from '@/services/attachments'

export interface UserDepartmentRelation {
  departmentId: string
  departmentName: string
  isMain: boolean
  jobTitle?: string | null
}

export interface UserProfile {
  id: string
  name: string
  email: string
  phone: string
  avatar: string | null
  departments: UserDepartmentRelation[]
}

export interface LoginLogEntry {
  id: string
  time: string
  ip: string
  agent: string
  success: boolean
  message: string
}

interface UserRecord {
  id?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  avatar?: string | null
  departments?: UserDepartmentRelation[] | null
}

interface LoginLogRecord {
  id?: string | null
  ip?: string | null
  agent?: string | null
  success?: boolean
  message?: string | null
  createdAt?: string | null
}

const USER_FORM = 'f_user'

function requireUserId() {
  const userId = getAuthSession()?.user.id
  if (!userId) throw new Error('登录已失效，请重新登录')
  return userId
}

function profilePath(userId: string) {
  return `/api/system/forms/${USER_FORM}/records/${encodeURIComponent(userId)}`
}

function normalizeProfile(record: UserRecord): UserProfile {
  return {
    id: record.id ?? '',
    name: record.name ?? '',
    email: record.email ?? '',
    phone: record.phone ?? '',
    avatar: record.avatar?.trim() || null,
    departments: Array.isArray(record.departments) ? record.departments : [],
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export async function getCurrentProfile(): Promise<UserProfile> {
  const userId = requireUserId()
  return normalizeProfile(await requestJson<UserRecord>(profilePath(userId)))
}

export interface UpdateProfileInput {
  name: string
  phone: string
  avatar: string | null
}

export async function updateCurrentProfile(input: UpdateProfileInput): Promise<UserProfile> {
  const userId = requireUserId()
  return normalizeProfile(await requestJson<UserRecord>(profilePath(userId), {
    method: 'PUT',
    body: JSON.stringify(input),
  }))
}

export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  const filename = `${crypto.randomUUID()}_${file.name.replace(/[\\/\u0000-\u001f\u007f]/g, '_')}`
  const uploaded = await uploadStorageObject('default', `avatars/${userId}/${filename}`, file)
  return uploaded.url
}

export async function getLoginLogs(page = 1, size = 20): Promise<LoginLogEntry[]> {
  const result = normalizePage(await requestJson<{ list?: LoginLogRecord[]; total?: number }>(
    `/api/auth/login-logs?page=${page}&size=${size}`,
  ))
  return result.list.map((log) => ({
    id: log.id ?? '',
    time: formatDateTime(log.createdAt),
    ip: log.ip || '-',
    agent: log.agent || '-',
    success: log.success !== false,
    message: log.message ?? '',
  }))
}

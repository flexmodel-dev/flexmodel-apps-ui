import {clearAppDataCache} from '@/services/appDataCache'

export interface AuthUser {
  id: string
  name: string
  email: string
}

export interface AuthSession {
  token: string
  expiresIn: number
  user: AuthUser
  permissions: string[]
}

interface LoginResponse {
  token: string
  expiresIn?: number
  user?: AuthUser
  permissions?: string[]
  message?: string
}

const tokenStorageKey = 'flexmodel-apps.auth.token'
const userStorageKey = 'flexmodel-apps.auth.user'
const permissionsStorageKey = 'flexmodel-apps.auth.permissions'
const expiresInStorageKey = 'flexmodel-apps.auth.expires-in'

function getStorage(remember: boolean) {
  return remember ? window.localStorage : window.sessionStorage
}

function readStoredValue(storage: Storage, key: string) {
  return storage.getItem(key)
}

export function getAuthSession(): AuthSession | null {
  const token = readStoredValue(window.localStorage, tokenStorageKey) ?? readStoredValue(window.sessionStorage, tokenStorageKey)
  const userValue = readStoredValue(window.localStorage, userStorageKey) ?? readStoredValue(window.sessionStorage, userStorageKey)
  if (!token || !userValue) return null

  try {
    const user = JSON.parse(userValue) as AuthUser
    if (!user.id || !user.name) return null
    const permissionsValue =
      readStoredValue(window.localStorage, permissionsStorageKey) ??
      readStoredValue(window.sessionStorage, permissionsStorageKey)
    const expiresInValue =
      readStoredValue(window.localStorage, expiresInStorageKey) ??
      readStoredValue(window.sessionStorage, expiresInStorageKey)
    return {
      token,
      expiresIn: expiresInValue ? Number(expiresInValue) : 0,
      user,
      permissions: permissionsValue ? JSON.parse(permissionsValue) as string[] : [],
    }
  } catch {
    clearAuthSession()
    return null
  }
}

export function getAuthToken() {
  return getAuthSession()?.token ?? null
}

export function saveAuthSession(session: AuthSession, remember: boolean) {
  clearAppDataCache()
  const storage = getStorage(remember)
  const oppositeStorage = remember ? window.sessionStorage : window.localStorage
  ;[tokenStorageKey, userStorageKey, permissionsStorageKey, expiresInStorageKey].forEach((key) => {
    oppositeStorage.removeItem(key)
  })

  storage.setItem(tokenStorageKey, session.token)
  storage.setItem(userStorageKey, JSON.stringify(session.user))
  storage.setItem(permissionsStorageKey, JSON.stringify(session.permissions))
  storage.setItem(expiresInStorageKey, String(session.expiresIn))
}

export function clearAuthSession() {
  clearAppDataCache()
  ;[window.localStorage, window.sessionStorage].forEach((storage) => {
    ;[tokenStorageKey, userStorageKey, permissionsStorageKey, expiresInStorageKey].forEach((key) => {
      storage.removeItem(key)
    })
  })
}

export async function login(username: string, password: string, remember: boolean): Promise<AuthSession> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'include',
    body: JSON.stringify({username, password}),
  })
  const payload = await response.json().catch(() => null) as LoginResponse | null

  if (!response.ok) {
    throw new Error(payload?.message ?? `登录失败（${response.status}）`)
  }
  if (!payload?.token || !payload.user?.id || !payload.user.name) {
    throw new Error('登录响应缺少用户信息')
  }

  const session: AuthSession = {
    token: payload.token,
    expiresIn: payload.expiresIn ?? 0,
    user: {
      id: payload.user.id,
      name: payload.user.name,
      email: payload.user.email ?? '',
    },
    permissions: payload.permissions ?? [],
  }
  saveAuthSession(session, remember)
  return session
}

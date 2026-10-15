import {requestJson} from '@/services/http'

export type UserStatus = 'ACTIVE' | 'DISABLED' | 'INVITED'

export interface AdminDepartment {
  id: string
  name: string
  parentId: string | null
  directUserCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminDepartmentInput {
  name: string
  parentId: string | null
}

export interface AdminUserDepartment {
  departmentId: string
  departmentName: string
  isMain: boolean
  jobTitle: string
}

export interface AdminUserDepartmentInput {
  departmentId: string
  isMain: boolean
  jobTitle: string
}

export interface AdminRole {
  id: string
  name: string
  description: string
  resources: Array<{ id: number; name: string; permission: string }>
  createdAt: string
  updatedAt: string
}

export interface AdminRoleInput {
  name: string
  description: string
  resourceIds: string[]
}

export interface AdminResource {
  id: number
  name: string
  permission: string
  type: string
  parentId: number | null
}

export interface AdminUser {
  id: string
  name: string
  email: string
  status: UserStatus
  managerUserId: string | null
  managerName: string | null
  roles: Array<{ id: string; name: string }>
  departments: AdminUserDepartment[]
  createdAt: string
  updatedAt: string
}

export interface AdminUserInput {
  name: string
  email: string
  password?: string
  status: UserStatus
  managerUserId: string | null
  roleIds: string[]
  departments: AdminUserDepartmentInput[]
}

const DEPARTMENT_API = '/api/departments'
const USER_API = '/api/users'
const ROLE_API = '/api/roles'
const RESOURCE_API = '/api/resources'

export async function getDepartments(): Promise<AdminDepartment[]> {
  return requestJson<AdminDepartment[]>(DEPARTMENT_API)
}

export async function createDepartment(input: AdminDepartmentInput): Promise<AdminDepartment> {
  return requestJson<AdminDepartment>(DEPARTMENT_API, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateDepartment(
  departmentId: string,
  input: AdminDepartmentInput
): Promise<AdminDepartment> {
  return requestJson<AdminDepartment>(`${DEPARTMENT_API}/${departmentId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteDepartment(departmentId: string): Promise<void> {
  await requestJson<null>(`${DEPARTMENT_API}/${departmentId}`, {method: 'DELETE'})
}

export async function getUsers(): Promise<AdminUser[]> {
  return requestJson<AdminUser[]>(USER_API)
}

export async function createUser(input: AdminUserInput): Promise<AdminUser> {
  return requestJson<AdminUser>(USER_API, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateUser(userId: string, input: AdminUserInput): Promise<AdminUser> {
  return requestJson<AdminUser>(`${USER_API}/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteUser(userId: string): Promise<void> {
  await requestJson<null>(`${USER_API}/${userId}`, {method: 'DELETE'})
}

export async function getRoles(): Promise<AdminRole[]> {
  return requestJson<AdminRole[]>(ROLE_API)
}

export async function createRole(input: AdminRoleInput): Promise<AdminRole> {
  return requestJson<AdminRole>(ROLE_API, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateRole(roleId: string, input: AdminRoleInput): Promise<AdminRole> {
  return requestJson<AdminRole>(`${ROLE_API}/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteRole(roleId: string): Promise<void> {
  await requestJson<null>(`${ROLE_API}/${roleId}`, {method: 'DELETE'})
}

export async function getResources(): Promise<AdminResource[]> {
  return requestJson<AdminResource[]>(RESOURCE_API)
}

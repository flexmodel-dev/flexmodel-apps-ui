import {requestJson} from './http'
import type {DirectorySelection, DirectoryEntityType} from '@/types/directory'

export type ScopeType = DirectoryEntityType | 'SELF' | 'DIRECT_REPORTS' | 'ALL_REPORTS' | 'ALL'
export interface MemberSelection { type: ScopeType; ids?: string[]; includeChildren?: boolean }
export interface PermissionCondition {field?: string; operator?: string; value?: unknown; logic?: 'AND' | 'OR'; children?: PermissionCondition[]}
export interface FormPermissionControl {
  formName: string
  readAll: boolean
  writeAll: boolean
  allowDelete: boolean
  fieldControls: Record<string, {read: boolean; write: boolean}>
  condition: PermissionCondition | null
}
export interface DataAuthorization {
  id: string
  appId: string
  formName: string
  name: string
  enabled: boolean
  subjects: MemberSelection[]
  dataScope: MemberSelection[]
  controls: FormPermissionControl[]
}
export type DataAuthorizationInput = Omit<DataAuthorization, 'id' | 'appId' | 'formName'>
const base = (app: string, form: string) => `/api/apps/${encodeURIComponent(app)}/forms/${encodeURIComponent(form)}/authorizations`
export const listDataAuthorizations = (app: string, form: string) => requestJson<DataAuthorization[]>(base(app, form))
export const saveDataAuthorization = (app: string, form: string, value: DataAuthorizationInput, id?: string) => requestJson<DataAuthorization>(`${base(app, form)}${id ? `/${encodeURIComponent(id)}` : ''}`, {method: id ? 'PUT' : 'POST', body: JSON.stringify(value)})
export const deleteDataAuthorization = (app: string, form: string, id: string) => requestJson<void>(`${base(app, form)}/${encodeURIComponent(id)}`, {method: 'DELETE'})

export function toDirectorySelections(groups: MemberSelection[]): DirectorySelection[] {
  return groups.flatMap(group => ['USER', 'ROLE', 'ORGANIZATION'].includes(group.type)
    ? (group.ids ?? []).map(id => ({type: group.type as DirectoryEntityType, id, ...(group.type === 'ORGANIZATION' ? {includeChildren: group.includeChildren ?? false} : {})})) : [])
}
export function fromDirectorySelections(items: DirectorySelection[]): MemberSelection[] {
  const groups = new Map<string, MemberSelection>()
  for (const item of items) {
    const key = `${item.type}:${item.type === 'ORGANIZATION' && !!item.includeChildren}`
    const group = groups.get(key) ?? {type: item.type, ids: [], ...(item.type === 'ORGANIZATION' ? {includeChildren: !!item.includeChildren} : {})}
    if (!group.ids!.includes(item.id)) group.ids!.push(item.id)
    groups.set(key, group)
  }
  return [...groups.values()]
}
export const emptyControl = (formName: string): FormPermissionControl => ({formName, readAll: false, writeAll: false, allowDelete: false, fieldControls: {}, condition: null})

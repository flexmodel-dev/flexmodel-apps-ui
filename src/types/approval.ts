import type {FlowDocumentJSON} from '@flowgram.ai/fixed-layout-editor'

export type NodeKind =
  | 'start'
  | 'end'
  | 'notification'
  | 'approval'
  | 'gateway'
  | 'branch'
  | 'create'
  | 'update'
  | 'query'
  | 'delete'
  | 'subflow'
export type FormRef = { kind: 'app' | 'demo'; name: string }

export interface ApprovalField {
  name: string
  label: string
  type: string
}

export interface ApprovalForm {
  ref: FormRef
  label: string
  fields: ApprovalField[]
}

export type ValueBinding = {
  kind: 'literal' | 'variable'
  value: string
  valueType?: 'text' | 'number' | 'boolean'
}

export interface Condition {
  id: string
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'
  value: ValueBinding
}

export interface Assignment {
  id: string
  field: string
  value: ValueBinding
}

export type MemberSource =
  | 'users'
  | 'roles'
  | 'organizations'
  | 'initiator'
  | 'node'
  | 'variable'
export type MemberScope = 'self' | 'directReports' | 'allReports' | 'manager'

export interface AssigneeRule {
  id: string
  source: MemberSource
  values: string[]
  scope: MemberScope
  includeChildren: boolean
}

export type SignMode = 'all' | 'any' | 'sequential'
export type ApprovalConfig =
  | { kind: 'start' | 'end' | 'gateway' }
  | { kind: 'approval'; rules: AssigneeRule[]; signMode: SignMode }
  | { kind: 'notification'; rules: AssigneeRule[]; titleTemplate: string; contentTemplate: string }
  | {
  kind: 'branch'
  fallback: boolean
  match: 'all' | 'any'
  conditions: Condition[]
}
  | {
  kind: 'create' | 'update' | 'query' | 'delete'
  form: FormRef
  match: 'all' | 'any'
  conditions: Condition[]
  assignments: Assignment[]
  output: string
  queryMode: 'one' | 'many'
}
  | {
  kind: 'subflow'
  flowId: string
  inputs: Assignment[]
  outputs: Assignment[]
}

export interface ApprovalNode {
  id: string
  type: NodeKind
  data: { title: string; config: ApprovalConfig }
  blocks?: ApprovalNode[]
}

export interface ApprovalDocument extends FlowDocumentJSON {
  nodes: ApprovalNode[]
}

export interface ApprovalFlow {
  flowKey?: string
  revision?: number
  id: string
  appId: string
  name: string
  description: string
  form: FormRef
  status: 'draft' | 'enabled' | 'disabled'
  updatedAt: string
  definition: ApprovalDocument
}

export interface ApprovalMember {
  roleIds?: string[]
  organizationIds?: string[]
  id: string
  name: string
  role: string
  organization: string
  managerId?: string
}

export interface ApprovalOrganization {
  id: string
  name: string
  parentId?: string
}

export interface MemberDirectory {
  roles?: Array<{ id: string; name: string }>
  members: ApprovalMember[]
  organizations: ApprovalOrganization[]
}

export interface ResolveContext {
  initiatorId: string
  variables: Record<string, unknown>
  nodeMembers: Record<string, string[]>
}

export interface ValidationIssue {
  nodeId: string
  message: string
}

export interface SimulationEvent {
  id: string
  nodeId: string
  title: string
  type: NodeKind
  status: 'completed' | 'waiting' | 'rejected' | 'failed'
  depth: number
  detail: string
  input?: unknown
  output?: unknown
  members?: string[]
  decisions?: Record<string, 'approve' | 'reject'>
}

export type RecordStore = Record<string, Array<Record<string, unknown>>>

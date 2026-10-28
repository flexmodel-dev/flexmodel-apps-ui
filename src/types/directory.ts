export type DirectoryEntityType = 'USER' | 'ROLE' | 'ORGANIZATION'

export interface DirectorySelection {
  type: DirectoryEntityType
  id: string
  includeChildren?: boolean
}

export interface DirectoryMember {
  id: string
  name: string
  avatar?: string | null
  role?: string
  organization?: string
  roleIds?: string[]
  organizationIds?: string[]
  managerId?: string
  status?: string
}

export interface Directory {
  members: DirectoryMember[]
  roles?: Array<{id: string; name: string}>
  organizations: Array<{id: string; name: string; parentId?: string}>
}

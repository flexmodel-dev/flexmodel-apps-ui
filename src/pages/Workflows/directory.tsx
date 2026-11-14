import * as React from 'react'
import type {MemberDirectory} from '@/types/workflow'

export const ApprovalDirectoryContext = React.createContext<MemberDirectory>({
  members: [],
  organizations: [],
  roles: []
})
export const useDirectory = () => React.useContext(ApprovalDirectoryContext)

import {AdminLayout} from '@/components/layout/AdminLayout'
import {FormManagementContent} from './AdminContent'
import ApprovalList from '@/pages/Workflows/WorkflowList'

export {AdminUsers} from './AdminUsers'
export {AdminRoles} from './AdminRoles'

/** 表单管理（卡片网格） */
export function AdminForms({embedded = false, appId}: { embedded?: boolean; appId?: string } = {}) {
  const content = <FormManagementContent appId={appId}/>
  return embedded ? content : <AdminLayout>{content}</AdminLayout>
}

/** 工作流列表 */
export function AdminApprovals({embedded = false, appId}: { embedded?: boolean; appId?: string } = {}) {
  const content = <ApprovalList appId={appId}/>
  return embedded ? content : <AdminLayout>{content}</AdminLayout>
}

import * as React from 'react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {AdminTablePage} from './AdminTablePage'
import {FormManagementContent} from './AdminContent'
import {Button} from '@/components/ui/button'
import {CirclePlus} from 'lucide-react'

export {AdminUsers} from './AdminUsers'
export {AdminRoles} from './AdminRoles'

/** 表单管理（卡片网格） */
export function AdminForms({embedded = false, appId}: { embedded?: boolean; appId?: string } = {}) {
  const content = <FormManagementContent appId={appId}/>
  return embedded ? content : <AdminLayout>{content}</AdminLayout>
}

/** 审批流程列表 */
export function AdminApprovals({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <AdminTablePage
      title="审批流程"
      desc="表单审批流程配置"
      bare={embedded}
      rows={[
        {id: 'approval', name: '审批流程', state: '启用'},
      ]}
      columns={[
        {key: 'name', label: '流程名称'},
        {key: 'state', label: '状态'},
      ]}
      toolbar={<Button><CirclePlus className="h-4 w-4" /> 新建流程</Button>}
    />
  )
}

/** 触发器列表 */
export function AdminTriggers({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <AdminTablePage
      title="触发器"
      desc="数据自动化处理规则"
      bare={embedded}
      rows={[
        {id: 'trigger', name: '触发器', state: '启用'},
      ]}
      columns={[
        {key: 'name', label: '触发器名称'},
        {key: 'state', label: '状态'},
      ]}
      toolbar={<Button><CirclePlus className="h-4 w-4" /> 新建触发器</Button>}
    />
  )
}

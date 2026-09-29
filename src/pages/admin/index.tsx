import {AdminLayout} from '@/components/layout/AdminLayout'
import { AdminTablePage } from './AdminTablePage'
import { EntityManagementContent } from './AdminContent'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { entities, users, departments, teams } from '@/data/mock'
import { cn } from '@/lib/utils'
import { CirclePlus } from 'lucide-react'

/** 实体管理（admin/metadata/entities.html：卡片网格） */
export function AdminEntities({ embedded = false }: { embedded?: boolean } = {}) {
  const content = <EntityManagementContent entities={entities} />
  return embedded ? content : <AdminLayout>{content}</AdminLayout>
}

/** 部门用户（admin/bizuser/user-list.html） */
export function AdminUsers() {
  return (
    <AdminTablePage
      title="部门用户"
      desc="管理组织架构与用户账号"
      rows={users}
      columns={[
        { key: 'fullName', label: '姓名', render: (u) => (
          <span className="flex items-center gap-2">
            <UserAvatar name={u.fullName} size={24} />
            <span className="font-medium">{u.fullName}</span>
          </span>
        ) },
        { key: 'name', label: '用户名', render: (u) => <span className="text-primary">{u.name}</span> },
        { key: 'dept', label: '部门' },
        { key: 'role', label: '角色' },
        { key: 'email', label: '邮箱', render: (u) => <span className="text-primary">{u.email}</span> },
        { key: 'active', label: '状态', render: (u) => (
          <span className={u.active ? 'text-green-600' : 'text-muted-foreground'}>{u.active ? '● 启用' : '○ 停用'}</span>
        ) },
      ]}
      rowActions={() => (
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" className="!h-8 !px-3">编辑</Button>
          <Button variant="secondary" size="sm" className="!h-8 !px-3">分配角色</Button>
        </div>
      )}
      toolbar={<Button><CirclePlus className="h-4 w-4" /> 新建用户</Button>}
    />
  )
}

/** 角色权限（admin/bizuser/role-privileges.html） */
export function AdminRoles() {
  return (
    <AdminTablePage
      title="角色权限"
      desc="角色与权限配置"
      rows={[
        { id: 'r1', name: '管理员', users: 1, desc: '拥有系统全部权限', modifiedOn: '2026-08-20 10:00' },
        { id: 'r2', name: '销售经理', users: 1, desc: '客户/商机管理，审批权限', modifiedOn: '2026-08-12 15:22' },
        { id: 'r3', name: '销售专员', users: 1, desc: '客户/商机只读+新增', modifiedOn: '2026-07-30 09:10' },
        { id: 'r4', name: '财务', users: 1, desc: '报销/合同审批', modifiedOn: '2026-07-01 11:45' },
      ]}
      columns={[
        { key: 'name', label: '角色名称', render: (r) => <span className="font-medium text-primary">{r.name}</span> },
        { key: 'desc', label: '说明' },
        { key: 'users', label: '用户数', render: (r) => <span className="badge-primary">{r.users}</span> },
        { key: 'modifiedOn', label: '修改时间' },
      ]}
      rowActions={() => <Button variant="secondary" size="sm" className="!h-8 !px-3">配置权限</Button>}
      toolbar={<Button><CirclePlus className="h-4 w-4" /> 新建角色</Button>}
    />
  )
}

/** 团队（admin/bizuser/team-list.html） */
export function AdminTeams() {
  return (
    <AdminTablePage
      title="团队"
      desc="跨部门协作团队"
      rows={teams.map((t) => ({ id: t.id, name: t.name, members: t.members, modifiedOn: '2026-08-25 14:00' }))}
      columns={[
        { key: 'name', label: '团队名称', render: (t) => <span className="font-medium text-primary">{t.name}</span> },
        { key: 'members', label: '成员数', render: (t) => <span className="badge-primary">{t.members}</span> },
        { key: 'modifiedOn', label: '修改时间' },
      ]}
      rowActions={() => <Button variant="secondary" size="sm" className="!h-8 !px-3">查看成员</Button>}
      toolbar={<Button><CirclePlus className="h-4 w-4" /> 新建团队</Button>}
    />
  )
}

/** 审批流程列表（admin/robot/approval-list.html） */
export function AdminApprovals({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <AdminTablePage
      title="审批流程"
      desc="业务对象审批流程配置"
      bare={embedded}
      rows={[
        { id: 'a1', name: '报销审批流程', entity: '报销单', applies: '全部', state: '启用', modifiedOn: '2026-08-30 16:40' },
        { id: 'a2', name: '请假审批流程', entity: '请假单', applies: '全部', state: '启用', modifiedOn: '2026-08-30 16:42' },
        { id: 'a3', name: '报价审批流程', entity: '报价单', applies: '金额 > 5 万', state: '启用', modifiedOn: '2026-09-01 10:15' },
        { id: 'a4', name: '合同评审流程', entity: '合同', applies: '全部', state: '停用', modifiedOn: '2026-09-03 09:00' },
      ]}
      columns={[
        { key: 'name', label: '流程名称', render: (r) => <span className="font-medium text-primary">{r.name}</span> },
        { key: 'entity', label: '应用实体', render: (r) => <span className="badge-secondary">{r.entity}</span> },
        { key: 'applies', label: '生效条件' },
        { key: 'state', label: '状态', render: (r) => (
          <span className={r.state === '启用' ? 'text-green-600' : 'text-muted-foreground'}>● {r.state}</span>
        ) },
        { key: 'modifiedOn', label: '修改时间' },
      ]}
      rowActions={() => <Button variant="secondary" size="sm" className="!h-8 !px-3">设计流程</Button>}
      toolbar={<Button><CirclePlus className="h-4 w-4" /> 新建流程</Button>}
    />
  )
}

/** 触发器（admin/robot/trigger-list.html） */
export function AdminTriggers({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <AdminTablePage
      title="触发器"
      desc="数据自动化处理规则"
      bare={embedded}
      rows={[
        { id: 't1', name: '新客户自动分配', entity: '客户', when: '新建时', action: '数据分配', state: '启用', modifiedOn: '2026-08-18 11:20' },
        { id: 't2', name: '赢单发送通知', entity: '商机', when: '字段更新', action: '发送通知', state: '启用', modifiedOn: '2026-08-22 09:35' },
        { id: 't3', name: '过期商机提醒', entity: '商机', when: '定时任务', action: '发送通知', state: '停用', modifiedOn: '2026-09-02 17:10' },
      ]}
      columns={[
        { key: 'name', label: '触发器名称', render: (r) => <span className="font-medium text-primary">{r.name}</span> },
        { key: 'entity', label: '应用实体', render: (r) => <span className="badge-secondary">{r.entity}</span> },
        { key: 'when', label: '触发时机' },
        { key: 'action', label: '执行动作' },
        { key: 'state', label: '状态', render: (r) => (
          <span className={r.state === '启用' ? 'text-green-600' : 'text-muted-foreground'}>● {r.state}</span>
        ) },
        { key: 'modifiedOn', label: '修改时间' },
      ]}
      rowActions={() => <Button variant="secondary" size="sm" className="!h-8 !px-3">编辑</Button>}
      toolbar={<Button><CirclePlus className="h-4 w-4" /> 新建触发器</Button>}
    />
  )
}

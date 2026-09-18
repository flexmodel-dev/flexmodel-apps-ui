import * as React from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AdminTablePage } from './AdminTablePage'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { entities, users, departments, teams, projects, loginLogs, recycleBin } from '@/data/mock'
import { cn } from '@/lib/utils'
import { CirclePlus } from 'lucide-react'

/** 通用配置 */
export function AdminSystems() {
  return (
    <AppLayout admin adminActive="/admin/systems">
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="border-b px-4 py-3">
          <h4 className="m-0 text-base font-medium">通用配置</h4>
          <p className="mb-0 mt-0.5 text-xs text-muted-foreground">系统级通用参数设置</p>
        </div>
        <div className="p-4">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: '系统名称', value: 'newbuild 管理系统', key: 'AppName' },
              { label: '默认语言', value: '中文', key: 'Language' },
              { label: '每页显示条数', value: '20', key: 'PageSize' },
              { label: '会话超时 (分钟)', value: '120', key: 'SessionTimeout' },
            ].map((cfg) => (
              <div key={cfg.key} className="flex items-center justify-between rounded-md border px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{cfg.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{cfg.value}</div>
                </div>
                <Button variant="secondary" size="sm">修改</Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

/** 实体管理（admin/metadata/entities.html：卡片网格） */
export function AdminEntities() {
  return (
    <AppLayout admin adminActive="/admin/entities">
      <div className="row -mx-2.5" id="entityList">
        <div className="new-entity mb-5 w-full px-2.5">
          <h3 className="mb-4 text-base font-normal text-muted-foreground">业务对象</h3>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4 xl:grid-cols-6">
            {entities.map((e) => (
              <Link key={e.name} to={`/app/${e.name}/list`} className="block rounded-md border bg-card transition-colors hover:bg-accent">
                <div className="card-body p-3">
                  <div className="float-left w-[30px] text-center">
                    <e.icon className="h-7 w-7 text-primary" />
                  </div>
                  <div className="ml-7">
                    <span className="block truncate text-sm font-medium">{e.label}</span>
                    <p className="mb-0 mt-0.5 truncate text-xs text-muted-foreground">{e.description}</p>
                  </div>
                </div>
                <div className="badge-wrap absolute right-[11px] top-[13px]">
                  <span className="badge-secondary">{e.badge}</span>
                </div>
              </Link>
            ))}
            <a className="block cursor-pointer rounded-md border border-dashed border-input transition-colors hover:border-primary">
              <div className="card-body p-3 pt-1 text-center">
                <CirclePlus className="h-6 w-6 text-primary" />
                <span className="mt-1 block text-xs text-muted-foreground">新建实体</span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

/** 部门用户（admin/bizuser/user-list.html） */
export function AdminUsers() {
  return (
    <AdminTablePage
      title="部门用户"
      desc="管理组织架构与用户账号"
      adminActive="/admin/bizuser/users"
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
      adminActive="/admin/bizuser/role-privileges"
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
      adminActive="/admin/bizuser/teams"
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
export function AdminApprovals() {
  return (
    <AdminTablePage
      title="审批流程"
      desc="业务对象审批流程配置"
      adminActive="/admin/robot/approvals"
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
export function AdminTriggers() {
  return (
    <AdminTablePage
      title="触发器"
      desc="数据自动化处理规则"
      adminActive="/admin/robot/triggers"
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

/** 项目管理（admin/project/project-list.html） */
export function AdminProjects() {
  return (
    <AdminTablePage
      title="项目"
      desc="项目管理配置"
      adminActive="/admin/projects"
      rows={projects.map((p) => ({ id: p.id, name: p.name, code: p.code, scope: p.scope === 1 ? '公开' : '成员可见', status: p.status === 1 ? '进行中' : '已归档', progress: `${p.progress}%` }))}
      columns={[
        { key: 'name', label: '项目名称', render: (p) => <span className="font-medium text-primary">{p.name}</span> },
        { key: 'code', label: '项目编号' },
        { key: 'scope', label: '可见范围' },
        { key: 'status', label: '状态', render: (p) => (
          <span className={p.status === '进行中' ? 'text-green-600' : 'text-muted-foreground'}>● {p.status}</span>
        ) },
        { key: 'progress', label: '完成度' },
      ]}
      rowActions={() => <Button variant="secondary" size="sm" className="!h-8 !px-3">配置</Button>}
      toolbar={<Button><CirclePlus className="h-4 w-4" /> 新建项目</Button>}
    />
  )
}

/** 登录日志（admin/audit/login-logs.html） */
export function AdminLoginLogs() {
  return (
    <AdminTablePage
      title="登录日志"
      desc="系统登录审计记录"
      adminActive="/admin/audit/login-logs"
      rows={loginLogs}
      columns={[
        { key: 'user', label: '用户', render: (r) => (
          <span className="flex items-center gap-1.5">
            <UserAvatar name={r.user} size={20} />
            <span className="text-primary">{r.user}</span>
          </span>
        ) },
        { key: 'ip', label: 'IP 地址' },
        { key: 'agent', label: '浏览器' },
        { key: 'time', label: '登录时间' },
        { key: 'status', label: '状态', render: (r) => (
          <span className={r.status === '成功' ? 'text-green-600' : 'text-red-500'}>{r.status}</span>
        ) },
      ]}
    />
  )
}

/** 回收站（admin/audit/recycle-bin.html） */
export function AdminRecycleBin() {
  return (
    <AdminTablePage
      title="回收站"
      desc="已删除记录可在 30 天内恢复"
      adminActive="/admin/audit/recycle-bin"
      rows={recycleBin}
      columns={[
        { key: 'entityLabel', label: '实体', render: (r) => <span className="badge-secondary">{r.entityLabel}</span> },
        { key: 'recordName', label: '记录', render: (r) => <span className="text-primary">{r.recordName}</span> },
        { key: 'deletedBy', label: '删除人' },
        { key: 'deletedOn', label: '删除时间' },
      ]}
      rowActions={() => (
        <div className="flex gap-1.5">
          <Button size="sm" className="!h-8 !px-3">恢复</Button>
          <Button variant="secondary" size="sm" className="!h-8 !px-3">彻底删除</Button>
        </div>
      )}
    />
  )
}

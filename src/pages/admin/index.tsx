import * as React from 'react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import { AdminTablePage } from './AdminTablePage'
import {FormManagementContent} from './AdminContent'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import {Empty} from '@/components/ui/empty'
import {Pagination} from '@/components/biz/Pagination'
import {businessObjects, users, departments, type Department} from '@/data/mock'
import {cn, paginate} from '@/lib/utils'
import {Building2, ChevronRight, CirclePlus, Search, Users, X} from 'lucide-react'

/** 表单管理（卡片网格） */
export function AdminForms({embedded = false, appId}: { embedded?: boolean; appId?: string } = {}) {
  const content = <FormManagementContent appId={appId}/>
  return embedded ? content : <AdminLayout>{content}</AdminLayout>
}

/** 部门用户（admin/bizuser/user-list.html） */
export function AdminUsers() {
  const [selectedDepartment, setSelectedDepartment] = React.useState<string | null>(null)
  const [expandedDepartments, setExpandedDepartments] = React.useState<string[]>(['总部'])
  const [query, setQuery] = React.useState('')
  const [page, setPage] = React.useState(1)
  const pageSize = 30

  const departmentTree = React.useMemo(() => buildDepartmentTree(null), [])
  const departmentUsers = React.useMemo(
    () => (selectedDepartment ? users.filter((user) => user.dept === selectedDepartment) : users),
    [selectedDepartment],
  )
  const filteredUsers = React.useMemo(
    () =>
      departmentUsers.filter((user) =>
        [user.name, user.fullName, user.email, user.dept, user.role].some((value) =>
          value.toLowerCase().includes(query.trim().toLowerCase()),
        ),
      ),
    [departmentUsers, query],
  )
  const {rows: pageUsers, pages, total} = paginate(filteredUsers, page, pageSize)

  const selectDepartment = (department: string | null) => {
    setSelectedDepartment(department)
    setPage(1)
  }

  const toggleDepartment = (department: string) => {
    setExpandedDepartments((current) =>
      current.includes(department)
        ? current.filter((item) => item !== department)
        : [...current, department],
    )
  }

  const tableColumns = [
    {
      key: 'fullName',
      label: '姓名',
      render: (user: (typeof users)[number]) => (
        <span className="flex items-center gap-2">
          <UserAvatar name={user.fullName} size={24}/>
          <span className="font-medium">{user.fullName}</span>
        </span>
      ),
    },
    {
      key: 'name',
      label: '用户名',
      render: (user: (typeof users)[number]) => <span className="text-primary">{user.name}</span>,
    },
    {key: 'dept', label: '部门'},
    {key: 'role', label: '角色'},
    {key: 'email', label: '邮箱'},
    {
      key: 'active',
      label: '状态',
      render: (user: (typeof users)[number]) => (
        <span className={user.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
          {user.active ? '● 启用' : '○ 停用'}
        </span>
      ),
    },
  ]

  return (
    <AdminLayout noPadding noOuterScroll contentClassName="h-[calc(100%-1rem)] min-h-0 md:h-[calc(100%-1.5rem)]">
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        <aside
          className="flex max-h-52 shrink-0 flex-col border-b bg-card lg:max-h-none lg:w-[280px] lg:border-b-0 lg:border-r">
          <div className="border-b px-4 py-4">
            <h1 className="m-0 text-base font-semibold">组织架构</h1>
            <p className="mb-0 mt-1 text-xs text-muted-foreground">选择部门查看对应用户</p>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => selectDepartment(null)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                selectedDepartment === null
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Users className="h-4 w-4 shrink-0"/>
              <span className="min-w-0 flex-1 truncate">全部用户</span>
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                {users.length}
              </span>
            </button>
            <div className="mt-1 space-y-1">
              {departmentTree.map((department) => (
                <DepartmentTreeNode
                  key={department.id}
                  department={department}
                  depth={0}
                  selectedDepartment={selectedDepartment}
                  expandedDepartments={expandedDepartments}
                  onSelect={selectDepartment}
                  onToggle={toggleDepartment}
                />
              ))}
            </div>
          </nav>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/30">
          <div
            className="flex flex-col gap-3 border-b bg-card px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="m-0 truncate text-base font-semibold">{selectedDepartment ?? '全部用户'}</h2>
              <p className="mb-0 mt-0.5 text-xs text-muted-foreground">共 {total} 位用户</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 w-full md:w-64">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                <input
                  className="h-9 w-full rounded-full border border-input bg-background pl-9 pr-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
                  placeholder="搜索用户"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPage(1)
                  }}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setPage(1)
                    }}
                    className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="清空搜索"
                  >
                    <X className="h-3.5 w-3.5"/>
                  </button>
                )}
              </div>
              <Button>
                <CirclePlus className="h-4 w-4"/> 新建用户
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            <table className="app-table w-full min-w-[760px]">
              <thead>
              <tr>
                {tableColumns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th className="w-[150px]">操作</th>
              </tr>
              </thead>
              <tbody>
              {pageUsers.map((user) => (
                <tr key={user.id}>
                  {tableColumns.map((column) => (
                    <td key={column.key}>
                      {column.render ? column.render(user) : String(user[column.key as keyof typeof user] ?? '-')}
                    </td>
                  ))}
                  <td>
                    <div className="flex gap-1.5">
                      <Button variant="secondary" size="sm" className="!h-8 !px-3">编辑</Button>
                      <Button variant="secondary" size="sm" className="!h-8 !px-3">分配角色</Button>
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
            {pageUsers.length === 0 && <Empty/>}
          </div>

          <div className="shrink-0 border-t bg-card px-4 py-3">
            <Pagination page={page} pages={pages} total={total} size={pageSize} onChange={setPage}/>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}

type DepartmentNode = Department & { children: DepartmentNode[] }

function buildDepartmentTree(parent: string | null): DepartmentNode[] {
  return departments
    .filter((department) => department.parent === parent)
    .map((department) => ({
      ...department,
      children: buildDepartmentTree(department.name),
    }))
}

function DepartmentTreeNode({
                              department,
                              depth,
                              selectedDepartment,
                              expandedDepartments,
                              onSelect,
                              onToggle,
                            }: {
  department: DepartmentNode
  depth: number
  selectedDepartment: string | null
  expandedDepartments: string[]
  onSelect: (department: string) => void
  onToggle: (department: string) => void
}) {
  const expanded = expandedDepartments.includes(department.name)
  const userCount = users.filter((user) => user.dept === department.name).length

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(department.name)}
        style={{paddingLeft: 12 + depth * 20}}
        className={cn(
          'flex w-full items-center gap-2 rounded-md py-2 pr-3 text-left text-sm transition-colors',
          selectedDepartment === department.name
            ? 'bg-primary/10 font-medium text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center transition-transform',
            department.children.length > 0 ? 'text-muted-foreground' : 'opacity-0',
            expanded && 'rotate-90',
          )}
          onClick={(event) => {
            if (department.children.length === 0) return
            event.stopPropagation()
            onToggle(department.name)
          }}
        >
          <ChevronRight className="h-4 w-4"/>
        </span>
        <Building2 className="h-4 w-4 shrink-0"/>
        <span className="min-w-0 flex-1 truncate">{department.name}</span>
        <span
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
          {userCount}
        </span>
      </button>
      {expanded && (
        <div className="space-y-1">
          {department.children.map((child) => (
            <DepartmentTreeNode
              key={child.id}
              department={child}
              depth={depth + 1}
              selectedDepartment={selectedDepartment}
              expandedDepartments={expandedDepartments}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
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

/** 审批流程列表（admin/robot/approval-list.html） */
export function AdminApprovals({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <AdminTablePage
      title="审批流程"
      desc="表单审批流程配置"
      bare={embedded}
      rows={[
        {
          id: 'a1',
          name: '报销审批流程',
          businessObject: '报销单',
          applies: '全部',
          state: '启用',
          modifiedOn: '2026-08-30 16:40'
        },
        {
          id: 'a2',
          name: '请假审批流程',
          businessObject: '请假单',
          applies: '全部',
          state: '启用',
          modifiedOn: '2026-08-30 16:42'
        },
        {
          id: 'a3',
          name: '报价审批流程',
          businessObject: '报价单',
          applies: '金额 > 5 万',
          state: '启用',
          modifiedOn: '2026-09-01 10:15'
        },
        {
          id: 'a4',
          name: '合同评审流程',
          businessObject: '合同',
          applies: '全部',
          state: '停用',
          modifiedOn: '2026-09-03 09:00'
        },
      ]}
      columns={[
        { key: 'name', label: '流程名称', render: (r) => <span className="font-medium text-primary">{r.name}</span> },
        {
          key: 'businessObject',
          label: '表单',
          render: (r) => <span className="badge-secondary">{r.businessObject}</span>
        },
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
        {
          id: 't1',
          name: '新客户自动分配',
          businessObject: '客户',
          when: '新建时',
          action: '数据分配',
          state: '启用',
          modifiedOn: '2026-08-18 11:20'
        },
        {
          id: 't2',
          name: '赢单发送通知',
          businessObject: '商机',
          when: '字段更新',
          action: '发送通知',
          state: '启用',
          modifiedOn: '2026-08-22 09:35'
        },
        {
          id: 't3',
          name: '过期商机提醒',
          businessObject: '商机',
          when: '定时任务',
          action: '发送通知',
          state: '停用',
          modifiedOn: '2026-09-02 17:10'
        },
      ]}
      columns={[
        { key: 'name', label: '触发器名称', render: (r) => <span className="font-medium text-primary">{r.name}</span> },
        {
          key: 'businessObject',
          label: '表单',
          render: (r) => <span className="badge-secondary">{r.businessObject}</span>
        },
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

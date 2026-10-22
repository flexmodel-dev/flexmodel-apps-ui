import * as React from 'react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Empty} from '@/components/ui/empty'
import {Pagination} from '@/components/biz/Pagination'
import {UserAvatar} from '@/components/ui/avatar'
import {BizDialog, ConfirmDialog} from '@/components/ui/dialog'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from '@/components/ui/dropdown-menu'
import {message} from '@/components/ui/message'
import {SystemRecordFormModal} from '@/components/biz/SystemRecordFormModal'
import {SearchInput} from '@/components/biz/SearchInput'
import {cn, toErrorMessage} from '@/lib/utils'
import {Building2, ChevronRight, CirclePlus, MoreVertical, Pencil, Power, Trash2, Users} from 'lucide-react'
import {
  createSystemRecord,
  deleteSystemRecord,
  getSystemForm,
  getSystemOptions,
  getSystemRecords,
  updateSystemRecord,
  type SystemForm,
  type SystemOption,
  type SystemRecord,
} from '@/services/systemForms'

interface TreeNode extends SystemOption {
  children: TreeNode[]
  direct_user_count?: number
}

interface UserDepartmentRelation {
  departmentId: string
  departmentName?: string
  isMain: boolean
  jobTitle: string
}

const statusText: Record<string, string> = {
  ACTIVE: '启用',
  DISABLED: '停用',
  INVITED: '待激活',
}

function departmentTree(departments: SystemOption[], parentId: string | null): TreeNode[] {
  return departments
    .filter(department => (department.parent_id ?? null) === parentId)
    .map(department => ({
      ...department,
      children: departmentTree(departments, department.id),
    }))
}


function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

const USER_PAGE_SIZE = 30

export function AdminUsers() {
  const [departments, setDepartments] = React.useState<SystemOption[]>([])
  const [users, setUsers] = React.useState<SystemRecord[]>([])
  const [userOptions, setUserOptions] = React.useState<SystemRecord[]>([])
  const [roles, setRoles] = React.useState<SystemOption[]>([])
  const [userFormDefinition, setUserFormDefinition] = React.useState<SystemForm | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [usersLoading, setUsersLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [selected, setSelected] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<string[]>([])
  const [query, setQuery] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [refreshKey, setRefreshKey] = React.useState(0)

  const [deptOpen, setDeptOpen] = React.useState(false)
  const [editingDept, setEditingDept] = React.useState<SystemOption | null>(null)
  const [deptForm, setDeptForm] = React.useState<Record<string, unknown>>({})
  const [deptError, setDeptError] = React.useState('')
  const [savingDept, setSavingDept] = React.useState(false)
  const [deletingDept, setDeletingDept] = React.useState<SystemOption | null>(null)
  const hasExpandedDepartmentsRef = React.useRef(false)

  const [userOpen, setUserOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<SystemRecord | null>(null)
  const [savingUser, setSavingUser] = React.useState(false)
  const [deletingUser, setDeletingUser] = React.useState<SystemRecord | null>(null)

  const loadBase = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [departmentOptions, roleOptions, userOptionList, formDefinition] = await Promise.all([
        getSystemOptions('departments'),
        getSystemOptions('roles'),
        getSystemOptions('users'),
        getSystemForm('f_user'),
      ])
      setDepartments(departmentOptions)
      setRoles(roleOptions)
      setUserOptions(userOptionList.map(user => ({id: user.id, name: user.name})))
      setUserFormDefinition(formDefinition)
    } catch (caught) {
      setError(toErrorMessage(caught, '加载失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshUsers = React.useCallback(() => {
    setRefreshKey(current => current + 1)
  }, [])

  React.useEffect(() => {
    void loadBase()
  }, [loadBase])

  React.useEffect(() => {
    if (hasExpandedDepartmentsRef.current || departments.length === 0) return
    hasExpandedDepartmentsRef.current = true
    setExpanded(departments.map(department => department.id))
  }, [departments])

  React.useEffect(() => {
    let cancelled = false
    setUsersLoading(true)
    getSystemRecords('f_user', {
      page,
      size: USER_PAGE_SIZE,
      search: query,
      departmentId: selected ?? undefined,
      includeDescendants: true,
    })
      .then(userPage => {
        if (cancelled) return
        setUsers(userPage.list)
        setTotal(userPage.total)
      })
      .catch(caught => {
        if (cancelled) return
        setError(toErrorMessage(caught, '加载用户失败'))
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, query, selected, refreshKey])

  const load = React.useCallback(() => {
    void loadBase()
    refreshUsers()
  }, [loadBase, refreshUsers])

  const nodes = React.useMemo(() => departmentTree(departments, null), [departments])
  const rows = users
  const pages = Math.max(1, Math.ceil(total / USER_PAGE_SIZE))
  const columns = (userFormDefinition?.listColumns ?? []).filter(column => !column.hidden)

  const openDept = (department?: SystemOption, parentId: string | null = null) => {
    setEditingDept(department ?? null)
    setDeptForm(department
      ? {name: department.name ?? '', parent_id: department.parent_id ?? null}
      : {name: '', parent_id: parentId})
    setDeptError('')
    setDeptOpen(true)
  }

  const saveDept = async () => {
    if (!text(deptForm.name).trim()) return setDeptError('请输入部门名称')
    setSavingDept(true)
    setDeptError('')
    try {
      if (editingDept) await updateSystemRecord('f_department', editingDept.id, deptForm)
      else await createSystemRecord('f_department', deptForm)
      setDeptOpen(false)
      load()
    } catch (caught) {
      setDeptError(toErrorMessage(caught, '保存失败'))
    } finally {
      setSavingDept(false)
    }
  }

  const removeDept = async () => {
    if (!deletingDept) return
    setSavingDept(true)
    try {
      await deleteSystemRecord('f_department', deletingDept.id)
      if (selected === deletingDept.id) setSelected(null)
      setDeletingDept(null)
      load()
    } catch (caught) {
      setDeptError(toErrorMessage(caught, '删除失败'))
    } finally {
      setSavingDept(false)
    }
  }

  const openUser = (user?: SystemRecord) => {
    setEditingUser(user ?? null)
    setUserOpen(true)
  }

  const removeUser = async () => {
    if (!deletingUser) return
    setSavingUser(true)
    try {
      await deleteSystemRecord('f_user', deletingUser.id)
      setDeletingUser(null)
      load()
    } catch (caught) {
      message.error(toErrorMessage(caught, '删除失败'))
    } finally {
      setSavingUser(false)
    }
  }

  const toggleUserStatus = async (user: SystemRecord) => {
    const nextStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    setSavingUser(true)
    setError('')
    try {
      await updateSystemRecord('f_user', user.id, {status: nextStatus})
      load()
    } catch (caught) {
      message.error(toErrorMessage(caught, '操作失败'))
    } finally {
      setSavingUser(false)
    }
  }


  const renderCell = (user: SystemRecord, columnName: string) => {
    switch (columnName) {
      case 'name':
        return (
          <span className="flex items-center gap-2">
            <UserAvatar name={text(user.name)} size={24}/>
            <b>{text(user.name)}</b>
          </span>
        )
      case 'email':
        return <span className="text-muted-foreground">{text(user.email) || '-'}</span>
      case 'departments':
        return (
          <span className="text-xs">
            {(Array.isArray(user.departments) ? user.departments as UserDepartmentRelation[] : [])
              .map(relation => `${relation.departmentName ?? ''}${relation.isMain ? '（主）' : ''}${relation.jobTitle ? ` · ${relation.jobTitle}` : ''}`)
              .filter(Boolean).join('；') || '-'}
          </span>
        )
      case 'manager_user_id':
        return <span className="text-muted-foreground">{text(user.manager_name) || '-'}</span>
      case 'roles':
        return (
          <span className="text-muted-foreground">
            {(Array.isArray(user.roles) ? user.roles as Array<{ name?: string }> : [])
              .map(role => text(role.name)).join('、') || '-'}
          </span>
        )
      case 'status':
        return (
          <span className={cn(
            user.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
          )}>● {statusText[text(user.status)] ?? text(user.status)}</span>
        )
      default:
        return <span className="text-muted-foreground">{text(user[columnName]) || '-'}</span>
    }
  }

  return (
    <AdminLayout noPadding noOuterScroll contentClassName="h-[calc(100%-1rem)] min-h-0 md:h-[calc(100%-1.5rem)]">
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        <aside
          className="flex max-h-56 shrink-0 flex-col border-b bg-card lg:max-h-none lg:w-[260px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b px-3 py-3">
            <div>
              <h1 className="m-0 text-sm font-semibold">部门架构</h1>
              <p className="mb-0 mt-0.5 text-[11px] text-muted-foreground">按部门及子部门筛选</p>
            </div>
            <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => openDept()}>
              <CirclePlus className="h-4 w-4"/>
            </Button>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => {
                setSelected(null)
                setPage(1)
              }}
              className={cn(
                'flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[13px]',
                selected === null
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              <Users className="h-3.5 w-3.5"/><span className="flex-1">全部用户</span>
              <span className="rounded-full bg-muted px-1 text-[11px]">{userOptions.length}</span>
            </button>
            <div className="mt-1 space-y-0.5">
              {nodes.map(node => (
                <DeptNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selected={selected}
                  expanded={expanded}
                  onSelect={id => {
                    setSelected(id)
                    setPage(1)
                  }}
                  onToggle={id => setExpanded(current =>
                    current.includes(id) ? current.filter(item => item !== id) : [...current, id])}
                  onAdd={department => openDept(undefined, department.id)}
                  onEdit={openDept}
                  onDelete={setDeletingDept}
                />
              ))}
            </div>
          </nav>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-3">
            <div>
              <h1 className="m-0 text-xl font-semibold">{userFormDefinition?.page?.title ?? '组织用户'}</h1>
              <p className="mb-0 mt-1 text-sm text-muted-foreground">
                {userFormDefinition?.page?.description ?? '维护用户基础信息、任职与角色'}
              </p>
            </div>
            <SearchInput
              className="ml-auto sm:max-w-[320px]"
              value={query}
              onChange={event => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="搜索用户或邮箱"
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={load} disabled={loading}>
                {loading ? '刷新中…' : '刷新'}
              </Button>
              <Button onClick={() => openUser()} disabled={!userFormDefinition}>
                <CirclePlus className="h-4 w-4"/>新建用户
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {(loading || usersLoading) ? (
              <div className="rounded-lg border p-8 text-sm text-muted-foreground">正在加载…</div>
            ) : error ? (
              <div className="rounded-lg border p-8 text-sm text-destructive">{error}</div>
            ) : rows.length === 0 ? (
              <Empty description="暂无用户"/>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-background">
                <table className="w-full border-collapse text-sm">
                  <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    {columns.map(column => (
                      <th key={column.name} className="px-4 py-3">{column.label}</th>
                    ))}
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                  </thead>
                  <tbody>
                  {rows.map(user => (
                    <tr key={user.id} className="border-b transition-colors hover:bg-accent/40">
                      {columns.map(column => (
                        <td key={column.name} className="px-4 py-3">{renderCell(user, column.name)}</td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => toggleUserStatus(user)}
                            disabled={savingUser}
                          >
                            <Power className="h-3.5 w-3.5"/>
                            {user.status === 'ACTIVE' ? '停用' : '启用'}
                          </Button>
                          <Button variant="secondary" size="xs" onClick={() => openUser(user)}>
                            <Pencil className="h-3.5 w-3.5"/>编辑
                          </Button>
                          <Button variant="secondary" size="xs" onClick={() => setDeletingUser(user)}>
                            <Trash2 className="h-3.5 w-3.5"/>删除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="border-t bg-card px-4 py-3">
            <Pagination page={page} pages={pages} total={total} size={USER_PAGE_SIZE} onChange={setPage}/>
          </div>
        </section>
      </div>

      <BizDialog
        open={deptOpen}
        onOpenChange={setDeptOpen}
        title={editingDept ? '编辑部门' : '新建部门'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDeptOpen(false)}>取消</Button>
            <Button onClick={saveDept} disabled={savingDept}>{savingDept ? '保存中…' : '保存'}</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Input
            value={text(deptForm.name)}
            onChange={event => setDeptForm({...deptForm, name: event.target.value})}
            placeholder="部门名称"
          />
          {deptError ? <div className="text-sm text-destructive">{deptError}</div> : null}
        </div>
      </BizDialog>

      <ConfirmDialog
        open={Boolean(deletingDept)}
        onOpenChange={open => !open && setDeletingDept(null)}
        title="删除部门"
        message={`确认删除“${deletingDept?.name}”吗？存在子部门或成员时无法删除。`}
        busy={savingDept}
        confirmText="删除"
        onConfirm={removeDept}
      />

      <SystemRecordFormModal
        open={userOpen}
        onOpenChange={setUserOpen}
        formName="f_user"
        recordId={editingUser?.id ?? null}
        departments={departments}
        roles={roles}
        users={userOptions}
        onSaved={() => {
          setUserOpen(false)
          void load()
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingUser)}
        onOpenChange={open => !open && setDeletingUser(null)}
        title="删除用户"
        message={`确认删除“${text(deletingUser?.name)}”吗？用户角色和部门关系会同时删除。`}
        busy={savingUser}
        confirmText="删除"
        onConfirm={removeUser}
      />
    </AdminLayout>
  )
}

function DeptNode({
                    node,
                    depth,
                    selected,
                    expanded,
                    onSelect,
                    onToggle,
                    onAdd,
                    onEdit,
                    onDelete,
                  }: {
  node: TreeNode
  depth: number
  selected: string | null
  expanded: string[]
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onAdd: (department: SystemOption) => void
  onEdit: (department: SystemOption) => void
  onDelete: (department: SystemOption) => void
}) {
  const open = expanded.includes(node.id)
  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md py-1.5 pr-1.5 text-[13px]',
          selected === node.id ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent',
        )}
        style={{paddingLeft: 10 + depth * 14}}
      >
        <button
          type="button"
          className={cn('h-3.5 w-3.5', node.children.length ? '' : 'opacity-0', open ? 'rotate-90' : '')}
          onClick={() => onToggle(node.id)}
        >
          <ChevronRight className="h-3.5 w-3.5"/>
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-left"
          onClick={() => onSelect(node.id)}
        >
          <Building2 className="h-3.5 w-3.5"/>
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
        </button>
        {node.direct_user_count ? (
          <span className="rounded-full bg-muted px-1 text-[11px]">{node.direct_user_count}</span>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              aria-label={`${node.name}更多操作`}
            >
              <MoreVertical className="h-3.5 w-3.5"/>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onAdd(node)}>
              <CirclePlus className="h-4 w-4"/>新增部门
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(node)}>
              <Pencil className="h-4 w-4"/>编辑部门
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onSelect={() => onDelete(node)}>
              <Trash2 className="h-4 w-4"/>删除部门
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && (
        <div className="space-y-0.5">
          {node.children.map(child => (
            <DeptNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

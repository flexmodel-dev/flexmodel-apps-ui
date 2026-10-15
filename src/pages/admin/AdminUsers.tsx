import * as React from 'react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Empty} from '@/components/ui/empty'
import {Pagination} from '@/components/biz/Pagination'
import {UserAvatar} from '@/components/ui/avatar'
import {BizDialog} from '@/components/ui/dialog'
import {Checkbox} from '@/components/ui/checkbox'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from '@/components/ui/dropdown-menu'
import {cn, paginate} from '@/lib/utils'
import {Building2, ChevronRight, CirclePlus, MoreVertical, Pencil, Search, Trash2, Users} from 'lucide-react'
import {
  createDepartment, createUser, deleteDepartment, deleteUser, getDepartments, getRoles, getUsers,
  updateDepartment, updateUser, type AdminDepartment, type AdminRole, type AdminUser,
  type AdminUserDepartmentInput, type UserStatus,
} from '@/services/adminUsers'

type TreeNode = AdminDepartment & { children: TreeNode[] }

interface DeptForm {
  name: string;
  parentId: string | null
}

interface UserForm {
  name: string;
  email: string;
  password: string;
  status: UserStatus
  managerUserId: string | null
  roleIds: string[];
  departments: AdminUserDepartmentInput[]
}

const emptyDept: DeptForm = {name: '', parentId: null}
const emptyUser: UserForm = {
  name: '',
  email: '',
  password: '',
  status: 'ACTIVE',
  managerUserId: null,
  roleIds: [],
  departments: []
}
const statusText: Record<UserStatus, string> = {ACTIVE: '启用', DISABLED: '停用', INVITED: '待激活'}

function tree(departments: AdminDepartment[], parentId: string | null): TreeNode[] {
  return departments.filter(d => d.parentId === parentId).map(d => ({...d, children: tree(departments, d.id)}))
}

function descendants(departments: AdminDepartment[], id: string): string[] {
  return [id, ...departments.filter(d => d.parentId === id).flatMap(d => descendants(departments, d.id))]
}

export function AdminUsers() {
  const [departments, setDepartments] = React.useState<AdminDepartment[]>([])
  const [users, setUsers] = React.useState<AdminUser[]>([])
  const [roles, setRoles] = React.useState<AdminRole[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [selected, setSelected] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<string[]>([])
  const [query, setQuery] = React.useState('')
  const [page, setPage] = React.useState(1)

  const [deptOpen, setDeptOpen] = React.useState(false)
  const [editingDept, setEditingDept] = React.useState<AdminDepartment | null>(null)
  const [deptForm, setDeptForm] = React.useState<DeptForm>(emptyDept)
  const [deptError, setDeptError] = React.useState('')
  const [savingDept, setSavingDept] = React.useState(false)
  const [deletingDept, setDeletingDept] = React.useState<AdminDepartment | null>(null)
  const hasExpandedDepartmentsRef = React.useRef(false)

  const [userOpen, setUserOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<AdminUser | null>(null)
  const [userForm, setUserForm] = React.useState<UserForm>(emptyUser)
  const [userError, setUserError] = React.useState('')
  const [savingUser, setSavingUser] = React.useState(false)
  const [deletingUser, setDeletingUser] = React.useState<AdminUser | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('')
    try {
      const [d, u, r] = await Promise.all([getDepartments(), getUsers(), getRoles()])
      setDepartments(d);
      setUsers(u);
      setRoles(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])
  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    if (hasExpandedDepartmentsRef.current || departments.length === 0) return
    hasExpandedDepartmentsRef.current = true
    setExpanded(departments.map(department => department.id))
  }, [departments])

  const nodes = React.useMemo(() => tree(departments, null), [departments])
  const visibleIds = React.useMemo(() => selected ? descendants(departments, selected) : [], [departments, selected])
  const filtered = React.useMemo(() => {
    const k = query.trim().toLowerCase()
    return users.filter(u => (!selected || u.departments.some(d => visibleIds.includes(d.departmentId)))
      && (!k || [u.name, u.email, ...u.roles.map(r => r.name)].some(v => v.toLowerCase().includes(k))))
  }, [users, selected, visibleIds, query])
  const {rows, pages, total} = paginate(filtered, page, 30)

  const openDept = (department?: AdminDepartment, parentId: string | null = null) => {
    setEditingDept(department ?? null)
    setDeptForm(department ? {name: department.name, parentId: department.parentId} : {name: '', parentId})
    setDeptError('');
    setDeptOpen(true)
  }
  const saveDept = async () => {
    if (!deptForm.name.trim()) return setDeptError('请输入部门名称')
    setSavingDept(true);
    setDeptError('')
    try {
      if (editingDept) await updateDepartment(editingDept.id, deptForm)
      else await createDepartment(deptForm)
      setDeptOpen(false);
      await load()
    } catch (e) {
      setDeptError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSavingDept(false)
    }
  }
  const removeDept = async () => {
    if (!deletingDept) return
    setSavingDept(true)
    try {
      await deleteDepartment(deletingDept.id)
      if (selected === deletingDept.id) setSelected(null)
      setDeletingDept(null);
      await load()
    } catch (e) {
      setDeptError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setSavingDept(false)
    }
  }

  const openUser = (user?: AdminUser) => {
    setEditingUser(user ?? null)
    setUserForm(user ? {
      name: user.name, email: user.email, password: '', status: user.status,
      managerUserId: user.managerUserId,
      roleIds: user.roles.map(r => r.id),
      departments: user.departments.map(d => ({
        departmentId: d.departmentId,
        isMain: d.isMain,
        jobTitle: d.jobTitle
      })),
    } : emptyUser)
    setUserError('');
    setUserOpen(true)
  }
  const saveUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) return setUserError('请输入用户名和邮箱')
    if (!editingUser && !userForm.password && userForm.status !== 'INVITED') return setUserError('启用用户必须设置密码')
    if (userForm.departments.length && userForm.departments.filter(d => d.isMain).length !== 1) return setUserError('必须且只能设置一个主部门')
    setSavingUser(true);
    setUserError('')
    try {
      if (editingUser) await updateUser(editingUser.id, userForm)
      else await createUser(userForm)
      setUserOpen(false);
      await load()
    } catch (e) {
      setUserError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSavingUser(false)
    }
  }
  const removeUser = async () => {
    if (!deletingUser) return
    setSavingUser(true)
    try {
      await deleteUser(deletingUser.id);
      setDeletingUser(null);
      await load()
    } catch (e) {
      setUserError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setSavingUser(false)
    }
  }

  const addDepartment = () => {
    const used = new Set(userForm.departments.map(d => d.departmentId))
    const next = departments.find(d => !used.has(d.id))
    if (next) setUserForm(f => ({
      ...f,
      departments: [...f.departments, {
        departmentId: next.id,
        isMain: f.departments.length === 0,
        jobTitle: ''
      }]
    }))
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
            <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => openDept()}><CirclePlus
              className="h-4 w-4"/></Button>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto p-1.5">
            <button type="button" onClick={() => {
              setSelected(null);
              setPage(1)
            }}
                    className={cn('flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[13px]', selected === null ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent')}>
              <Users className="h-3.5 w-3.5"/><span className="flex-1">全部用户</span>
              <span className="rounded-full bg-muted px-1 text-[11px]">{users.length}</span>
            </button>
            <div className="mt-1 space-y-0.5">
              {nodes.map(node => <DeptNode key={node.id} node={node} depth={0} selected={selected} expanded={expanded}
                                           onSelect={id => {
                                             setSelected(id);
                                             setPage(1)
                                           }}
                                           onToggle={id => setExpanded(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])}
                                           onAdd={department => openDept(undefined, department.id)} onEdit={openDept}
                                           onDelete={setDeletingDept}/>)}
            </div>
          </nav>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-3">
            <div className="relative min-w-0 flex-1 sm:max-w-[360px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
              <Input value={query} onChange={e => {
                setQuery(e.target.value);
                setPage(1)
              }} placeholder="搜索用户、邮箱或角色" className="pl-9"/>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={load} disabled={loading}>{loading ? '刷新中…' : '刷新'}</Button>
              <Button onClick={() => openUser()}><CirclePlus className="h-4 w-4"/>新建用户</Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {loading ? <div className="rounded-lg border p-8 text-sm text-muted-foreground">正在加载…</div>
              : error ? <div className="rounded-lg border p-8 text-sm text-destructive">{error}</div>
                : rows.length === 0 ? <Empty description="暂无用户"/>
                  : <div className="overflow-hidden rounded-lg border bg-background">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3">用户</th>
                        <th className="px-4 py-3">邮箱</th>
                        <th className="px-4 py-3">部门</th>
                        <th className="px-4 py-3">直属上级</th>
                        <th className="px-4 py-3">角色</th>
                        <th className="px-4 py-3">状态</th>
                        <th className="px-4 py-3 text-right">操作</th>
                      </tr>
                      </thead>
                      <tbody>{rows.map(user => (
                        <tr key={user.id} className="border-b hover:bg-accent/40">
                          <td className="px-4 py-3"><span className="flex items-center gap-2"><UserAvatar
                            name={user.name} size={24}/><b>{user.name}</b></span></td>
                          <td className="px-4 py-3 text-muted-foreground">{user.email || '-'}</td>
                          <td
                            className="px-4 py-3 text-xs">{user.departments.map(d => `${d.departmentName}${d.isMain ? '（主）' : ''}${d.jobTitle ? ` · ${d.jobTitle}` : ''}`).join('；') || '-'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{user.managerName || '-'}</td>
                          <td
                            className="px-4 py-3 text-muted-foreground">{user.roles.map(r => r.name).join('、') || '-'}</td>
                          <td
                            className={cn('px-4 py-3', user.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>● {statusText[user.status]}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              <Button variant="secondary" size="sm" className="!h-8 !px-3"
                                      onClick={() => openUser(user)}><Pencil className="h-3.5 w-3.5"/>编辑</Button>
                              <Button variant="secondary" size="sm" className="!h-8 !px-3"
                                      onClick={() => setDeletingUser(user)}><Trash2
                                className="h-3.5 w-3.5"/>删除</Button>
                            </div>
                          </td>
                        </tr>))}</tbody>
                    </table>
                  </div>}
          </div>
          <div className="border-t bg-card px-4 py-3"><Pagination page={page} pages={pages} total={total} size={30}
                                                                  onChange={setPage}/></div>
        </section>
      </div>

      <BizDialog open={deptOpen} onOpenChange={setDeptOpen} title={editingDept ? '编辑部门' : '新建部门'}
                 footer={<><Button variant="secondary" onClick={() => setDeptOpen(false)}>取消</Button><Button
                   onClick={saveDept} disabled={savingDept}>{savingDept ? '保存中…' : '保存'}</Button></>}>
        <div className="space-y-4">
          <Input value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})}
                 placeholder="部门名称"/>
          {deptError && <div className="text-sm text-destructive">{deptError}</div>}
        </div>
      </BizDialog>

      <BizDialog open={Boolean(deletingDept)} onOpenChange={o => !o && setDeletingDept(null)} title="删除部门"
                 footer={<><Button variant="secondary" onClick={() => setDeletingDept(null)}>取消</Button><Button
                   variant="danger" onClick={removeDept} disabled={savingDept}>删除</Button></>}>
        确认删除“{deletingDept?.name}”吗？存在子部门或成员时无法删除。
      </BizDialog>

      <BizDialog open={userOpen} onOpenChange={setUserOpen} title={editingUser ? '编辑用户' : '新建用户'} width={720}
                 height="70vh"
                 footer={<><Button variant="secondary" onClick={() => setUserOpen(false)}>取消</Button><Button
                   onClick={saveUser} disabled={savingUser}>{savingUser ? '保存中…' : '保存'}</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})}
                   placeholder="用户名"/>
            <Input value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})}
                   placeholder="邮箱"/>
            <Input type="password" value={userForm.password}
                   onChange={e => setUserForm({...userForm, password: e.target.value})}
                   placeholder={editingUser ? '密码（留空不修改）' : '密码'}/>
            <Select value={userForm.status} onValueChange={v => setUserForm({...userForm, status: v as UserStatus})}>
              <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(statusText).map(([v, l]) =>
              <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={userForm.managerUserId ?? 'none'}
                    onValueChange={v => setUserForm({...userForm, managerUserId: v === 'none' ? null : v})}>
              <SelectTrigger><SelectValue placeholder="直属上级"/></SelectTrigger>
              <SelectContent><SelectItem value="none">无直属上级</SelectItem>
                {users.filter(u => u.id !== editingUser?.id).map(u => <SelectItem key={u.id}
                                                                                  value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">角色</div>
            <div className="grid gap-2 sm:grid-cols-2">{roles.map(role => (
              <label key={role.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Checkbox checked={userForm.roleIds.includes(role.id)} onCheckedChange={v => setUserForm(f => ({
                  ...f,
                  roleIds: v === true ? [...f.roleIds, role.id] : f.roleIds.filter(id => id !== role.id)
                }))}/>
                {role.name}
              </label>))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium">任职</span>
              <Button variant="secondary" size="sm" className="!h-8 !px-3" onClick={addDepartment}><CirclePlus
                className="h-3.5 w-3.5"/>添加</Button></div>
            <div className="space-y-3">{userForm.departments.map((relation, index) => (
              <div key={index} className="grid gap-2 rounded-lg border p-3 lg:grid-cols-[1fr_.6fr_1fr_auto]">
                <Select value={relation.departmentId} onValueChange={v => setUserForm(f => ({
                  ...f,
                  departments: f.departments.map((d, i) => i === index ? {...d, departmentId: v} : d)
                }))}>
                  <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{departments.map(d => <SelectItem
                  key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
                <label className="flex items-center gap-2 rounded-md border px-3 text-sm">
                  <Checkbox checked={relation.isMain} onCheckedChange={v => setUserForm(f => ({
                    ...f,
                    departments: f.departments.map((d, i) => ({...d, isMain: i === index ? v === true : false}))
                  }))}/>主职
                </label>
                <Input value={relation.jobTitle} onChange={e => setUserForm(f => ({
                  ...f,
                  departments: f.departments.map((d, i) => i === index ? {...d, jobTitle: e.target.value} : d)
                }))} placeholder="职位"/>
                <Button variant="secondary" size="icon" className="h-10 w-10" onClick={() => setUserForm(f => ({
                  ...f,
                  departments: f.departments.filter((_, i) => i !== index)
                }))}><Trash2 className="h-4 w-4"/></Button>
              </div>))}
            </div>
          </div>
          {userError && <div className="text-sm text-destructive">{userError}</div>}
        </div>
      </BizDialog>

      <BizDialog open={Boolean(deletingUser)} onOpenChange={o => !o && setDeletingUser(null)} title="删除用户"
                 footer={<><Button variant="secondary" onClick={() => setDeletingUser(null)}>取消</Button><Button
                   variant="danger" onClick={removeUser} disabled={savingUser}>删除</Button></>}>
        确认删除“{deletingUser?.name}”吗？用户角色和部门关系会同时删除。
      </BizDialog>
    </AdminLayout>
  )
}

function DeptNode({node, depth, selected, expanded, onSelect, onToggle, onAdd, onEdit, onDelete}: {
  node: TreeNode; depth: number; selected: string | null; expanded: string[]
  onSelect: (id: string) => void; onToggle: (id: string) => void
  onAdd: (department: AdminDepartment) => void
  onEdit: (department: AdminDepartment) => void; onDelete: (department: AdminDepartment) => void
}) {
  const open = expanded.includes(node.id)
  return (
    <div>
      <div
        className={cn('flex items-center gap-1 rounded-md py-1.5 pr-1.5 text-[13px]', selected === node.id ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent')}
        style={{paddingLeft: 10 + depth * 14}}>
        <button type="button"
                className={cn('h-3.5 w-3.5', node.children.length ? '' : 'opacity-0', open ? 'rotate-90' : '')}
                onClick={() => onToggle(node.id)}><ChevronRight className="h-3.5 w-3.5"/></button>
        <button type="button" className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-left"
                onClick={() => onSelect(node.id)}>
          <Building2 className="h-3.5 w-3.5"/><span className="min-w-0 flex-1 truncate">{node.name}</span>
        </button>
        {node.directUserCount > 0 && (
          <span className="rounded-full bg-muted px-1 text-[11px]">{node.directUserCount}</span>
        )}
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
      {open &&
        <div className="space-y-0.5">{node.children.map(child => <DeptNode key={child.id} node={child} depth={depth + 1}
                                                                         selected={selected} expanded={expanded}
                                                                         onSelect={onSelect} onToggle={onToggle}
                                                                         onAdd={onAdd} onEdit={onEdit}
                                                                         onDelete={onDelete}/>)}</div>}
    </div>
  )
}

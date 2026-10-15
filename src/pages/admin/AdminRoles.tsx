import * as React from 'react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Empty} from '@/components/ui/empty'
import {BizDialog} from '@/components/ui/dialog'
import {Checkbox} from '@/components/ui/checkbox'
import {CirclePlus, Pencil, Trash2} from 'lucide-react'
import {
  createRole, deleteRole, getResources, getRoles, updateRole,
  type AdminResource, type AdminRole,
} from '@/services/adminUsers'

interface RoleForm {
  name: string
  description: string
  resourceIds: string[]
}

const emptyRole: RoleForm = {name: '', description: '', resourceIds: []}

export function AdminRoles() {
  const [roles, setRoles] = React.useState<AdminRole[]>([])
  const [resources, setResources] = React.useState<AdminResource[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingRole, setEditingRole] = React.useState<AdminRole | null>(null)
  const [form, setForm] = React.useState<RoleForm>(emptyRole)
  const [formError, setFormError] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [deletingRole, setDeletingRole] = React.useState<AdminRole | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('')
    try {
      const [roleResult, resourceResult] = await Promise.all([getRoles(), getResources()])
      setRoles(roleResult);
      setResources(resourceResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载角色失败')
    } finally {
      setLoading(false)
    }
  }, [])
  React.useEffect(() => {
    void load()
  }, [load])

  const openRole = (role?: AdminRole) => {
    setEditingRole(role ?? null)
    setForm(role ? {
      name: role.name,
      description: role.description,
      resourceIds: role.resources.map(resource => String(resource.id)),
    } : emptyRole)
    setFormError('');
    setFormOpen(true)
  }

  const saveRole = async () => {
    if (!form.name.trim()) return setFormError('请输入角色名称')
    setSaving(true);
    setFormError('')
    try {
      if (editingRole) await updateRole(editingRole.id, form)
      else await createRole(form)
      setFormOpen(false);
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存角色失败')
    } finally {
      setSaving(false)
    }
  }

  const removeRole = async () => {
    if (!deletingRole) return
    setSaving(true)
    try {
      await deleteRole(deletingRole.id)
      setDeletingRole(null);
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '删除角色失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="m-0 text-xl font-semibold">角色权限</h1>
            <p className="mb-0 mt-1 text-sm text-muted-foreground">维护角色及其可访问资源</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={load} disabled={loading}>{loading ? '刷新中…' : '刷新'}</Button>
            <Button onClick={() => openRole()}><CirclePlus className="h-4 w-4"/>新建角色</Button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border p-8 text-sm text-muted-foreground">正在加载角色…</div>
        ) : error ? (
          <div className="rounded-lg border p-8 text-sm text-destructive">{error}</div>
        ) : roles.length === 0 ? (
          <Empty description="暂无角色"/>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-background">
            <table className="w-full border-collapse text-sm">
              <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">角色名称</th>
                <th className="px-4 py-3">说明</th>
                <th className="px-4 py-3">权限资源</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
              </thead>
              <tbody>
              {roles.map(role => (
                <tr key={role.id} className="border-b transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3 font-medium text-primary">{role.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{role.description || '-'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {role.resources.map(resource => resource.name).join('、') || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="secondary" size="sm" className="!h-8 !px-3" onClick={() => openRole(role)}>
                        <Pencil className="h-3.5 w-3.5"/>编辑
                      </Button>
                      <Button variant="secondary" size="sm" className="!h-8 !px-3"
                              onClick={() => setDeletingRole(role)}>
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

      <BizDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingRole ? '编辑角色' : '新建角色'}
        width={680}
        height="70vh"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>取消</Button>
            <Button onClick={saveRole} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            value={form.name}
            onChange={event => setForm({...form, name: event.target.value})}
            placeholder="角色名称"
          />
          <Input
            value={form.description}
            onChange={event => setForm({...form, description: event.target.value})}
            placeholder="角色说明"
          />
          <div>
            <div className="mb-2 text-sm font-medium text-foreground">可访问资源</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {resources.map(resource => {
                const checked = form.resourceIds.includes(String(resource.id))
                return (
                  <label key={resource.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={value => setForm(current => ({
                        ...current,
                        resourceIds: value === true
                          ? [...current.resourceIds, String(resource.id)]
                          : current.resourceIds.filter(id => id !== String(resource.id)),
                      }))}
                    />
                    <span className="min-w-0 flex-1 truncate">{resource.name}</span>
                  </label>
                )
              })}
            </div>
          </div>
          {formError ? <div className="text-sm text-destructive">{formError}</div> : null}
        </div>
      </BizDialog>

      <BizDialog
        open={Boolean(deletingRole)}
        onOpenChange={open => !open && setDeletingRole(null)}
        title="删除角色"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingRole(null)} disabled={saving}>取消</Button>
            <Button variant="danger" onClick={removeRole} disabled={saving}>删除</Button>
          </>
        }
      >
        确认删除“{deletingRole?.name}”吗？用户与该角色的关联会同时删除。
        {formError ? <div className="mt-2 text-sm text-destructive">{formError}</div> : null}
      </BizDialog>
    </AdminLayout>
  )
}

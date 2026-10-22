import * as React from 'react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Empty} from '@/components/ui/empty'
import {BizDialog} from '@/components/ui/dialog'
import {SystemRecordFormModal} from '@/components/biz/SystemRecordFormModal'
import {CirclePlus, Pencil, Trash2} from 'lucide-react'
import {
  createSystemRecord,
  deleteSystemRecord,
  getSystemForm,
  getSystemRecords,
  updateSystemRecord,
  type SystemForm,
  type SystemPermissionResource,
  type SystemRecord,
} from '@/services/systemForms'
import {toErrorMessage} from '@/lib/utils'

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

export function AdminRoles() {
  const [roles, setRoles] = React.useState<SystemRecord[]>([])
  const [formDefinition, setFormDefinition] = React.useState<SystemForm | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingRole, setEditingRole] = React.useState<SystemRecord | null>(null)
  const [formError, setFormError] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [deletingRole, setDeletingRole] = React.useState<SystemRecord | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rolePage, definition] = await Promise.all([
        getSystemRecords('f_role', {page: 1, size: 200}),
        getSystemForm('f_role'),
      ])
      setRoles(rolePage.list)
      setFormDefinition(definition)
    } catch (caught) {
      setError(toErrorMessage(caught, '加载角色失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const openRole = (role?: SystemRecord) => {
    setEditingRole(role ?? null)
    setFormOpen(true)
  }

  const removeRole = async () => {
    if (!deletingRole) return
    setSaving(true)
    try {
      await deleteSystemRecord('f_role', deletingRole.id)
      setDeletingRole(null)
      await load()
    } catch (caught) {
      setFormError(toErrorMessage(caught, '删除角色失败'))
    } finally {
      setSaving(false)
    }
  }

  const renderCell = (role: SystemRecord, columnName: string) => {
    if (columnName === 'name') {
      return <span className="font-medium text-primary">{text(role.name)}</span>
    }
    if (columnName === 'resources') {
      return (
        <span className="text-xs text-muted-foreground">
          {(Array.isArray(role.resources) ? role.resources as Array<{ name?: string }> : [])
            .map(resource => text(resource.name)).join('、') || '-'}
        </span>
      )
    }
    return <span className="text-muted-foreground">{text(role[columnName]) || '-'}</span>
  }

  const columns = (formDefinition?.listColumns ?? []).filter(column => !column.hidden)

  return (
    <AdminLayout>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="m-0 text-xl font-semibold">{formDefinition?.page?.title ?? '角色权限'}</h1>
            <p className="mb-0 mt-1 text-sm text-muted-foreground">
              {formDefinition?.page?.description ?? '维护角色及其权限'}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading ? '刷新中…' : '刷新'}
            </Button>
            <Button onClick={() => openRole()} disabled={!formDefinition}>
              <CirclePlus className="h-4 w-4"/>新建角色
            </Button>
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
                {columns.map(column => (
                  <th key={column.name} className="px-4 py-3">{column.label}</th>
                ))}
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
              </thead>
              <tbody>
              {roles.map(role => (
                <tr key={role.id} className="border-b transition-colors hover:bg-accent/40">
                  {columns.map(column => (
                    <td key={column.name} className="px-4 py-3">{renderCell(role, column.name)}</td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="secondary" size="sm" className="!h-8 !px-3" onClick={() => openRole(role)}>
                        <Pencil className="h-3.5 w-3.5"/>编辑
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="!h-8 !px-3"
                        onClick={() => setDeletingRole(role)}
                      >
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

      <SystemRecordFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        formName="f_role"
        recordId={editingRole?.id ?? null}
        resources={formDefinition?.resources ?? []}
        onSaved={() => {
          setFormOpen(false)
          void load()
        }}
      />

      <BizDialog
        open={Boolean(deletingRole)}
        onOpenChange={open => !open && setDeletingRole(null)}
        title="删除角色"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDeletingRole(null)} disabled={saving}>取消</Button>
            <Button variant="danger" onClick={removeRole} disabled={saving}>删除</Button>
          </>
        )}
      >
        确认删除“{text(deletingRole?.name)}”吗？用户与该角色的关联会同时删除。
        {formError ? <div className="mt-2 text-sm text-destructive">{formError}</div> : null}
      </BizDialog>
    </AdminLayout>
  )
}

import * as React from 'react'
import {Pencil, Plus, RefreshCw, Search, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Empty} from '@/components/ui/empty'
import {AppRecordFormModal} from '@/components/biz/AppRecordFormModal'
import {getAppForm, type AppForm} from '@/services/appForms'
import {displayRecordText} from '@/lib/recordValue'
import {
  deleteAppRecord,
  getAppRecords,
  type AppRecord,
  type AppRecordPage,
} from '@/services/appRecords'


interface AppSubform {
  formName: string
  referenceField: string
}

export function AppSubformRecords({
                                    appId,
                                    mainFormName,
                                    mainRecordId,
                                    subform,
                                  }: {
  appId: string
  mainFormName: string
  mainRecordId: string
  subform: AppSubform
}) {
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [searchInput, setSearchInput] = React.useState('')
  const [records, setRecords] = React.useState<AppRecordPage>({list: [], total: 0})
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [recordId, setRecordId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const pageSize = 10

  const load = React.useCallback(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getAppRecords(appId, subform.formName, {
      page,
      size: pageSize,
      search: search.trim() || undefined,
      sortField: 'created_at',
      sortOrder: 'DESC',
    }, {
      mainFormName,
      mainRecordId,
      referenceField: subform.referenceField,
    })
      .then((result) => {
        if (!cancelled) setRecords(result)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : '加载子表单记录失败')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appId, mainFormName, mainRecordId, page, search, subform.formName, subform.referenceField])

  React.useEffect(() => {
    let cancelled = false
    getAppForm(appId, subform.formName)
      .then((loadedForm) => {
        if (!cancelled) setForm(loadedForm)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : '加载子表单失败')
      })
    return () => {
      cancelled = true
    }
  }, [appId, subform.formName])

  React.useEffect(() => load(), [load])

  const removeRecord = async (id: string) => {
    setDeletingId(id)
    setError(null)
    try {
      await deleteAppRecord(appId, subform.formName, id, {
        mainFormName,
        mainRecordId,
        referenceField: subform.referenceField,
      })
      load()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '删除子表单记录失败')
    } finally {
      setDeletingId(null)
    }
  }

  const columns = React.useMemo(() => {
    if (!form) return []
    const names = form.layout.items.length
      ? form.layout.items
        .filter((item) => item.type === 'FIELD' && Boolean(item.name) && item.name !== subform.referenceField)
        .map((item) => item.name!)
      : form.fields.filter((field) => !field.builtin && field.name !== subform.referenceField)
        .map((field) => field.name)
    const uniqueNames = Array.from(new Set(names))
    const displayFirst = form.displayField
      ? [form.displayField, ...uniqueNames.filter((name) => name !== form.displayField)]
      : uniqueNames
    return displayFirst.slice(0, 4)
  }, [form, subform.referenceField])

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 shrink-0 rounded-full bg-primary"/>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {form?.label ?? subform.formName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
            <Input
              className="h-9 w-48 pl-8"
              value={searchInput}
              placeholder="搜索子表记录"
              onChange={(event) => {
                setSearchInput(event.target.value)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                setPage(1)
                setSearch(searchInput.trim())
              }}
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            title="刷新"
            onClick={load}
          >
            <RefreshCw className="h-4 w-4"/>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setRecordId(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4"/> 新增
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="app-table w-full min-w-[640px]">
          <thead>
          <tr>
            {columns.map((name) => (
              <th key={name}>
                {form?.fields.find((field) => field.name === name)?.label ?? name}
              </th>
            ))}
            <th className="w-[120px]">操作</th>
          </tr>
          </thead>
          <tbody>
          {records.list.map((record) => (
            <tr key={String(record.id)}>
              {columns.map((name) => (
                <td key={name}>{displayRecordText(record[name])}</td>
              ))}
              <td>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="编辑"
                    onClick={() => {
                      setRecordId(String(record.id))
                      setFormOpen(true)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5"/>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="删除"
                    disabled={deletingId === String(record.id)}
                    onClick={() => removeRecord(String(record.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5"/>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>

      {!isLoading && records.list.length === 0 && (
        <Empty
          className="min-h-[160px] rounded-lg border border-dashed"
          description={
            <>
              <p className="m-0 font-medium text-foreground">暂无子表记录</p>
              <p className="mt-1">点击新增添加子表记录</p>
            </>
          }
        />
      )}

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>共 {records.total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
          >
            上一页
          </Button>
          <span>{page}</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page * pageSize >= records.total || isLoading}
            onClick={() => setPage((previous) => previous + 1)}
          >
            下一页
          </Button>
        </div>
      </div>

      {form && (
        <AppRecordFormModal
          open={formOpen}
          onOpenChange={setFormOpen}
          appId={appId}
          form={form}
          recordId={recordId}
          recordContext={{
            mainFormName,
            mainRecordId,
            referenceField: subform.referenceField,
          }}
          onSaved={() => {
            setFormOpen(false)
            load()
          }}
        />
      )}
    </section>
  )
}

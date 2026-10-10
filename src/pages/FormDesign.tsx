import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Columns2,
  LayoutDashboard,
  Columns3,
  GripVertical,
  Info,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  X,
  Activity,
  AlignLeft,
  Boxes,
  Calendar,
  CalendarClock,
  ChevronDown,
  CircleUser,
  Clock,
  FileSignature,
  Image,
  Link,
  Link2,
  ListChecks,
  ListFilter,
  Mail,
  MapPin,
  Network,
  Paperclip,
  Phone,
  QrCode,
  Search,
  Sigma,
  Tags,
  ToggleLeft,
  Type,
  Hash,
} from 'lucide-react'
import {AdminLayout} from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {BizDialog} from '@/components/ui/dialog'
import {Empty} from '@/components/ui/empty'
import {
  createAppFormField,
  getAppForm,
  updateAppFormField,
  type AppFormField,
  type AppFormFieldType,
  type AppForm,
} from '@/services/appForms'
import {
  formFieldWidthClasses,
  formFieldWidthOptions,
  getStoredFormLayout,
  isFormDividerField,
  saveStoredFormLayout,
  type FormItemProperties,
  type FormFieldWidth,
} from '@/lib/form-layout'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const typeLabels: Record<string, string> = {
  TEXT: '单行文本',
  NTEXT: '多行文本',
  DATE: '日期',
  DATETIME: '日期时间',
  NUMBER: '整数',
  DECIMAL: '小数',
  REFERENCE: '引用',
  PICKLIST: '下拉列表',
  SELECT: '列表',
  MULTISELECT: '多选',
  BOOL: '布尔',
  EMAIL: '邮箱',
  PHONE: '电话',
  URL: '链接',
  LOCATION: '地址',
  SERIES: '自动编号',
  TIME: '时间',
  CLASSIFICATION: '分类',
  TAG: '标签',
  FILE: '附件',
  IMAGE: '图片',
  AVATAR: '头像',
  BARCODE: '二维码',
  SIGN: '签名',
  STATE: '状态',
}

const fieldTypePalette: {
  type: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { type: 'TEXT', label: '文本', icon: Type },
  { type: 'NTEXT', label: '多行文本', icon: AlignLeft },
  { type: 'PHONE', label: '电话', icon: Phone },
  { type: 'EMAIL', label: '邮箱', icon: Mail },
  { type: 'URL', label: '链接', icon: Link },
  { type: 'SERIES', label: '自动编号', icon: Hash },
  { type: 'PICKLIST', label: '下拉列表', icon: ListFilter },
  { type: 'NUMBER', label: '整数', icon: Hash },
  { type: 'DECIMAL', label: '小数', icon: Sigma },
  { type: 'DATE', label: '日期', icon: Calendar },
  { type: 'DATETIME', label: '日期时间', icon: CalendarClock },
  { type: 'TIME', label: '时间', icon: Clock },
  { type: 'CLASSIFICATION', label: '分类', icon: Network },
  { type: 'MULTISELECT', label: '多选', icon: ListChecks },
  { type: 'TAG', label: '标签', icon: Tags },
  { type: 'REFERENCE', label: '引用', icon: Search },
  { type: 'FILE', label: '附件', icon: Paperclip },
  { type: 'IMAGE', label: '图片', icon: Image },
  { type: 'AVATAR', label: '头像', icon: CircleUser },
  { type: 'BARCODE', label: '二维码', icon: QrCode },
  { type: 'LOCATION', label: '位置', icon: MapPin },
  { type: 'SIGN', label: '签名', icon: FileSignature },
  { type: 'BOOL', label: '布尔', icon: ToggleLeft },
  { type: 'STATE', label: '状态', icon: Activity },
]

type DesignFormField = Omit<AppFormField, 'type'> & { type: string }

interface DesignForm {
  name: string
  label: string
  description: string
  nameField?: string | null
  fields: DesignFormField[]
}

function toDesignForm(form: AppForm): DesignForm {
  return {
    name: form.name,
    label: form.label,
    description: form.description,
    nameField: form.nameField,
    fields: form.fields.map((field) => ({...field})),
  }
}

type EditingItem = {
  kind: 'field' | 'divider'
  name: string
  label: string
  tip: string
  required: boolean
  readonly: boolean
  hidden: boolean
}

type FieldCreateDraft = {
  type: string
  defaultLabel: string
  label: string
  remark: string
}

const formFieldColumns: Record<FormFieldWidth, number> = {
  25: 3,
  33: 4,
  50: 6,
  66: 8,
  75: 9,
  100: 12,
}

function WidthSelector({
  value,
  onChange,
}: {
  value: FormFieldWidth
  onChange: (width: FormFieldWidth) => void
}) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="宽度"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((previous) => !previous)
        }}
      >
        <Columns2 className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 rounded-md border bg-popover p-2 shadow-md">
          <div className="flex items-center gap-1">
            {formFieldWidthOptions.map((width) => (
              <button
                key={width}
                type="button"
                title={`${width}%`}
                onClick={(event) => {
                  event.stopPropagation()
                  onChange(width)
                  setOpen(false)
                }}
                className={cn(
                  'h-7 w-9 overflow-hidden rounded-md border p-0 transition-colors',
                  value === width
                    ? 'border-primary bg-primary/10'
                    : 'bg-muted-foreground/10 hover:border-primary/60',
                )}
              >
                <span
                  className="block h-full rounded-l-md bg-primary/70"
                  style={{ width: `${width}%` }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** 表单设计 */
export default function FormDesign() {
  const {appId = '', formName = ''} = useParams<{ appId: string; formName: string }>()
  const navigate = useNavigate()
  const [form, setForm] = React.useState<DesignForm | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [layout, setLayout] = React.useState<string[]>([])
  const [dragging, setDragging] = React.useState<string | null>(null)
  const [dropIndex, setDropIndex] = React.useState<number | null>(null)
  const [saved, setSaved] = React.useState(false)
  const dragCompletedRef = React.useRef(false)
  const [widths, setWidths] = React.useState<Record<string, FormFieldWidth>>({})
  const [itemProperties, setItemProperties] = React.useState<Record<string, FormItemProperties>>({})
  const [editingItem, setEditingItem] = React.useState<EditingItem | null>(null)
  const [creatingField, setCreatingField] = React.useState<FieldCreateDraft | null>(null)
  const [fieldError, setFieldError] = React.useState<string | null>(null)
  const [resizing, setResizing] = React.useState<{
    name: string
    startX: number
    startColumns: number
    columnWidth: number
  } | null>(null)

  React.useEffect(() => {
    if (!appId || !formName) {
      setForm(null)
      setIsLoading(false)
      return
    }
    let cancelled = false
    getAppForm(appId, formName)
      .then((loadedForm) => {
        if (cancelled) return
        const designForm = toDesignForm(loadedForm)
        setForm(designForm)
        const storedLayout = getStoredFormLayout(designForm.name)
        if (storedLayout) {
          setLayout(storedLayout.fields)
          setWidths(storedLayout.widths)
          setItemProperties(storedLayout.properties ?? {})
        } else {
          setLayout(designForm.fields.map((field) => field.name))
          setWidths({})
          setItemProperties({})
        }
      })
      .catch(() => {
        if (!cancelled) setForm(null)
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, formName])

  React.useEffect(() => {
    if (!resizing) return
    const handlePointerMove = (event: PointerEvent) => {
      const nextColumns =
        resizing.startColumns + (event.clientX - resizing.startX) / resizing.columnWidth
      const width = formFieldWidthOptions.reduce((best, option) => (
        Math.abs(formFieldColumns[option] - nextColumns) <
        Math.abs(formFieldColumns[best] - nextColumns)
          ? option
          : best
      ), formFieldWidthOptions[0])
      setWidths((previous) => (
        previous[resizing.name] === width ? previous : {...previous, [resizing.name]: width}
      ))
    }
    const stopResize = () => setResizing(null)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)
    document.body.style.cursor = 'col-resize'
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResize)
      window.removeEventListener('pointercancel', stopResize)
      document.body.style.cursor = ''
    }
  }, [resizing])

  if (isLoading) {
    return <AdminLayout>
      <div className="min-h-[400px]"/>
    </AdminLayout>
  }

  if (!form) {
    return (
      <AdminLayout>
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          未找到表单
        </div>
      </AdminLayout>
    )
  }

  const allFields = form.fields

  const layoutFields = layout
    .map((name) => {
      const formField = allFields.find((field) => field.name === name)
      if (formField) return formField
      if (isFormDividerField(name)) {
        return {name, label: '分栏', type: 'TEXT', required: false, system: false}
      }
      return undefined
    })
    .filter((field): field is DesignFormField => Boolean(field))
  const availableFields = allFields.filter((field) => !layout.includes(field.name))

  const rowWidthTotals = (() => {
    const totals = new Map<string, number>()
    let rowNames: string[] = []
    let rowColumns = 0
    const finishRow = () => {
      rowNames.forEach((name) => totals.set(name, rowColumns))
      rowNames = []
      rowColumns = 0
    }
    layout.forEach((name) => {
      const columns = isFormDividerField(name) ? 12 : formFieldColumns[widths[name] ?? 50]
      if (rowColumns + columns > 12) finishRow()
      rowNames.push(name)
      rowColumns += columns
      if (rowColumns >= 12) finishRow()
    })
    finishRow()
    return totals
  })()

  const addField = (fieldName: string) => {
    setLayout((previous) => previous.includes(fieldName) ? previous : [...previous, fieldName])
  }
  const openFieldCreate = (fieldType: string, defaultLabel: string) => {
    setCreatingField({
      type: fieldType,
      defaultLabel,
      label: defaultLabel,
      remark: '',
    })
  }
  const saveFieldCreate = async () => {
    if (!creatingField || !form) return
    const label = creatingField.label.trim() || creatingField.defaultLabel
    const remark = creatingField.remark.trim()
    setFieldError(null)
    try {
      const createdField = await createAppFormField(appId, form.name, {
        label,
        type: creatingField.type as AppFormFieldType,
        required: false,
      })
      const designField = {...createdField}
      setForm({
        ...form,
        fields: [...form.fields, designField],
      })
      setLayout((previous) => [...previous, createdField.name])
      setWidths((previous) => ({...previous, [createdField.name]: 50}))
      if (remark) {
        updateItemProperties(createdField.name, {tip: remark})
      }
      setCreatingField(null)
    } catch (caught) {
      setFieldError(caught instanceof Error ? caught.message : '保存字段失败')
    }
  }
  const addDivider = () => {
    setLayout((previous) => [...previous, `$DIVIDER$-${Date.now()}`])
  }
  const removeField = (fieldName: string) => {
    setLayout((previous) => previous.filter((name) => name !== fieldName))
  }
  const resetLayout = () => {
    setLayout(allFields.map((field) => field.name))
    setWidths({})
    setItemProperties({})
  }
  const saveLayout = () => {
    saveStoredFormLayout(form.name, {
      fields: layout,
      widths,
      properties: itemProperties,
      customFields: [],
    })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }
  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= layout.length) return
    setLayout((previous) => {
      const next = [...previous]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }
  const getLayoutWidth = (name: string): FormFieldWidth => widths[name] ?? 50
  const updateLayoutWidth = (name: string, width: FormFieldWidth) => {
    setWidths((previous) => ({ ...previous, [name]: width }))
  }
  const getItemProperties = (name: string): FormItemProperties => itemProperties[name] ?? {}
  const updateItemProperties = (name: string, properties: FormItemProperties) => {
    setItemProperties((previous) => ({ ...previous, [name]: { ...previous[name], ...properties } }))
  }
  const getDisplayLabel = (field: DesignFormField) =>
    getItemProperties(field.name).label?.trim() || field.label
  const getDividerLabel = (name: string) => getItemProperties(name).label?.trim() || ''
  const getItemTip = (name: string) => getItemProperties(name).tip?.trim() || ''
  const openEdit = (field: DesignFormField) => {
    const properties = getItemProperties(field.name)
    setEditingItem({
      kind: 'field',
      name: field.name,
      label: properties.label?.trim() || field.label,
      tip: properties.tip || '',
      required: properties.required ?? field.name === form.nameField,
      readonly: properties.readonly ?? false,
      hidden: properties.hidden ?? false,
    })
  }
  const openDividerEdit = (name: string) => {
    setEditingItem({
      kind: 'divider',
      name,
      label: getItemProperties(name).label || '',
      tip: '',
      required: false,
      readonly: false,
      hidden: false,
    })
  }
  const saveEditingItem = () => {
    if (!editingItem) return
    const label = editingItem.label.trim()
    updateItemProperties(editingItem.name, editingItem.kind === 'divider'
      ? { label: label || undefined }
      : {
          label: label || undefined,
          tip: editingItem.tip.trim() || undefined,
          required: editingItem.required,
          readonly: editingItem.readonly,
          hidden: editingItem.hidden,
        })
    setEditingItem(null)
  }
  const startResize = (event: React.PointerEvent<HTMLElement>, name: string) => {
    const grid = event.currentTarget.closest('.grid') as HTMLElement | null
    if (!grid) return
    const gridRect = grid.getBoundingClientRect()
    const gap = Number.parseFloat(window.getComputedStyle(grid).columnGap || '0') || 0
    const columnWidth = (gridRect.width - gap * 11) / 12
    if (columnWidth <= 0) return
    event.preventDefault()
    event.stopPropagation()
    setResizing({
      name,
      startX: event.clientX,
      startColumns: formFieldColumns[getLayoutWidth(name)],
      columnWidth,
    })
  }
  const getDropIndex = (event: React.DragEvent<HTMLElement>, index: number) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const insertBefore = event.clientX < rect.left + rect.width / 2
    const from = dragging ? layout.indexOf(dragging) : -1
    const target = insertBefore ? index : index + 1
    return from >= 0 && from < target ? target - 1 : target
  }
  const finishDrag = (targetIndex?: number) => {
    const finalIndex = targetIndex ?? dropIndex
    if (dragging && finalIndex !== null && !dragCompletedRef.current) {
      moveField(layout.indexOf(dragging), finalIndex)
      dragCompletedRef.current = true
    }
    setDragging(null)
    setDropIndex(null)
  }
  const previewItems = (() => {
    if (!dragging || dropIndex === null) return layoutFields.map((field) => ({ key: field.name, field }))
    const sourceIndex = layoutFields.findIndex((field) => field.name === dragging)
    const insertIndex = Math.min(
      dropIndex + (sourceIndex >= 0 && sourceIndex < dropIndex ? 1 : 0),
      layoutFields.length,
    )
    const next: Array<DesignFormField | null> = [...layoutFields]
    next.splice(insertIndex, 0, null)
    return next.map((field, index) => ({
      key: field?.name ?? `drop-${index}`,
      field,
    }))
  })()

  return (
    <AdminLayout noOuterScroll contentClassName="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => navigate(`/admin/apps/${appId}/settings/forms`)}
              title="返回"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="m-0 truncate text-lg font-semibold">
                  {form.label} · 表单设计
                </h1>
              </div>
              <p className="mb-0 mt-0.5 truncate text-xs text-muted-foreground">
                {form.description || `${form.label} 的表单布局配置`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" /> 已保存
              </span>
            )}
            <Button variant="secondary" onClick={resetLayout}>
              <RotateCcw className="h-4 w-4" /> 重置布局
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  <Plus className="h-4 w-4" /> 添加
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={addDivider}>
                  <Columns3 className="h-4 w-4" /> 分栏
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={saveLayout}>
              <Save className="h-4 w-4" /> 保存
            </Button>
          </div>
        </div>

        <Tabs defaultValue="layout" className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-4 pt-3">
            <TabsList>
              <TabsTrigger value="layout">表单布局</TabsTrigger>
              <TabsTrigger value="advanced">高级控制</TabsTrigger>
            </TabsList>
            <span className="hidden text-xs text-muted-foreground md:block">
              拖动字段调整顺序和位置，点击右侧字段添加到布局
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <TabsContent value="layout" className="min-h-0 flex-1 overflow-y-auto rounded-xl border bg-card p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  {previewItems.map((item) => (
                    item.field ? (
                      <div
                        key={item.key}
                        draggable={resizing?.name !== item.field.name}
                        onDragStart={(event) => {
                          dragCompletedRef.current = false
                          setDropIndex(null)
                          setDragging(item.field!.name)
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', item.field!.name)
                        }}
                        onDragOver={(event) => {
                          event.preventDefault()
                          setDropIndex(getDropIndex(event, layoutFields.findIndex((field) => field.name === item.field!.name)))
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          const nextIndex = getDropIndex(event, layoutFields.findIndex((field) => field.name === item.field!.name))
                          setDropIndex(nextIndex)
                          finishDrag(nextIndex)
                        }}
                        onDragEnd={() => finishDrag()}
                        className={cn(
                          'group relative flex cursor-grab items-center rounded-md px-3 transition-colors active:cursor-grabbing',
                          isFormDividerField(item.field.name)
                            ? 'h-9 border-y border-dashed border-primary/40 bg-primary/10 text-foreground hover:border-primary/60 md:col-span-12'
                            : cn(
                                'border bg-background py-2 hover:border-primary',
                                formFieldWidthClasses[getLayoutWidth(item.field.name)],
                              ),
                          dragging === item.field.name && 'opacity-30',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                          {isFormDividerField(item.field.name) && (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground"/>
                          )}
                          <span className="min-w-0 truncate text-sm font-medium">
                            {isFormDividerField(item.field.name)
                              ? (getDividerLabel(item.field.name) || '分栏')
                              : getDisplayLabel(item.field)}
                            {getItemTip(item.field.name) && (
                              <Info className="ml-1 inline-block h-3.5 w-3.5 align-[-2px] text-muted-foreground" />
                            )}
                          </span>
                        </div>

                        {item.field.name === form.nameField && (
                          <Badge className="bg-primary/10 text-primary">名称</Badge>
                        )}
                        {!isFormDividerField(item.field.name) && (
                          <span className="ml-auto hidden shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground group-hover:opacity-0 md:block">
                            {typeLabels[item.field.type]}
                          </span>
                        )}

                        {!isFormDividerField(item.field.name) &&
                          (rowWidthTotals.get(item.field.name) ?? 12) < 12 && (
                          <div
                            className="absolute right-0 top-1/2 z-40 h-10 w-1.5 -translate-y-1/2 cursor-col-resize rounded-full bg-border opacity-0 transition-opacity group-hover:opacity-100"
                            onPointerDown={(event) => startResize(event, item.field!.name)}
                          />
                        )}

                        <div className="absolute right-1.5 top-1/2 z-50 hidden -translate-y-1/2 items-center gap-0.5 p-0.5 group-hover:flex">
                          {!isFormDividerField(item.field.name) && (
                            <WidthSelector
                              value={getLayoutWidth(item.field!.name)}
                              onChange={(width) => updateLayoutWidth(item.field!.name, width)}
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="修改"
                            onClick={() => isFormDividerField(item.field!.name)
                              ? openDividerEdit(item.field!.name)
                              : openEdit(item.field!)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeField(item.field!.name)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={item.key}
                        className={cn(
                          'rounded-md border-2 border-dashed border-primary/50 bg-primary/10',
                          dragging && isFormDividerField(dragging) ? 'md:col-span-12' : formFieldWidthClasses[getLayoutWidth(dragging!)],
                        )}
                      />
                    )
                  ))}
                </div>
                {layoutFields.length === 0 && (
                  <Empty
                    className="min-h-[240px] rounded-lg border border-dashed"
                    description={
                      <>
                        <p className="m-0 font-medium text-foreground">暂无布局字段</p>
                        <p className="mt-1">点击右侧字段添加</p>
                      </>
                    }
                  />
                )}
              </TabsContent>

              <TabsContent value="advanced" className="min-h-0 flex-1 overflow-y-auto rounded-xl border bg-card">
                <div className="overflow-x-auto">
                  <table className="app-table w-full min-w-[680px]">
                    <thead>
                      <tr>
                        <th>字段</th>
                        <th className="w-[120px]">隐藏</th>
                        <th className="w-[120px]">必填</th>
                        <th className="w-[120px]">只读</th>
                      </tr>
                    </thead>
                    <tbody>
                      {layoutFields.filter((field) => !isFormDividerField(field.name)).map((field) => (
                        <tr key={field.name}>
                          <td>
                            <span className="font-medium">{getDisplayLabel(field)}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{field.name}</span>
                          </td>
                          {(['hidden', 'required', 'readonly'] as const).map((key) => (
                            <td key={key}>
                              <Checkbox
                                checked={getItemProperties(field.name)[key] ?? (key === 'required' && field.name === form.nameField)}
                                onCheckedChange={(checked) =>
                                  updateItemProperties(field.name, { [key]: checked === true })
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </div>

            <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-card lg:w-[320px]">
              <Tabs defaultValue="field-list" className="flex min-h-0 flex-1 flex-col">
                <div className="border-b px-3 pt-3">
                  <TabsList className="grid h-9 w-full grid-cols-2 bg-muted/70">
                    <TabsTrigger value="field-list" className="text-xs">字段列表</TabsTrigger>
                    <TabsTrigger value="field-new" className="text-xs">添加字段</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="field-list" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
                  {availableFields.map((field) => (
                    <button
                      key={field.name}
                      type="button"
                      className="group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
                      onClick={() => addField(field.name)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{field.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {typeLabels[field.type] ?? field.type}
                        </span>
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:text-primary group-hover:opacity-100" />
                    </button>
                  ))}
                  {availableFields.length === 0 && (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      全部字段已布局
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="field-new" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
                  <div className="grid gap-1">
                    {fieldTypePalette.map((fieldType) => {
                      const Icon = fieldType.icon
                      return (
                        <button
                          key={fieldType.type}
                          type="button"
                          className="group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
                          onClick={() => openFieldCreate(fieldType.type, fieldType.label)}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{fieldType.label}</span>
                          <Plus className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:text-primary group-hover:opacity-100" />
                        </button>
                      )
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </aside>
          </div>
        </Tabs>

        <BizDialog
          open={Boolean(editingItem)}
          onOpenChange={(open) => !open && setEditingItem(null)}
          width={420}
          title={editingItem?.kind === 'divider' ? '修改分栏' : '修改字段'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditingItem(null)}>取消</Button>
              <Button onClick={saveEditingItem}>保存</Button>
            </>
          }
        >
          {editingItem && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {editingItem.kind === 'divider' ? '分栏名称' : '字段名称'}
                </label>
                <Input
                  value={editingItem.label}
                  maxLength={100}
                  onChange={(event) => setEditingItem((previous) => previous
                    ? { ...previous, label: event.target.value }
                    : previous)}
                />
              </div>
              {editingItem.kind === 'field' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">填写提示</label>
                    <Input
                      value={editingItem.tip}
                      maxLength={200}
                      placeholder="无"
                      onChange={(event) => setEditingItem((previous) => previous
                        ? { ...previous, tip: event.target.value }
                        : previous)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    {([
                      ['required', '必填'],
                      ['readonly', '只读'],
                      ['hidden', '隐藏'],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={editingItem[key]}
                          onCheckedChange={(checked) => setEditingItem((previous) => previous
                            ? { ...previous, [key]: checked === true }
                            : previous)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </BizDialog>

        <BizDialog
          open={Boolean(creatingField)}
          onOpenChange={(open) => !open && setCreatingField(null)}
          width={420}
          title={creatingField
            ? `添加${typeLabels[creatingField.type] ?? creatingField.type}`
            : '添加字段'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCreatingField(null)}>取消</Button>
              <Button onClick={saveFieldCreate}>保存</Button>
            </>
          }
        >
          {creatingField && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">字段名称</label>
                <Input
                  value={creatingField.label}
                  maxLength={100}
                  onChange={(event) => setCreatingField((previous) => previous
                    ? { ...previous, label: event.target.value }
                    : previous)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">备注</label>
                <Input
                  value={creatingField.remark}
                  maxLength={200}
                  placeholder="无"
                  onChange={(event) => setCreatingField((previous) => previous
                    ? { ...previous, remark: event.target.value }
                    : previous)}
                />
              </div>
            </div>
          )}
        </BizDialog>
      </div>
    </AdminLayout>
  )
}

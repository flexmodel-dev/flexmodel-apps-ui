import * as React from 'react'
import {FieldConfigEditor} from '@/components/biz/FieldConfigEditor'
import type {AppFieldConfig, AppFormFieldOption} from '@/services/appForms'
import {SettingsPageHeader} from '@/components/biz/SettingsPageHeader'
import {FormSettingsNav} from '@/components/biz/FormSettingsNav'
import {FormAdvancedControls} from '@/components/biz/form/FormAdvancedControls'
import {
  Check,
  Columns2,
  Columns3,
  GripVertical,
  Info,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
  Activity,
  AlignLeft,
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
  Table2,
  Tags,
  ToggleLeft,
  Type,
  Hash,
} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Checkbox} from '@/components/ui/checkbox'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {Input} from '@/components/ui/input'
import {BizDialog, ConfirmDialog} from '@/components/ui/dialog'
import {Empty} from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createAppFormField,
  deleteAppFormField,
  getAppForms,
  getAppForm,
  saveAppFormLayout,
  updateAppFormField,
  type AppFormField,
  type AppFormFieldType,
  type AppForm,
  type AppFormLayout,
  type AppFormControls,
  type AppFormItem,
  type AppFormFieldUpdateInput,
} from '@/services/appForms'
import {
  formItemWidthTypeClasses,
  formItemWidthOptions,
  type FormItemWidthType,
} from '@/lib/form-items'
import {cn, toErrorMessage} from '@/lib/utils'
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
  MULTIREFERENCE: '多选引用',
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
  {type: 'TEXT', label: '文本', icon: Type},
  {type: 'NTEXT', label: '多行文本', icon: AlignLeft},
  {type: 'PHONE', label: '电话', icon: Phone},
  {type: 'EMAIL', label: '邮箱', icon: Mail},
  {type: 'URL', label: '链接', icon: Link},
  {type: 'SERIES', label: '自动编号', icon: Hash},
  {type: 'PICKLIST', label: '下拉列表', icon: ListFilter},
  {type: 'NUMBER', label: '整数', icon: Hash},
  {type: 'DECIMAL', label: '小数', icon: Sigma},
  {type: 'DATE', label: '日期', icon: Calendar},
  {type: 'DATETIME', label: '日期时间', icon: CalendarClock},
  {type: 'TIME', label: '时间', icon: Clock},
  {type: 'CLASSIFICATION', label: '分类', icon: Network},
  {type: 'MULTISELECT', label: '多选', icon: ListChecks},
  {type: 'TAG', label: '标签', icon: Tags},
  {type: 'REFERENCE', label: '引用', icon: Search},
  {type: 'FILE', label: '附件', icon: Paperclip},
  {type: 'IMAGE', label: '图片', icon: Image},
  {type: 'AVATAR', label: '头像', icon: CircleUser},
  {type: 'BARCODE', label: '二维码', icon: QrCode},
  {type: 'LOCATION', label: '位置', icon: MapPin},
  {type: 'SIGN', label: '签名', icon: FileSignature},
  {type: 'BOOL', label: '布尔', icon: ToggleLeft},
  {type: 'STATE', label: '状态', icon: Activity},
]

const builtinFieldTypeNames = new Set([
  'TEXT',
  'NTEXT',
  'PHONE',
  'EMAIL',
  'URL',
  'TAG',
  'SELECT',
  'NUMBER',
  'DECIMAL',
  'DATE',
  'DATETIME',
  'TIME',
  'BOOL',
  'MULTISELECT',
  'REFERENCE',
])

interface DesignForm {
  name: string
  label: string
  description: string
  displayField?: string | null
  searchField?: string | null
  managed: boolean
  builtin: boolean
  fields: AppFormField[]
  layout: AppFormLayout
  viewTabs: AppForm['viewTabs']
}

interface FormDesignerProps {
  appId: string
  initialForm: AppForm
  onBack: () => void
  backLabel?: string
  onFormChange: (form: AppForm) => void
}

type DesignLayoutItem =
  | { index: number; kind: 'FIELD'; field: AppFormField; item: AppFormItem }
  | { index: number; kind: 'SECTION'; item: AppFormItem }
  | { index: number; kind: 'SUBFORM'; item: AppFormItem }

function toDesignForm(form: AppForm): DesignForm {
  return {
    name: form.name,
    label: form.label,
    description: form.description,
    displayField: form.displayField,
    searchField: form.searchField,
    managed: form.managed,
    builtin: form.builtin,
    fields: form.fields.map((field) => ({...field})),
    layout: form.layout,
    viewTabs: form.viewTabs,
  }
}

type EditingItem = {
  index: number
  label: string
  tip: string
  readonly: boolean
  hidden: boolean
} & ({kind: 'section'} | {kind: 'field'; field: AppFormField; properties: AppFormFieldUpdateInput})

type FieldCreateDraft = {
  type: string
  defaultLabel: string
  label: string
  remark: string
  required?: boolean
  config?: AppFieldConfig
  options?: AppFormFieldOption[]
  referenceForm?: string
}

type SubformDraft = {
  index?: number
  formName: string
  referenceField: string
  label: string
}

const formItemColumns: Record<FormItemWidthType, number> = {
  QUARTER: 3,
  THIRD: 4,
  HALF: 6,
  TWO_THIRDS: 8,
  THREE_QUARTERS: 9,
  FULL: 12,
}

function WidthSelector({
                         value,
                         onChange,
                       }: {
  value: FormItemWidthType
  onChange: (width: FormItemWidthType) => void
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
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((previous) => !previous)
        }}
      >
        <Columns2 className="h-4 w-4"/>
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 rounded-md border bg-popover p-2 shadow-md">
          <div className="flex items-center gap-1">
            {formItemWidthOptions.map((width) => (
              <button
                key={width}
                type="button"
                title={width}
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
                  style={{width: `${formItemColumns[width] * 100 / 12}%`}}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function FormDesigner({
                               appId,
                               initialForm,
                               onBack,
                               backLabel = '返回表单列表',
                               onFormChange,
                             }: FormDesignerProps) {
  const [form, setForm] = React.useState<DesignForm>(() => toDesignForm(initialForm))
  const [items, setItems] = React.useState<AppFormItem[]>([])
  const [controls, setControls] = React.useState<AppFormControls>({})
  const [designTab, setDesignTab] = React.useState('layout')
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null)
  const [fieldRemarks, setFieldRemarks] = React.useState<Record<string, string>>({})
  const [dropIndex, setDropIndex] = React.useState<number | null>(null)
  const dragCompletedRef = React.useRef(false)
  const draggingIndexRef = React.useRef<number | null>(null)
  const dropIndexRef = React.useRef<number | null>(null)
  const itemRectsRef = React.useRef<Map<number, DOMRect>>(new Map())
  const [availableForms, setAvailableForms] = React.useState<AppForm[]>([])
  const [subformDraft, setSubformDraft] = React.useState<SubformDraft | null>(null)
  const [subformForm, setSubformForm] = React.useState<AppForm | null>(null)
  const [subformError, setSubformError] = React.useState<string | null>(null)
  const [isSavingSubform, setIsSavingSubform] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<EditingItem | null>(null)
  const [isSavingItem, setIsSavingItem] = React.useState(false)
  const [editError, setEditError] = React.useState<string | null>(null)
  const [creatingField, setCreatingField] = React.useState<FieldCreateDraft | null>(null)
  const [fieldError, setFieldError] = React.useState<string | null>(null)
  const [deletingField, setDeletingField] = React.useState<AppFormField | null>(null)
  const [isDeletingField, setIsDeletingField] = React.useState(false)
  const [deleteFieldError, setDeleteFieldError] = React.useState<string | null>(null)
  const [resizing, setResizing] = React.useState<{
    index: number
    startX: number
    startColumns: number
    columnWidth: number
  } | null>(null)
  const [isSavingLayout, setIsSavingLayout] = React.useState(false)
  const [layoutError, setLayoutError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    const designForm = toDesignForm(initialForm)
    setForm(designForm)
    setItems(designForm.layout.items)
    setControls(designForm.layout.controls ?? {})
    setDraggingIndex(null)
    setDropIndex(null)
    setEditingItem(null)
    setCreatingField(null)
    setSubformDraft(null)
    setResizing(null)
  }, [initialForm])

  React.useEffect(() => {
    if (!appId) {
      setAvailableForms([])
      return
    }
    let cancelled = false
    getAppForms(appId)
      .then((forms) => {
        if (!cancelled) setAvailableForms(forms)
      })
      .catch(() => {
        if (!cancelled) setAvailableForms([])
      })
    return () => {
      cancelled = true
    }
  }, [appId])

  React.useEffect(() => {
    const selectedFormName = subformDraft?.formName
    if (!appId || !selectedFormName) {
      setSubformForm(null)
      return
    }
    setSubformForm(null)
    let cancelled = false
    getAppForm(appId, selectedFormName)
      .then((loadedForm) => {
        if (!cancelled) setSubformForm(loadedForm)
      })
      .catch(() => {
        if (!cancelled) setSubformForm(null)
      })
    return () => {
      cancelled = true
    }
  }, [appId, subformDraft?.formName])

  React.useEffect(() => {
    if (!resizing) return
    const handlePointerMove = (event: PointerEvent) => {
      const nextColumns =
        resizing.startColumns + (event.clientX - resizing.startX) / resizing.columnWidth
      const width = formItemWidthOptions.reduce((best, option) => (
        Math.abs(formItemColumns[option] - nextColumns) <
        Math.abs(formItemColumns[best] - nextColumns)
          ? option
          : best
      ), formItemWidthOptions[0])
      setItems((previous) => previous[resizing.index]?.width === width
        ? previous
        : previous.map((item, index) => index === resizing.index ? {...item, width} : item))
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

  React.useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(false), 1600)
    return () => window.clearTimeout(timer)
  }, [saved])

  const allFields = form.fields

  const layoutItems = items
    .map((item, index): DesignLayoutItem | undefined => {
      if (item.type === 'SECTION') return {index, kind: 'SECTION', item}
      if (item.type === 'SUBFORM' && item.formName && item.referenceField) {
        return {index, kind: 'SUBFORM', item}
      }
      const field = item.type === 'FIELD' && item.name ? allFields.find((entry) => entry.name === item.name) : undefined
      return field ? {index, kind: 'FIELD', field, item} : undefined
    })
    .filter((item): item is DesignLayoutItem => Boolean(item))
  const laidOutFieldNames = new Set(items
    .filter((item) => item.type === 'FIELD' && Boolean(item.name))
    .map((item) => item.name!))
  const availableFields = allFields.filter((field) => !laidOutFieldNames.has(field.name))
  const availableFieldTypes = form.builtin
    ? fieldTypePalette.filter((fieldType) => builtinFieldTypeNames.has(fieldType.type))
    : fieldTypePalette

  const rowWidthTotals = (() => {
    const totals = new Map<number, number>()
    let rowIndexes: number[] = []
    let rowColumns = 0
    const finishRow = () => {
      rowIndexes.forEach((index) => totals.set(index, rowColumns))
      rowIndexes = []
      rowColumns = 0
    }
    items.forEach((item, index) => {
      const columns = item.type === 'FIELD'
        ? formItemColumns[item.width ?? 'HALF']
        : 12
      if (rowColumns + columns > 12) finishRow()
      rowIndexes.push(index)
      rowColumns += columns
      if (rowColumns >= 12) finishRow()
    })
    finishRow()
    return totals
  })()

  const addField = (fieldName: string) => {
    setItems((previous) => previous.some((item) => item.type === 'FIELD' && item.name === fieldName)
      ? previous
      : [...previous, {
        type: 'FIELD',
        name: fieldName,
        width: 'HALF',
        tip: fieldRemarks[fieldName],
      }])
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
        required: creatingField.required ?? false,
        config: creatingField.config ?? {},
        options: creatingField.options,
        referenceForm: creatingField.referenceForm,
      })
      const designField = {...createdField}
      const nextItems: AppFormItem[] = [
        ...items,
        {
          type: 'FIELD',
          name: createdField.name,
          width: 'HALF',
          tip: remark,
        },
      ]
      const nextForm = {
        ...form,
        fields: [...form.fields, designField],
        layout: {items: nextItems, controls},
      }
      setItems(nextItems)
      setForm(nextForm)
      onFormChange(nextForm)
      setFieldRemarks((previous) => ({...previous, [createdField.name]: remark}))
      setCreatingField(null)
    } catch (caught) {
      setFieldError(toErrorMessage(caught, '保存字段失败'))
    }
  }
  const addDivider = () => {
    setItems((previous) => [...previous, {type: 'SECTION', label: '分栏', width: 'FULL'}])
  }
  const deleteField = async () => {
    if (!deletingField || deletingField.builtin || deletingField.locked || isDeletingField) return
    setIsDeletingField(true)
    setDeleteFieldError(null)
    try {
      await deleteAppFormField(appId, form.name, deletingField.name)
      const nextItems = items.filter(item => item.type !== 'FIELD' || item.name !== deletingField.name)
      const nextControls = Object.fromEntries(Object.entries(controls).filter(([name]) => name !== deletingField.name))
      const nextForm = {
        ...form,
        fields: form.fields.filter(field => field.name !== deletingField.name),
        displayField: form.displayField === deletingField.name ? null : form.displayField,
        searchField: form.searchField === deletingField.name ? null : form.searchField,
        layout: {items: nextItems, controls: nextControls},
      }
      setItems(nextItems)
      setControls(nextControls)
      setForm(nextForm)
      onFormChange(nextForm)
      setSaved(false)
      setDeletingField(null)
    } catch (caught) {
      setDeleteFieldError(toErrorMessage(caught, '删除字段失败'))
    } finally {
      setIsDeletingField(false)
    }
  }
  const openSubformCreate = () => {
    setSubformError(null)
    setSubformDraft({
      formName: '',
      referenceField: '',
      label: '',
    })
  }
  const openSubformEdit = (index: number) => {
    const item = items[index]
    if (!item || item.type !== 'SUBFORM') return
    setSubformError(null)
    setSubformDraft({
      index,
      formName: item.formName ?? '',
      referenceField: item.referenceField ?? '',
      label: item.label?.trim() || '',
    })
  }
  const saveSubform = async () => {
    if (!subformDraft || !form) return
    const selectedForm = availableForms.find((item) => item.name === subformDraft.formName)
    if (!selectedForm) {
      setSubformError('请选择子表单')
      return
    }
    setIsSavingSubform(true)
    setSubformError(null)
    try {
      let referenceField = subformDraft.referenceField
      if (!referenceField) {
        const createdField = await createAppFormField(appId, selectedForm.name, {
          label: `${form.label.slice(0, 96)}引用`,
          type: 'REFERENCE',
          required: false,
          referenceForm: form.name,
        })
        referenceField = createdField.name
        setAvailableForms((previous) => previous.map((item) => item.name === selectedForm.name
          ? {...item, fields: [...item.fields, createdField]}
          : item))
        setSubformForm((previous) => previous && previous.name === selectedForm.name
          ? {...previous, fields: [...previous.fields, createdField]}
          : previous)
      }
      const nextItem: AppFormItem = {
        type: 'SUBFORM',
        formName: selectedForm.name,
        referenceField,
        label: subformDraft.label.trim() || undefined,
        width: subformDraft.index === undefined ? 'FULL' : items[subformDraft.index].width ?? 'FULL',
      }
      setItems((previous) => subformDraft.index === undefined
        ? [...previous, nextItem]
        : previous.map((item, index) => index === subformDraft.index ? nextItem : item))
      setSubformDraft(null)
    } catch (caught) {
      setSubformError(toErrorMessage(caught, '保存子表单失败'))
    } finally {
      setIsSavingSubform(false)
    }
  }
  const removeItem = (index: number) => {
    const removed = items[index]
    setItems((previous) => previous.filter((item, itemIndex) => itemIndex !== index))
    if (removed?.type === 'FIELD' && removed.name) {
      const fieldName = removed.name
      setControls(previous => {
        if (!previous[fieldName]) return previous
        const {[fieldName]: _removed, ...rest} = previous
        return rest
      })
    }
  }
  const resetLayout = () => {
    const nextItems = allFields.filter((field) => !field.builtin).map((field) => ({
      type: 'FIELD' as const,
      name: field.name,
      width: 'HALF' as const,
    }))
    const fieldNames = new Set(nextItems.map(item => item.name))
    setItems(nextItems)
    setControls(previous => Object.fromEntries(
      Object.entries(previous).filter(([fieldName]) => fieldNames.has(fieldName)),
    ))
  }
  const saveLayout = async () => {
    if (!form) return
    setIsSavingLayout(true)
    setLayoutError(null)
    try {
      const updatedForm = await saveAppFormLayout(appId, form.name, {items, controls})
      setForm(toDesignForm(updatedForm))
      onFormChange(updatedForm)
      setSaved(true)
    } catch (caught) {
      setLayoutError(toErrorMessage(caught, '保存布局失败'))
    } finally {
      setIsSavingLayout(false)
    }
  }
  const moveItem = (from: number, to: number) => {
    setItems((previous) => {
      if (from < 0 || from >= previous.length || to < 0 || to > previous.length || from === to) {
        return previous
      }
      const next = [...previous]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }
  const updateDropIndex = (index: number | null) => {
    dropIndexRef.current = index
    setDropIndex(index)
  }
  const getLayoutWidth = (index: number): FormItemWidthType => items[index]?.width ?? 'HALF'
  const updateLayoutWidth = (index: number, width: FormItemWidthType) => {
    setItems((previous) => previous.map((item, itemIndex) => itemIndex === index ? {...item, width} : item))
  }
  const getDisplayLabel = (entry: Extract<DesignLayoutItem, { kind: 'FIELD' }>) =>
    entry.item.label?.trim() || entry.field.label
  const getSectionLabel = (item: AppFormItem) => item.label?.trim() || '分栏'
  const getSubformLabel = (item: AppFormItem) => item.label?.trim() || '子表单'
  const getItemTip = (item: AppFormItem) => item.tip?.trim() || ''
  const openFieldEdit = (index: number) => {
    const entry = layoutItems.find(
      (item): item is Extract<DesignLayoutItem, { kind: 'FIELD' }> => item.index === index && item.kind === 'FIELD',
    )
    if (!entry) return
    const item = entry.item
    setEditError(null)
    setEditingItem({
      kind: 'field',
      index,
      label: item.label || '',
      tip: item.tip || '',
      readonly: item.readonly ?? false,
      hidden: item.hidden ?? false,
      field: entry.field,
      properties: {
        label: entry.field.label,
        required: entry.field.required,
        options: entry.field.options ?? undefined,
        referenceForm: entry.field.referenceForm ?? undefined,
        config: entry.field.config ?? {},
      },
    })
  }
  const openSectionEdit = (index: number) => {
    const item = items[index]
    if (!item || item.type !== 'SECTION') return
    setEditError(null)
    setEditingItem({
      kind: 'section',
      index,
      label: item.label || '',
      tip: '',
      readonly: false,
      hidden: false,
    })
  }
  const updateEditingProperties = (properties: Partial<AppFormFieldUpdateInput>) => {
    setEditingItem(previous => previous?.kind === 'field'
      ? {...previous, properties: {...previous.properties, ...properties}}
      : previous)
  }
  const saveEditingItem = async () => {
    if (!editingItem || isSavingItem) return
    const label = editingItem.label.trim()
    const nextItems = items.map((item, index) => index === editingItem.index
      ? editingItem.kind === 'section'
        ? {...item, label: label || undefined}
        : {
          ...item,
          label: label || undefined,
          tip: editingItem.tip.trim() || undefined,
          readonly: form.builtin ? editingItem.readonly : undefined,
          hidden: form.builtin ? editingItem.hidden : undefined,
        }
      : item)
    if (editingItem.kind === 'section') {
      setItems(nextItems)
      setSaved(false)
      setEditingItem(null)
      return
    }
    const {field, properties} = editingItem
    if (!properties.label.trim()) {
      setEditError('字段名称不能为空')
      return
    }
    const changed = properties.label.trim() !== field.label || properties.required !== field.required
      || properties.referenceForm !== (field.referenceForm ?? undefined)
      || JSON.stringify(properties.options ?? []) !== JSON.stringify(field.options ?? [])
      || JSON.stringify(properties.config ?? {}) !== JSON.stringify(field.config ?? {})
    setIsSavingItem(true)
    setEditError(null)
    try {
      const updatedField = changed && !field.builtin && !field.locked
        ? await updateAppFormField(appId, form.name, field.name, {...properties, label: properties.label.trim()})
        : field
      // 父组件会将结果作为 initialForm 回传，携带当前草稿可避免其重置未保存的布局。
      const nextForm: AppForm = {
        ...initialForm,
        fields: form.fields.map(item => item.name === field.name ? updatedField : item),
        layout: {items: nextItems, controls},
      }
      setForm(toDesignForm(nextForm))
      setItems(nextItems)
      onFormChange(nextForm)
      setSaved(false)
      setEditingItem(null)
    } catch (caught) {
      setEditError(toErrorMessage(caught, '保存字段失败'))
    } finally {
      setIsSavingItem(false)
    }
  }
  const startResize = (event: React.PointerEvent<HTMLElement>, index: number) => {
    const grid = event.currentTarget.closest('.grid') as HTMLElement | null
    if (!grid) return
    const gridRect = grid.getBoundingClientRect()
    const gap = Number.parseFloat(window.getComputedStyle(grid).columnGap || '0') || 0
    const columnWidth = (gridRect.width - gap * 11) / 12
    if (columnWidth <= 0) return
    event.preventDefault()
    event.stopPropagation()
    setResizing({
      index,
      startX: event.clientX,
      startColumns: formItemColumns[getLayoutWidth(index)],
      columnWidth,
    })
  }
  const calculateDropIndex = (clientX: number, clientY: number) => {
    const from = draggingIndexRef.current
    if (from === null) return null
    const entries = Array.from(itemRectsRef.current.entries())
    if (entries.length === 0) return items.length

    let nearestIndex = entries[0][0]
    let nearestRect = entries[0][1]
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const [index, rect] of entries) {
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const horizontalDistance = Math.max(Math.abs(clientX - centerX) - rect.width / 2, 0)
      const verticalDistance = Math.max(Math.abs(clientY - centerY) - rect.height / 2, 0)
      const distance = Math.hypot(horizontalDistance, verticalDistance)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
        nearestRect = rect
      }
    }

    const insertBefore = clientX < nearestRect.left + nearestRect.width / 2
    const withoutDraggingIndex = nearestIndex > from ? nearestIndex - 1 : nearestIndex
    return insertBefore ? withoutDraggingIndex : withoutDraggingIndex + 1
  }
  const finishDrag = (targetIndex?: number) => {
    const from = draggingIndexRef.current
    const finalIndex = targetIndex ?? dropIndexRef.current
    if (from !== null && finalIndex !== null && !dragCompletedRef.current) {
      moveItem(from, finalIndex)
      dragCompletedRef.current = true
    }
    draggingIndexRef.current = null
    itemRectsRef.current.clear()
    updateDropIndex(null)
    setDraggingIndex(null)
  }
  const previewItems = (() => {
    const orderedIndexes = items.map((_, index) => index)
    if (draggingIndex === null || dropIndex === null) {
      return orderedIndexes.map((index) => ({entry: layoutItems.find((item) => item.index === index), index}))
    }
    const withoutDragging = orderedIndexes.filter((index) => index !== draggingIndex)
    withoutDragging.splice(dropIndex, 0, -1)
    return withoutDragging.map((index) => ({
      entry: index < 0 ? undefined : layoutItems.find((item) => item.index === index),
      index,
    }))
  })()

  const previewRows = (() => {
    const rows: Array<Array<{ entry: DesignLayoutItem | undefined; index: number }>> = []
    let row: Array<{ entry: DesignLayoutItem | undefined; index: number }> = []
    let rowColumns = 0
    const finishRow = () => {
      if (row.length > 0) {
        rows.push(row)
      }
      row = []
      rowColumns = 0
    }
    previewItems.forEach((preview, previewIndex) => {
      const width = preview.entry
        ? preview.entry.kind === 'FIELD'
          ? getLayoutWidth(preview.entry.index)
          : 'FULL'
        : draggingIndex !== null
          ? getLayoutWidth(draggingIndex)
          : 'FULL'
      const columns = formItemColumns[width]
      if (rowColumns + columns > 12) {
        finishRow()
      }
      row.push(preview)
      rowColumns += columns
      if (rowColumns >= 12) {
        finishRow()
      }
    })
    finishRow()
    return rows
  })()

  const selectedSubformForm = subformForm
    ?? availableForms.find((item) => item.name === subformDraft?.formName)
  const subformReferenceFields = selectedSubformForm?.fields.filter((field) => !field.builtin) ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <SettingsPageHeader title={`表单设计`}
        description="调整字段布局、填写提示与显示方式。"
        onBack={onBack} backLabel={backLabel}
        actions={<>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <Check className="h-4 w-4"/> 已保存
              </span>
          )}
          <Button variant="secondary" onClick={resetLayout} disabled={form.builtin}>
            <RotateCcw className="h-4 w-4"/> 重置布局
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <Plus className="h-4 w-4"/> 添加
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={addDivider}>
                <Columns3 className="h-4 w-4"/> 分栏
              </DropdownMenuItem>
              {!form.builtin && (
                <DropdownMenuItem onClick={openSubformCreate}>
                  <Table2 className="h-4 w-4"/> 子表单
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={saveLayout} disabled={isSavingLayout}>
            <Save className="h-4 w-4"/> 保存
          </Button>
          {layoutError && (
            <span className="text-sm text-destructive">{layoutError}</span>
          )}
        </>}>
        <FormSettingsNav appId={appId} formName={form.name} mobile/>
      </SettingsPageHeader>

      <Tabs value={designTab} onValueChange={setDesignTab} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-3 pt-2">
          <TabsList>
            <TabsTrigger value="layout">表单布局</TabsTrigger>
            {!form.builtin && <TabsTrigger value="display-controls">显示控制</TabsTrigger>}
          </TabsList>
          <span className="hidden text-xs text-muted-foreground xl:block">
            {designTab === 'layout'
              ? '拖动字段调整顺序和位置，点击右侧字段添加到布局'
              : '按场景配置字段隐藏、必填、只读，并可设置生效条件'}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 xl:flex-row xl:overflow-hidden">
          <div className="flex h-72 min-w-0 shrink-0 flex-col xl:h-auto xl:min-h-0 xl:flex-1">
            <TabsContent
              value="layout"
              data-form-designer-canvas
              className="min-h-0 flex-1 overflow-y-auto rounded-xl border bg-card p-3"
              onDragOver={(event) => {
                if (draggingIndexRef.current === null) return
                event.preventDefault()
                updateDropIndex(calculateDropIndex(event.clientX, event.clientY) ?? items.length)
              }}
              onDrop={(event) => {
                if (draggingIndexRef.current === null) return
                event.preventDefault()
                const nextIndex = calculateDropIndex(event.clientX, event.clientY) ?? items.length
                updateDropIndex(nextIndex)
                finishDrag(nextIndex)
              }}
            >
              <div className="flex flex-col gap-2">
                {previewRows.map((row, rowIndex) => (
                  <div key={`layout-row-${rowIndex}`} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                    {row.map((preview, previewIndex) => {
                      if (!preview.entry) {
                        const draggingItem = draggingIndex === null ? undefined : items[draggingIndex]
                        return (
                          <div
                            key={`drop-${rowIndex}-${previewIndex}`}
                            className={cn(
                              'rounded-md border-2 border-dashed border-primary/50 bg-primary/10',
                              draggingItem?.type === 'FIELD'
                                ? formItemWidthTypeClasses[getLayoutWidth(draggingIndex!)]
                                : 'md:col-span-12',
                            )}
                          />
                        )
                      }
                      const entry = preview.entry
                      return (
                        <div
                          key={entry.index}
                          data-layout-index={entry.index}
                          draggable={resizing?.index !== entry.index}
                          onDragStart={(event) => {
                            dragCompletedRef.current = false
                            draggingIndexRef.current = entry.index
                            updateDropIndex(null)
                            setDraggingIndex(entry.index)
                            const canvas = event.currentTarget.closest('[data-form-designer-canvas]')
                            const rects = new Map<number, DOMRect>()
                            canvas?.querySelectorAll<HTMLElement>('[data-layout-index]').forEach((element) => {
                              const index = Number(element.dataset.layoutIndex)
                              if (Number.isFinite(index)) rects.set(index, element.getBoundingClientRect())
                            })
                            itemRectsRef.current = rects
                            event.dataTransfer.effectAllowed = 'move'
                            event.dataTransfer.setData('text/plain', String(entry.index))
                          }}
                          onDragEnd={() => finishDrag()}
                          className={cn(
                            'group relative flex cursor-grab items-center rounded-md px-2.5 transition-colors active:cursor-grabbing',
                            entry.kind === 'SECTION'
                              ? 'h-8 border-y border-dashed border-primary/40 bg-primary/10 text-foreground hover:border-primary/60 md:col-span-12'
                              : entry.kind === 'SUBFORM'
                                ? 'min-h-11 border border-primary/40 bg-primary/10 text-foreground hover:border-primary/60 md:col-span-12'
                                : cn(
                                  'border bg-background py-1.5 hover:border-primary',
                                  formItemWidthTypeClasses[getLayoutWidth(entry.index)],
                                ),
                            draggingIndex === entry.index && 'opacity-30',
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground"/>
                            {entry.kind === 'SECTION' && (
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground"/>
                            )}
                            {entry.kind === 'SUBFORM' && (
                              <Table2 className="h-4 w-4 shrink-0 text-primary"/>
                            )}
                            <span className="min-w-0 truncate text-sm font-medium">
                                {entry.kind === 'SECTION'
                                  ? getSectionLabel(entry.item)
                                  : entry.kind === 'SUBFORM'
                                    ? getSubformLabel(entry.item)
                                    : getDisplayLabel(entry)}
                              {entry.kind === 'FIELD' && getItemTip(entry.item) && (
                                <Info className="ml-1 inline-block h-3.5 w-3.5 align-[-2px] text-muted-foreground"/>
                              )}
                              </span>
                            {entry.kind === 'SUBFORM' && (
                              <span className="ml-2 hidden shrink-0 truncate text-xs text-muted-foreground md:block">
                                  {entry.item.formName}
                                </span>
                            )}
                          </div>

                          {entry.kind === 'FIELD' && entry.field.name === form.displayField && (
                            <Badge className="bg-primary/10 text-primary">名称</Badge>
                          )}
                          {entry.kind === 'FIELD' && entry.field.builtin && (
                            <Badge className="bg-primary/10 text-primary">内置</Badge>
                          )}
                          {entry.kind === 'FIELD' && (
                            <span
                              className="ml-auto hidden shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground group-hover:opacity-0 md:block">
                                {typeLabels[entry.field.type]}
                              </span>
                          )}

                          {entry.kind === 'FIELD' && (
                            <div
                              data-resize-handle
                              draggable={false}
                              className={cn(
                                'absolute right-0 top-1/2 z-40 h-10 w-1.5 -translate-y-1/2 cursor-col-resize rounded-full bg-border opacity-0 transition-opacity group-hover:opacity-100',
                                resizing?.index === entry.index && 'touch-none opacity-100',
                              )}
                              onDragStart={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                              }}
                              onPointerDown={(event) => startResize(event, entry.index)}
                            />
                          )}

                          <div
                            className="absolute right-1.5 top-1/2 z-50 hidden -translate-y-1/2 items-center gap-0.5 p-0.5 group-hover:flex">
                            {entry.kind === 'FIELD' && (
                              <WidthSelector
                                value={getLayoutWidth(entry.index)}
                                onChange={(width) => updateLayoutWidth(entry.index, width)}
                              />
                            )}
                            {!(form.builtin && entry.kind === 'SUBFORM') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="修改"
                                onClick={() => entry.kind === 'SECTION'
                                  ? openSectionEdit(entry.index)
                                  : entry.kind === 'SUBFORM'
                                    ? openSubformEdit(entry.index)
                                    : openFieldEdit(entry.index)}
                              >
                                <Pencil className="h-4 w-4"/>
                              </Button>
                            )}
                            {!(form.builtin && entry.kind === 'SUBFORM') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => removeItem(entry.index)}
                              >
                                <X className="h-4 w-4"/>
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
              {items.length === 0 && (
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

            <TabsContent value="display-controls"
                         className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card data-[state=inactive]:hidden">
              <FormAdvancedControls
                rows={layoutItems
                  .filter((entry) => entry.kind === 'FIELD')
                  .map((entry) => ({field: entry.field, label: getDisplayLabel(entry)}))}
                controls={controls}
                onChange={nextControls => {
                  setControls(nextControls)
                  setSaved(false)
                }}
              />
            </TabsContent>
          </div>

          {designTab === 'layout' && (
            <aside
              className="flex h-64 w-full shrink-0 flex-col overflow-hidden rounded-lg border bg-card xl:h-auto xl:w-[280px]">
              <Tabs defaultValue="field-list" className="flex min-h-0 flex-1 flex-col">
              <div className="border-b px-3 pt-3">
                <TabsList className="grid h-9 w-full grid-cols-2 bg-muted/70">
                  <TabsTrigger value="field-list" className="text-xs">字段列表</TabsTrigger>
                  <TabsTrigger value="field-new" className="text-xs">添加字段</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="field-list" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
                {availableFields.map((field) => (
                  <div
                    key={field.name}
                    className="group flex w-full items-center gap-1 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => addField(field.name)}>
                        <span className="block truncate text-sm">{field.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {field.extension
                            ? '扩展'
                            : field.builtin
                              ? '内置字段'
                              : form.builtin && field.locked
                                ? '核心字段'
                                : typeLabels[field.type] ?? field.type}
                        </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive dark:hover:text-destructive-foreground"
                      aria-label={`删除字段「${field.label}」`}
                      title={field.builtin || field.locked ? '系统字段不可删除' : `删除字段「${field.label}」`}
                      disabled={field.builtin || field.locked || isSavingLayout || isDeletingField}
                      onClick={() => {
                        setDeleteFieldError(null);
                        setDeletingField(field)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground"
                            aria-label={`添加字段「${field.label}」到布局`} onClick={() => addField(field.name)}>
                      <Plus className="h-3.5 w-3.5"/>
                    </Button>
                  </div>
                ))}
                {availableFields.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    暂无可布局字段
                  </div>
                )}
              </TabsContent>
              <TabsContent value="field-new" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
                <div className="grid gap-1">
                  {availableFieldTypes.map((fieldType) => {
                    const Icon = fieldType.icon
                    return (
                      <button
                        key={fieldType.type}
                        type="button"
                        className="group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
                        onClick={() => openFieldCreate(fieldType.type, fieldType.label)}
                      >
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                            <Icon className="h-4 w-4"/>
                          </span>
                        <span className="min-w-0 flex-1 truncate text-sm">{fieldType.label}</span>
                        <Plus
                          className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:text-primary group-hover:opacity-100"/>
                      </button>
                    )
                  })}
                </div>
              </TabsContent>
              </Tabs>
            </aside>
          )}
        </div>
      </Tabs>

      <ConfirmDialog
        open={Boolean(deletingField)}
        onOpenChange={open => !open && !isDeletingField && setDeletingField(null)}
        title="删除字段"
        message={<>
          <p>确认删除字段「{deletingField?.label}」吗？删除后，该字段及其数据将无法恢复。</p>
          {deleteFieldError &&
            <p role="alert" className="mt-2 text-destructive dark:text-destructive-foreground">{deleteFieldError}</p>}
        </>}
        busy={isDeletingField}
        confirmText="删除"
        onConfirm={deleteField}
      />

      <BizDialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => !open && !isSavingItem && setEditingItem(null)}
        width={520}
        title={editingItem?.kind === 'section' ? '修改分栏' : '修改字段'}
        footer={
          <>
            <Button variant="secondary" disabled={isSavingItem} onClick={() => setEditingItem(null)}>取消</Button>
            <Button disabled={isSavingItem} onClick={saveEditingItem}>{isSavingItem ? '保存中…' : '保存'}</Button>
          </>
        }
      >
        {editingItem && (
          <fieldset disabled={isSavingItem} className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {editingItem.kind === 'section' ? '分栏名称' : '字段名称'}
              </label>
              <Input
                aria-label={editingItem.kind === 'section' ? '分栏名称' : '字段名称'}
                value={editingItem.kind === 'field' ? editingItem.properties.label : editingItem.label}
                disabled={editingItem.kind === 'field' && (editingItem.field.builtin || editingItem.field.locked)}
                maxLength={100}
                onChange={(event) => editingItem.kind === 'field'
                  ? updateEditingProperties({label: event.target.value})
                  : setEditingItem(previous => previous ? {...previous, label: event.target.value} : previous)}
              />
            </div>
            {editingItem.kind === 'field' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5 text-sm text-foreground">字段类型
                    <Input value={typeLabels[editingItem.field.type] ?? editingItem.field.type} disabled/>
                  </label>
                  <label className="grid gap-1.5 text-sm text-foreground">内部标识
                    <Input value={editingItem.field.name} disabled/>
                  </label>
                </div>
                <label className="grid gap-1.5 text-sm text-foreground">布局显示名称（可选）
                  <Input value={editingItem.label} maxLength={100} placeholder={editingItem.properties.label}
                    onChange={event => setEditingItem(previous => previous ? {...previous, label: event.target.value} : previous)}/>
                </label>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">填写提示</label>
                  <Input
                    aria-label="填写提示"
                    value={editingItem.tip}
                    maxLength={200}
                    placeholder="无"
                    onChange={(event) => setEditingItem((previous) => previous
                      ? {...previous, tip: event.target.value}
                      : previous)}
                  />
                </div>
                {form.builtin && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {([
                      ['readonly', '只读'],
                      ['hidden', '隐藏'],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={editingItem[key]}
                          onCheckedChange={(checked) => setEditingItem((previous) => previous
                            ? {...previous, [key]: checked === true}
                            : previous)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
                {editingItem.field.builtin || editingItem.field.locked ? (
                  <p className="text-xs text-muted-foreground">内置字段仅可调整布局显示名称、填写提示、只读和隐藏。</p>
                ) : <>
                  {editingItem.field.type === 'REFERENCE' && <label className="grid gap-1.5 text-sm text-foreground">引用表单
                    <Select value={editingItem.properties.referenceForm} onValueChange={referenceForm => updateEditingProperties({referenceForm})}>
                      <SelectTrigger><SelectValue placeholder="请选择引用表单"/></SelectTrigger>
                      <SelectContent>{availableForms.map(item => <SelectItem key={item.name} value={item.name}>{item.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </label>}
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox checked={editingItem.properties.required} onCheckedChange={required => updateEditingProperties({required: required === true})}/>必填
                  </label>
                  <FieldConfigEditor type={editingItem.field.type} config={editingItem.properties.config}
                    options={editingItem.properties.options}
                    onChange={config => updateEditingProperties({config})}
                    onOptionsChange={options => updateEditingProperties({options})}/>
                  <p className="text-xs text-muted-foreground">字段属性保存后立即生效；布局设置需点击设计器右上角“保存”。</p>
                </>}
              </>
            )}
            {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
          </fieldset>
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
            <Button onClick={saveFieldCreate}
                    disabled={creatingField?.type === 'REFERENCE' && !creatingField.referenceForm}>保存</Button>
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
                  ? {...previous, label: event.target.value}
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
                  ? {...previous, remark: event.target.value}
                  : previous)}
              />
            </div>
            {creatingField.type === 'REFERENCE' && <label className="grid gap-1.5 text-sm text-foreground">
              引用表单
              <Select value={creatingField.referenceForm} onValueChange={referenceForm => setCreatingField({...creatingField, referenceForm})}>
                <SelectTrigger><SelectValue placeholder="请选择引用表单"/></SelectTrigger>
                <SelectContent>{availableForms.map(item => <SelectItem key={item.name} value={item.name}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </label>}
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={creatingField.required ?? false} onCheckedChange={required => setCreatingField({...creatingField, required: required === true})}/>必填
            </label>
            <FieldConfigEditor type={creatingField.type} config={creatingField.config} options={creatingField.options}
              onChange={config => setCreatingField({...creatingField, config})}
              onOptionsChange={options => setCreatingField({...creatingField, options})}/>
            {fieldError && <p role="alert" className="text-sm text-destructive">{fieldError}</p>}
          </div>
        )}
      </BizDialog>

      <BizDialog
        open={Boolean(subformDraft)}
        onOpenChange={(open) => !open && setSubformDraft(null)}
        width={480}
        title={subformDraft?.index === undefined ? '添加子表单' : '修改子表单'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSubformDraft(null)} disabled={isSavingSubform}>
              取消
            </Button>
            <Button onClick={saveSubform} disabled={isSavingSubform}>
              {isSavingSubform ? '保存中' : '保存'}
            </Button>
          </>
        }
      >
        {subformDraft && (
          <div className="space-y-4">
            {subformError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {subformError}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">展示名称</label>
              <Input
                value={subformDraft.label}
                maxLength={100}
                placeholder={selectedSubformForm?.label ?? '子表单'}
                onChange={(event) => setSubformDraft((previous) => previous
                  ? {...previous, label: event.target.value}
                  : previous)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">子表单</label>
              <Select
                value={subformDraft.formName}
                onValueChange={(value) => setSubformDraft((previous) => previous
                  ? {...previous, formName: value, referenceField: ''}
                  : previous)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择子表单"/>
                </SelectTrigger>
                <SelectContent>
                  {availableForms.map((item) => (
                    <SelectItem key={item.name} value={item.name}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">关联字段</label>
              <Select
                value={subformDraft.referenceField || '__AUTO__'}
                onValueChange={(value) => setSubformDraft((previous) => previous
                  ? {...previous, referenceField: value === '__AUTO__' ? '' : value}
                  : previous)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="自动创建引用字段"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__AUTO__">自动创建引用字段</SelectItem>
                  {subformReferenceFields.map((field) => (
                    <SelectItem key={field.name} value={field.name}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="m-0 text-xs text-muted-foreground">
                可选择子表单中的任意业务字段；该字段将保存主记录 ID。不选择时，保存后将自动在子表单上创建指向当前表单的引用字段。
              </p>
            </div>
          </div>
        )}
      </BizDialog>
    </div>
  )
}

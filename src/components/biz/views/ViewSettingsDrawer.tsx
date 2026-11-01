import * as React from 'react'
import {AlertTriangle, Info} from 'lucide-react'
import {BizDrawer} from '@/components/ui/drawer'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {message} from '@/components/ui/message'
import {ConfirmDialog} from '@/components/ui/dialog'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {type ViewTabConditionDraft, viewTabOperators,} from '@/components/biz/RecordFilterControls'
import {FieldPicker} from '@/components/biz/views/FieldPicker'
import {ViewDisplayFieldsEditor} from '@/components/biz/views/ViewDisplayFieldsEditor'
import {ViewFiltersEditor} from '@/components/biz/views/ViewFiltersEditor'
import {ViewTypeSettings} from '@/components/biz/views/ViewTypeSettings'
import {VIEW_TYPE_META, VIEW_TYPE_ORDER} from '@/components/biz/views/viewRegistry'
import {
  allDisplayFieldNames,
  dateFieldCandidates,
  effectiveDisplayFields,
  kanbanGroupFieldCandidates,
  MAX_VIEW_DISPLAY_FIELDS,
  MAX_VIEW_FILTER_CONDITIONS,
  selfReferenceFieldCandidates,
  viewTypeAvailability,
} from '@/components/biz/views/viewUtils'
import {
  type AppForm,
  type AppFormField,
  type AppFormViewFilter,
  type AppFormViewTab,
  type AppViewConfig,
  type AppViewType,
  patchAppFormViewTabs,
} from '@/services/appForms'
import {cn, toErrorMessage} from '@/lib/utils'

export interface ViewSettingsTarget {
  /** 编辑已有视图；null 表示按 createType 新建 */
  view: AppFormViewTab | null
  createType: AppViewType | null
}

type DisplayMode = 'ALL' | 'CUSTOM'

interface ViewDraft {
  id: string
  label: string
  type: AppViewType
  logic: '_and' | '_or'
  conditions: ViewTabConditionDraft[]
  sortField: string
  sortOrder: 'ASC' | 'DESC'
  displayMode: DisplayMode
  displayFields: string[]
  config: AppViewConfig
}

const SORTABLE_BUILTIN_FIELDS = ['id', 'created_at', 'updated_at']

function optionValueFor(field: AppFormField, value: unknown): unknown {
  if (!field.options?.length) return value
  if (typeof value !== 'string') return value
  const match = field.options.find((option) => option.id === value || option.text === value)
  return match?.id ?? value
}

function conditionsFromFilter(
  filter: AppFormViewFilter | null,
  fieldMap: Map<string, AppFormField>,
): ViewTabConditionDraft[] {
  const list = filter?._and ?? filter?._or ?? []
  return list.map((condition) => {
    const fieldName = Object.keys(condition)[0]
    const operator = Object.keys(condition[fieldName])[0] as ViewTabConditionDraft['operator']
    const field = fieldMap.get(fieldName)
    const value = condition[fieldName][operator]
    return {
      fieldName,
      operator,
      value: field ? optionValueFor(field, value) as ViewTabConditionDraft['value'] : value,
    }
  }).filter((condition) => Boolean(condition.fieldName))
}

function draftFromView(form: AppForm, view: AppFormViewTab): ViewDraft {
  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const filter = view.filter
  return {
    id: view.id,
    label: view.label,
    type: view.type,
    logic: filter?._or ? '_or' : '_and',
    conditions: conditionsFromFilter(filter, fieldMap),
    sortField: view.sort?.field ?? '',
    sortOrder: view.sort?.order ?? 'DESC',
    displayMode: view.displayFields.length ? 'CUSTOM' : 'ALL',
    displayFields: view.displayFields.length ? [...view.displayFields] : effectiveDisplayFields(form, view),
    config: {...view.config},
  }
}

function uniqueLabel(base: string, usedLabels: Set<string>): string {
  let label = base
  let index = 2
  while (usedLabels.has(label)) {
    label = `${base}${index}`
    index++
  }
  return label
}

function draftForCreate(form: AppForm, type: AppViewType): ViewDraft {
  const meta = VIEW_TYPE_META[type]
  const usedLabels = new Set(form.viewTabs.map((view) => view.label))
  return {
    id: crypto.randomUUID(),
    label: uniqueLabel(`${meta.label}视图`, usedLabels),
    type,
    logic: '_and',
    conditions: [],
    sortField: '',
    sortOrder: 'DESC',
    displayMode: 'ALL',
    displayFields: allDisplayFieldNames(form),
    config: meta.defaultConfig(form),
  }
}

function draftKey(draft: ViewDraft): string {
  return JSON.stringify({
    label: draft.label.trim(),
    type: draft.type,
    logic: draft.logic,
    conditions: draft.conditions,
    sortField: draft.sortField,
    sortOrder: draft.sortOrder,
    displayMode: draft.displayMode,
    displayFields: draft.displayMode === 'CUSTOM' ? draft.displayFields : [],
    config: draft.config,
  })
}

function toViewFilter(
  logic: '_and' | '_or',
  conditions: ViewTabConditionDraft[],
  fieldMap: Map<string, AppFormField>,
): AppFormViewFilter | null {
  if (!conditions.length) return null
  const list = conditions.map((condition) => {
    const field = fieldMap.get(condition.fieldName)!
    let value: unknown = condition.value
    if (field.type === 'NUMBER' || field.type === 'DECIMAL') {
      value = Number(value)
    } else if (field.type === 'BOOL') {
      value = value === true || value === 'true'
    } else if (typeof value === 'string') {
      value = value.trim()
    }
    return {[field.name]: {[condition.operator]: value}}
  })
  return {[logic]: list} as AppFormViewFilter
}

function Section({
                   id,
                   title,
                   description,
                   invalid,
                   sectionRef,
                   children,
                 }: {
  id: string
  title: React.ReactNode
  description?: React.ReactNode
  invalid?: boolean
  sectionRef: (node: HTMLElement | null) => void
  children: React.ReactNode
}) {
  return (
    <section
      ref={sectionRef}
      id={`view-settings-${id}`}
      className={cn(
        'space-y-3 rounded-xl border bg-card p-4 transition-colors',
        invalid && 'border-destructive/60 ring-1 ring-destructive/20',
      )}
    >
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export function ViewSettingsDrawer({
                                     open,
                                     onOpenChange,
                                     appId,
                                     form,
                                     target,
                                     onSaved,
                                   }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appId: string
  form: AppForm
  target: ViewSettingsTarget
  onSaved: (form: AppForm, viewId: string) => void
}) {
  const isCreate = !target.view
  const [draft, setDraft] = React.useState<ViewDraft | null>(null)
  const [initialKey, setInitialKey] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [errorSection, setErrorSection] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const sectionRefs = React.useRef<Record<string, HTMLElement | null>>({})

  React.useEffect(() => {
    if (!open) return
    const nextDraft = target.view
      ? draftFromView(form, target.view)
      : draftForCreate(form, target.createType ?? 'TABLE')
    setDraft(nextDraft)
    setInitialKey(draftKey(nextDraft))
    setError(null)
    setErrorSection(null)
    setDiscardOpen(false)
  }, [open, target, form])

  if (!draft) return null

  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const filterFields = form.fields.filter((field) => !field.builtin)
  const sortFields = [
    ...filterFields,
    ...SORTABLE_BUILTIN_FIELDS
      .map((name) => fieldMap.get(name))
      .filter((field): field is AppFormField => Boolean(field)),
  ]
  const availability = viewTypeAvailability(form)
  const typeMeta = VIEW_TYPE_META[draft.type]
  const dirty = draftKey(draft) !== initialKey

  const update = (patch: Partial<ViewDraft>) => {
    setDraft((previous) => previous ? {...previous, ...patch} : previous)
    setError(null)
    setErrorSection(null)
  }
  const updateConfig = (config: AppViewConfig) => update({config})

  const switchType = (type: AppViewType) => {
    if (type === draft.type) return
    update({type, config: VIEW_TYPE_META[type].defaultConfig(form)})
  }

  const scrollToSection = (section: string | null) => {
    if (!section) return
    window.setTimeout(() => {
      sectionRefs.current[section]?.scrollIntoView({behavior: 'smooth', block: 'start'})
    }, 0)
  }

  const fail = (messageText: string, section: string) => {
    setError(messageText)
    setErrorSection(section)
    scrollToSection(section)
  }

  const validate = (): boolean => {
    const label = draft.label.trim()
    if (!label || label.length > 32) {
      fail('视图名称不能为空，且不能超过 32 个字符', 'base')
      return false
    }
    if (form.viewTabs.some((view) => view.id !== draft.id && view.label === label)) {
      fail(`视图名称重复：${label}`, 'base')
      return false
    }
    if (draft.conditions.length > MAX_VIEW_FILTER_CONDITIONS) {
      fail(`筛选条件最多 ${MAX_VIEW_FILTER_CONDITIONS} 个`, 'filter')
      return false
    }
    for (const condition of draft.conditions) {
      const field = fieldMap.get(condition.fieldName)
      if (!field) {
        fail('筛选条件包含不存在的字段，请重新选择', 'filter')
        return false
      }
      if (!viewTabOperators(field).includes(condition.operator)) {
        fail(`「${field.label}」不支持当前筛选操作符`, 'filter')
        return false
      }
      if (condition.value === '' || condition.value === null || condition.value === undefined) {
        fail(`请填写「${field.label}」的筛选值`, 'filter')
        return false
      }
      if ((field.type === 'NUMBER' || field.type === 'DECIMAL') && !Number.isFinite(Number(condition.value))) {
        fail(`「${field.label}」需要有效的数字筛选值`, 'filter')
        return false
      }
      if (field.options?.length && !field.options.some((option) =>
        option.id === condition.value || (option.id == null && option.text === condition.value))) {
        fail(`请重新选择「${field.label}」的选项值`, 'filter')
        return false
      }
    }
    if (draft.sortField && !fieldMap.has(draft.sortField)) {
      fail('默认排序字段不存在，请重新选择', 'sort')
      return false
    }
    if (draft.displayMode === 'CUSTOM') {
      if (!draft.displayFields.length) {
        fail('自定义显示字段至少选择 1 个', 'display')
        return false
      }
      if (draft.displayFields.length > MAX_VIEW_DISPLAY_FIELDS) {
        fail(`显示字段不能超过 ${MAX_VIEW_DISPLAY_FIELDS} 个`, 'display')
        return false
      }
      if (draft.displayFields.some((name) => !fieldMap.has(name))) {
        fail('显示字段包含已删除的字段，请重新选择', 'display')
        return false
      }
    }
    const configError = validateConfig(draft, form)
    if (configError) {
      fail(configError, 'type')
      return false
    }
    return true
  }

  const save = async () => {
    if (!validate()) return
    setIsSaving(true)
    try {
      const label = draft.label.trim()
      const filter = toViewFilter(draft.logic, draft.conditions, fieldMap)
      const sort = draft.sortField ? {field: draft.sortField, order: draft.sortOrder} : null
      const nextView: AppFormViewTab = {
        id: draft.id,
        label,
        type: draft.type,
        filter,
        sort,
        displayFields: draft.displayMode === 'CUSTOM' ? draft.displayFields : [],
        config: draft.config,
      }
      const nextTabs = isCreate
        ? [...form.viewTabs, nextView]
        : form.viewTabs.map((view) => (view.id === nextView.id ? nextView : view))
      const updatedForm = await patchAppFormViewTabs(appId, form.name, nextTabs)
      message.success(isCreate ? '视图创建成功' : '视图已保存')
      setIsSaving(false)
      onSaved(updatedForm, nextView.id)
      onOpenChange(false)
    } catch (caught: unknown) {
      setError(toErrorMessage(caught, '保存视图失败'))
      setErrorSection(null)
      setIsSaving(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true)
      return
    }
    if (isSaving) return
    if (dirty) {
      setDiscardOpen(true)
      return
    }
    onOpenChange(false)
  }

  return (
    <>
      <BizDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title={isCreate ? `新增${typeMeta.label}视图` : `设置视图：${draft.label}`}
        width="w-[min(94vw,560px)]"
        footer={
          <>
            <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={isSaving}>取消</Button>
            <Button onClick={() => void save()} disabled={isSaving}>{isSaving ? '保存中…' : '保存'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div
              className="sticky top-0 z-20 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive shadow-sm"
              role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>
              <span className="min-w-0 flex-1">{error}</span>
            </div>
          )}

          <Section
            id="base"
            title="基本信息"
            description="名称用于页签展示；类型决定专属配置和展示方式。"
            invalid={errorSection === 'base'}
            sectionRef={(node) => {
              sectionRefs.current.base = node
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="view-name" className="text-sm">视图名称</Label>
              <Input
                id="view-name"
                autoFocus
                value={draft.label}
                maxLength={32}
                placeholder="视图名称"
                onChange={(event) => update({label: event.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">视图类型</Label>
              <Select value={draft.type} onValueChange={(value) => switchType(value as AppViewType)}>
                <SelectTrigger className="h-9 w-full" aria-label="视图类型"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {VIEW_TYPE_ORDER.map((type) => {
                    const meta = VIEW_TYPE_META[type]
                    const state = availability[type]
                    const disabled = !state.enabled && type !== draft.type
                    return (
                      <SelectItem key={type} value={type} disabled={disabled}>
                        {meta.label}{disabled && state.reason ? `（${state.reason}）` : ''}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{typeMeta.description}。切换类型会重置专属设置。</p>
            </div>
          </Section>

          {draft.type !== 'TABLE' && (
            <Section
              id="type"
              title={`${typeMeta.label}专属设置`}
              description="必填项缺失时无法保存。"
              invalid={errorSection === 'type'}
              sectionRef={(node) => {
                sectionRefs.current.type = node
              }}
            >
              <ViewTypeSettings form={form} type={draft.type} config={draft.config} onChange={updateConfig}/>
            </Section>
          )}

          <Section
            id="filter"
            title="数据筛选"
            description="视图筛选会与关键词、临时高级查询同时生效。"
            invalid={errorSection === 'filter'}
            sectionRef={(node) => {
              sectionRefs.current.filter = node
            }}
          >
            <ViewFiltersEditor
              fields={filterFields}
              logic={draft.logic}
              conditions={draft.conditions}
              onChange={({logic, conditions}) => update({logic, conditions})}
            />
          </Section>

          <Section
            id="sort"
            title="默认排序"
            description="未设置时按创建时间倒序；分页会追加记录 ID 保证稳定。"
            invalid={errorSection === 'sort'}
            sectionRef={(node) => {
              sectionRefs.current.sort = node
            }}
          >
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px]">
              <FieldPicker
                fields={sortFields}
                value={draft.sortField || null}
                allowEmpty
                emptyLabel="创建时间倒序"
                placeholder="选择排序字段"
                onChange={(fieldName) => update({sortField: fieldName ?? ''})}
              />
              <Select
                value={draft.sortOrder}
                onValueChange={(order) => update({sortOrder: order as 'ASC' | 'DESC'})}
                disabled={!draft.sortField}
              >
                <SelectTrigger className="h-9 w-full" aria-label="排序方向"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASC">升序</SelectItem>
                  <SelectItem value="DESC">降序</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section
            id="display"
            title="显示字段"
            description="只影响表格列、卡片摘要等区域，完整详情仍使用表单布局。"
            invalid={errorSection === 'display'}
            sectionRef={(node) => {
              sectionRefs.current.display = node
            }}
          >
            <ViewDisplayFieldsEditor
              form={form}
              fields={filterFields}
              mode={draft.displayMode}
              selected={draft.displayFields}
              onModeChange={(mode) => {
                if (mode === 'CUSTOM') {
                  update({
                    displayMode: mode,
                    displayFields: draft.displayFields.length ? draft.displayFields : allDisplayFieldNames(form),
                  })
                } else {
                  update({displayMode: mode})
                }
              }}
              onSelectedChange={(names) => update({displayFields: names})}
            />
          </Section>

          <p className="flex items-start gap-1.5 pb-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0"/>
            共享配置在点击“保存”后生效；搜索、临时排序、展开状态等浏览操作不会写入视图配置。
          </p>
        </div>
      </BizDrawer>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="放弃未保存的修改"
        message="当前视图配置存在未保存的修改，关闭后将丢失。确定继续吗？"
        confirmText="放弃修改"
        onConfirm={() => {
          setDiscardOpen(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}

function validateConfig(draft: ViewDraft, form: AppForm): string | null {
  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const exists = (name: string | null | undefined) => !!name && fieldMap.has(name)
  const config = draft.config
  const validateOptionalField = (name: string | null | undefined, label: string) => {
    if (name && !fieldMap.has(name)) return `${label}不存在，请重新选择`
    return null
  }
  switch (draft.type) {
    case 'KANBAN': {
      if (!exists(config.groupField)) return '看板视图需要选择分组字段'
      const groupField = fieldMap.get(config.groupField!)!
      if (!kanbanGroupFieldCandidates(form).some((field) => field.name === groupField.name)) {
        return '看板分组字段类型不支持'
      }
      const titleError = validateOptionalField(config.titleField, '看板标题字段')
      if (titleError) return titleError
      break
    }
    case 'CALENDAR': {
      if (!exists(config.startField)) return '日历视图需要选择开始字段'
      const startField = fieldMap.get(config.startField!)!
      if (!dateFieldCandidates(form).some((field) => field.name === startField.name)) {
        return '日历开始字段必须是日期或日期时间'
      }
      if (config.endField) {
        const endField = fieldMap.get(config.endField)
        if (!endField) return '日历结束字段不存在'
        if (endField.type !== startField.type) return '日历开始与结束字段必须同为日期或日期时间'
      }
      const titleError = validateOptionalField(config.titleField, '日历标题字段')
      if (titleError) return titleError
      break
    }
    case 'GALLERY': {
      if (config.coverField) {
        const coverField = fieldMap.get(config.coverField)
        if (!coverField) return '画廊封面字段不存在'
        if (!['FILE', 'IMAGE', 'AVATAR'].includes(coverField.type)) return '画廊封面字段必须是附件、图片或头像字段'
      }
      const titleError = validateOptionalField(config.titleField, '画廊标题字段')
      if (titleError) return titleError
      break
    }
    case 'HIERARCHY': {
      if (!exists(config.parentField)) return '层级视图需要选择本表引用字段'
      if (!selfReferenceFieldCandidates(form).some((field) => field.name === config.parentField)) {
        return '层级父节点字段必须是关联本表单的引用字段'
      }
      const titleError = validateOptionalField(config.titleField, '层级标题字段')
      if (titleError) return titleError
      break
    }
    case 'GANTT': {
      if (!exists(config.startField) || !exists(config.endField)) return '甘特视图需要选择开始与结束字段'
      if (config.startField === config.endField) return '甘特开始与结束不能是同一个字段'
      const startField = fieldMap.get(config.startField!)!
      const endField = fieldMap.get(config.endField!)!
      if (!dateFieldCandidates(form).some((field) => field.name === startField.name)
        || !dateFieldCandidates(form).some((field) => field.name === endField.name)) {
        return '甘特开始与结束字段必须是日期或日期时间'
      }
      if (startField.type !== endField.type) return '甘特开始与结束字段类型必须一致'
      const titleError = validateOptionalField(config.titleField, '甘特标题字段')
      if (titleError) return titleError
      break
    }
    default:
      break
  }
  return null
}

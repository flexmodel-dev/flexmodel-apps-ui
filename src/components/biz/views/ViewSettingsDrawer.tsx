import * as React from 'react'
import {Trash2} from 'lucide-react'
import {BizDrawer} from '@/components/ui/drawer'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Checkbox} from '@/components/ui/checkbox'
import {Label} from '@/components/ui/label'
import {message} from '@/components/ui/message'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from '@/components/ui/select'
import {
  ConditionValueControl,
  type ViewTabConditionDraft,
  viewTabOperatorLabels,
  viewTabOperators,
} from '@/components/biz/RecordFilterControls'
import {
  attachmentFieldCandidates,
  dateFieldCandidates,
  kanbanGroupFieldCandidates,
  selfReferenceFieldCandidates,
  titleFieldCandidates,
  VIEW_TYPE_META,
  VIEW_TYPE_ORDER,
} from '@/components/biz/views/viewRegistry'
import {
  type AppForm,
  type AppFormField,
  type AppFormViewFilter,
  type AppFormViewTab,
  type AppViewCalendarUnit,
  type AppViewConfig,
  type AppViewDetailMode,
  type AppViewGanttScale,
  type AppViewHierarchyMode,
  type AppViewImageFit,
  type AppViewType,
  patchAppFormViewTabs,
} from '@/services/appForms'
import {cn, toErrorMessage} from '@/lib/utils'

export interface ViewSettingsTarget {
  /** 编辑已有视图；null 表示按 createType 新建 */
  view: AppFormViewTab | null
  createType: AppViewType | null
}

interface ViewDraft {
  id: string
  label: string
  type: AppViewType
  logic: '_and' | '_or'
  conditions: ViewTabConditionDraft[]
  sortField: string
  sortOrder: 'ASC' | 'DESC'
  displayFields: string[]
  config: AppViewConfig
}

const SORTABLE_BUILTIN_FIELDS = ['id', 'created_at', 'updated_at']

function conditionsFromFilter(filter: AppFormViewFilter | null): ViewTabConditionDraft[] {
  const list = filter?._and ?? filter?._or ?? []
  return list.map((condition) => {
    const fieldName = Object.keys(condition)[0]
    const operator = Object.keys(condition[fieldName])[0] as ViewTabConditionDraft['operator']
    return {fieldName, operator, value: condition[fieldName][operator]}
  }).filter((condition) => Boolean(condition.fieldName))
}

function draftFromView(view: AppFormViewTab): ViewDraft {
  const filter = view.filter
  return {
    id: view.id,
    label: view.label,
    type: view.type,
    logic: filter?._or ? '_or' : '_and',
    conditions: conditionsFromFilter(filter),
    sortField: view.sort?.field ?? '',
    sortOrder: view.sort?.order ?? 'DESC',
    displayFields: [...view.displayFields],
    config: {...view.config},
  }
}

function draftForCreate(type: AppViewType, usedLabels: Set<string>): ViewDraft {
  const base = `${VIEW_TYPE_META[type].label}视图`
  let label = base
  let index = 2
  while (usedLabels.has(label)) {
    label = `${base}${index}`
    index++
  }
  return {
    id: crypto.randomUUID(),
    label,
    type,
    logic: '_and',
    conditions: [],
    sortField: '',
    sortOrder: 'DESC',
    displayFields: [],
    config: VIEW_TYPE_META[type].defaultConfig(),
  }
}

function SectionTitle({children}: { children: React.ReactNode }) {
  return <div className="pt-2 text-sm font-medium text-foreground">{children}</div>
}

function FieldRow({label, children, hint}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Label className="w-24 shrink-0 text-right text-muted-foreground">{label}</Label>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {children}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>
  )
}

function FieldSelect({
                       fields,
                       value,
                       onChange,
                       placeholder = '请选择',
                       allowEmpty,
                     }: {
  fields: AppFormField[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  allowEmpty?: boolean
}) {
  const normalized = value == null ? (allowEmpty ? 'none' : '') : value
  return (
    <Select value={normalized} onValueChange={(next) => onChange(!next || next === 'none' ? null : next)}>
      <SelectTrigger className="h-8 w-[200px]">
        <SelectValue placeholder={placeholder}/>
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value="none">不设置</SelectItem>}
        {fields.map((field) => (
          <SelectItem key={field.name} value={field.name}>{field.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  const [draft, setDraft] = React.useState<ViewDraft | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const isCreate = !target.view

  React.useEffect(() => {
    if (!open) return
    setError(null)
    const usedLabels = new Set(form.viewTabs.map((view) => view.label))
    setDraft(target.view ? draftFromView(target.view) : draftForCreate(target.createType ?? 'TABLE', usedLabels))
  }, [open, target, form])

  if (!draft) return null

  const filterFields = form.fields.filter((field) => !field.builtin)
  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const titleFields = titleFieldCandidates(form)
  const dateFields = dateFieldCandidates(form)
  const groupFields = kanbanGroupFieldCandidates(form)
  const coverFields = attachmentFieldCandidates(form)
  const parentFields = selfReferenceFieldCandidates(form)
  const sortFields = [
    ...filterFields,
    ...SORTABLE_BUILTIN_FIELDS.map((name) => fieldMap.get(name)).filter((field): field is AppFormField => Boolean(field)),
  ]

  const update = (patch: Partial<ViewDraft>) => setDraft((previous) => previous ? {...previous, ...patch} : previous)
  const updateConfig = (patch: Partial<AppViewConfig>) =>
    setDraft((previous) => previous ? {...previous, config: {...previous.config, ...patch}} : previous)

  const switchType = (type: AppViewType) => {
    // 切换类型保留名称、筛选、排序与显示字段，重填目标类型专属配置
    update({type, config: VIEW_TYPE_META[type].defaultConfig()})
  }

  const toggleDisplayField = (name: string, checked: boolean) => {
    update({
      displayFields: checked
        ? [...draft.displayFields, name]
        : draft.displayFields.filter((item) => item !== name),
    })
  }

  const updateCondition = (index: number, condition: ViewTabConditionDraft) => {
    update({conditions: draft.conditions.map((item, i) => (i === index ? condition : item))})
  }

  const validate = (): string | null => {
    const label = draft.label.trim()
    if (!label || label.length > 32) return '视图名称不能为空，且不能超过 32 个字符'
    const others = form.viewTabs.filter((view) => view.id !== draft.id)
    if (others.some((view) => view.label === label)) return `视图名称重复：${label}`
    if (draft.conditions.length > 10) return '筛选条件最多 10 个'
    const conditionError = draft.conditions.find((condition) => {
      const field = fieldMap.get(condition.fieldName)
      return !field || !viewTabOperators(field).includes(condition.operator) || condition.value === '' || condition.value == null
    })
    if (conditionError) {
      const field = fieldMap.get(conditionError.fieldName)
      return `筛选条件无效：${field?.label ?? conditionError.fieldName}`
    }
    switch (draft.type) {
      case 'KANBAN':
        if (!draft.config.groupField) return '看板视图需要选择分组字段'
        break
      case 'CALENDAR': {
        if (!draft.config.startField) return '日历视图需要选择开始字段'
        const start = fieldMap.get(draft.config.startField)
        if (draft.config.endField) {
          const end = fieldMap.get(draft.config.endField)
          if (start?.type !== end?.type) return '日历开始与结束字段必须同为日期或日期时间'
        }
        break
      }
      case 'HIERARCHY':
        if (!draft.config.parentField) return '层级视图需要选择本表引用字段'
        break
      case 'GANTT': {
        if (!draft.config.startField || !draft.config.endField) return '甘特视图需要选择开始与结束字段'
        const start = fieldMap.get(draft.config.startField)
        const end = fieldMap.get(draft.config.endField)
        if (start?.type !== end?.type) return '甘特开始与结束字段类型必须一致'
        break
      }
      default:
        break
    }
    return null
  }

  const save = async () => {
    const validation = validate()
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      const label = draft.label.trim()
      const filter: AppFormViewFilter | null = draft.conditions.length
        ? {[draft.logic]: draft.conditions.map((condition) => ({[condition.fieldName]: {[condition.operator]: condition.value}}))}
        : null
      const sort = draft.sortField ? {field: draft.sortField, order: draft.sortOrder} : null
      const nextView: AppFormViewTab = {
        id: draft.id,
        label,
        type: draft.type,
        filter,
        sort,
        displayFields: draft.displayFields,
        config: draft.config,
      }
      const nextTabs: AppFormViewTab[] = isCreate
        ? [...form.viewTabs, nextView]
        : form.viewTabs.map((view) => (view.id === nextView.id ? nextView : view))
      const updatedForm = await patchAppFormViewTabs(appId, form.name, nextTabs)
      message.success(isCreate ? '视图创建成功' : '视图已保存')
      onSaved(updatedForm, nextView.id)
      onOpenChange(false)
    } catch (caught: unknown) {
      setError(toErrorMessage(caught, '保存视图失败'))
    } finally {
      setIsSaving(false)
    }
  }

  const typeMeta = VIEW_TYPE_META[draft.type]

  return (
    <BizDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isCreate ? `新增${typeMeta.label}视图` : `设置视图：${draft.label}`}
      width="w-[min(92vw,480px)]"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>取消</Button>
          <Button onClick={() => void save()} disabled={isSaving}>{isSaving ? '保存中…' : '保存'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</div>
        )}
        <FieldRow label="视图名称">
          <Input
            value={draft.label}
            onChange={(event) => update({label: event.target.value})}
            className="h-8 w-[240px]"
            placeholder="视图名称"
            maxLength={32}
          />
        </FieldRow>
        {!isCreate && (
          <FieldRow label="视图类型">
            <Select value={draft.type} onValueChange={(value) => switchType(value as AppViewType)}>
              <SelectTrigger className="h-8 w-[200px]">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                {VIEW_TYPE_ORDER.map((type) => (
                  <SelectItem key={type} value={type}>{VIEW_TYPE_META[type].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        )}

        <SectionTitle>数据筛选</SectionTitle>
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">筛选满足</span>
            <Select value={draft.logic} onValueChange={(logic) => update({logic: logic as '_and' | '_or'})}>
              <SelectTrigger className="h-8 w-28"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="_and">全部条件</SelectItem>
                <SelectItem value="_or">任一条件</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">的记录，可不设置条件</span>
          </div>
          {draft.conditions.map((condition, index) => {
            const field = fieldMap.get(condition.fieldName)
            return (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={condition.fieldName}
                  onValueChange={(fieldName) => updateCondition(index, {
                    fieldName,
                    operator: '_eq',
                    value: fieldMap.get(fieldName)?.type === 'BOOL' ? false : '',
                  })}
                >
                  <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="字段"/></SelectTrigger>
                  <SelectContent>
                    {filterFields.map((item) => <SelectItem key={item.name}
                                                            value={item.name}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {field && (
                  <>
                    <Select
                      value={condition.operator}
                      onValueChange={(operator) => updateCondition(index, {
                        ...condition,
                        operator: operator as ViewTabConditionDraft['operator']
                      })}
                    >
                      <SelectTrigger className="h-8 w-[110px]"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {viewTabOperators(field).map((operator) => (
                          <SelectItem key={operator} value={operator}>{viewTabOperatorLabels[operator]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ConditionValueControl
                      field={field}
                      value={condition.value}
                      onChange={(value) => updateCondition(index, {...condition, value})}
                    />
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`删除条件 ${index + 1}`}
                  onClick={() => update({conditions: draft.conditions.filter((_, i) => i !== index)})}
                >
                  <Trash2 className="h-4 w-4"/>
                </Button>
              </div>
            )
          })}
          {filterFields.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              disabled={draft.conditions.length >= 10}
              onClick={() => update({
                conditions: [...draft.conditions, {
                  fieldName: filterFields[0].name,
                  operator: '_eq',
                  value: filterFields[0].type === 'BOOL' ? false : '',
                }]
              })}
            >
              添加条件
            </Button>
          )}
        </div>

        <SectionTitle>默认排序</SectionTitle>
        <FieldRow label="排序字段">
          <FieldSelect
            fields={sortFields}
            value={draft.sortField || null}
            onChange={(value) => update({sortField: value ?? ''})}
            placeholder="创建时间倒序"
            allowEmpty
          />
          <Select
            value={draft.sortOrder}
            onValueChange={(order) => update({sortOrder: order as 'ASC' | 'DESC'})}
            disabled={!draft.sortField}
          >
            <SelectTrigger className="h-8 w-[100px]"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="ASC">升序</SelectItem>
              <SelectItem value="DESC">降序</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <SectionTitle>显示字段（卡片摘要等区域，详情仍使用表单布局）</SectionTitle>
        <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 md:grid-cols-3">
          {filterFields.map((field) => (
            <label key={field.name} className="flex items-center gap-2 text-sm" title={field.label}>
              <Checkbox
                checked={draft.displayFields.includes(field.name)}
                onCheckedChange={(checked) => toggleDisplayField(field.name, checked === true)}
              />
              <span className="truncate">{field.label}</span>
            </label>
          ))}
        </div>

        <>
          <SectionTitle>{typeMeta.label}专属设置</SectionTitle>
          <div className="space-y-3 rounded-lg border p-3">
            {draft.type === 'KANBAN' && (
              <>
                <FieldRow label="分组字段">
                  <FieldSelect fields={groupFields} value={draft.config.groupField ?? null}
                               onChange={(value) => updateConfig({groupField: value})}/>
                </FieldRow>
                <FieldRow label="卡片标题">
                  <FieldSelect fields={titleFields} value={draft.config.titleField ?? null}
                               onChange={(value) => updateConfig({titleField: value})} allowEmpty
                               placeholder="使用主显字段"/>
                </FieldRow>
              </>
            )}
            {draft.type === 'CALENDAR' && (
              <>
                <FieldRow label="开始字段">
                  <FieldSelect fields={dateFields} value={draft.config.startField ?? null}
                               onChange={(value) => updateConfig({startField: value})}/>
                </FieldRow>
                <FieldRow label="结束字段">
                  <FieldSelect fields={dateFields} value={draft.config.endField ?? null}
                               onChange={(value) => updateConfig({endField: value})} allowEmpty placeholder="可选"/>
                </FieldRow>
                <FieldRow label="标题字段">
                  <FieldSelect fields={titleFields} value={draft.config.titleField ?? null}
                               onChange={(value) => updateConfig({titleField: value})} allowEmpty
                               placeholder="使用主显字段"/>
                </FieldRow>
                <FieldRow label="默认周期">
                  <Select value={draft.config.calendarUnit ?? 'MONTH'}
                          onValueChange={(unit) => updateConfig({calendarUnit: unit as AppViewCalendarUnit})}>
                    <SelectTrigger className="h-8 w-[120px]"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTH">月</SelectItem>
                      <SelectItem value="WEEK">周</SelectItem>
                      <SelectItem value="DAY">日</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              </>
            )}
            {draft.type === 'GALLERY' && (
              <>
                <FieldRow label="封面字段">
                  <FieldSelect fields={coverFields} value={draft.config.coverField ?? null}
                               onChange={(value) => updateConfig({coverField: value})} allowEmpty placeholder="可选"/>
                </FieldRow>
                <FieldRow label="标题字段">
                  <FieldSelect fields={titleFields} value={draft.config.titleField ?? null}
                               onChange={(value) => updateConfig({titleField: value})} allowEmpty
                               placeholder="使用主显字段"/>
                </FieldRow>
                <FieldRow label="图片裁切">
                  <Select value={draft.config.imageFit ?? 'COVER'}
                          onValueChange={(fit) => updateConfig({imageFit: fit as AppViewImageFit})}>
                    <SelectTrigger className="h-8 w-[120px]"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COVER">裁切填满</SelectItem>
                      <SelectItem value="CONTAIN">完整显示</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              </>
            )}
            {draft.type === 'DETAIL' && (
              <FieldRow label="展示模式">
                <Select value={draft.config.detailMode ?? 'LIST'}
                        onValueChange={(mode) => updateConfig({detailMode: mode as AppViewDetailMode})}>
                  <SelectTrigger className="h-8 w-[200px]"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LIST">列表 + 详情</SelectItem>
                    <SelectItem value="SINGLE">仅显示第一条详情</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
            )}
            {draft.type === 'HIERARCHY' && (
              <>
                <FieldRow label="父节点字段">
                  {parentFields.length ? (
                    <FieldSelect fields={parentFields} value={draft.config.parentField ?? null}
                                 onChange={(value) => updateConfig({parentField: value})}/>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                        当前表单暂无关联本表单的引用字段，请先在表单设计中添加一个“关联记录”字段并选择本表单
                      </span>
                  )}
                </FieldRow>
                <FieldRow label="展示形态">
                  <Select value={draft.config.hierarchyMode ?? 'TREE'}
                          onValueChange={(mode) => updateConfig({hierarchyMode: mode as AppViewHierarchyMode})}>
                    <SelectTrigger className="h-8 w-[120px]"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TREE">层级树</SelectItem>
                      <SelectItem value="TABLE">树形表格</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              </>
            )}
            {draft.type === 'GANTT' && (
              <>
                <FieldRow label="开始字段">
                  <FieldSelect fields={dateFields} value={draft.config.startField ?? null}
                               onChange={(value) => updateConfig({startField: value})}/>
                </FieldRow>
                <FieldRow label="结束字段">
                  <FieldSelect fields={dateFields} value={draft.config.endField ?? null}
                               onChange={(value) => updateConfig({endField: value})}/>
                </FieldRow>
                <FieldRow label="标题字段">
                  <FieldSelect fields={titleFields} value={draft.config.titleField ?? null}
                               onChange={(value) => updateConfig({titleField: value})} allowEmpty
                               placeholder="使用主显字段"/>
                </FieldRow>
                <FieldRow label="默认刻度">
                  <Select value={draft.config.ganttScale ?? 'WEEK'}
                          onValueChange={(scale) => updateConfig({ganttScale: scale as AppViewGanttScale})}>
                    <SelectTrigger className="h-8 w-[120px]"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAY">日</SelectItem>
                      <SelectItem value="WEEK">周</SelectItem>
                      <SelectItem value="MONTH">月</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              </>
            )}
          </div>
        </>
        <p className={cn('text-xs text-muted-foreground')}>
          {typeMeta.description}。共享配置在点击“保存”后生效。
        </p>
      </div>
    </BizDrawer>
  )
}

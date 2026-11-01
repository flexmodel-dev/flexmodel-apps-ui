import * as React from 'react'
import {AlertTriangle} from 'lucide-react'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import type {
  AppForm,
  AppFormField,
  AppViewCalendarUnit,
  AppViewConfig,
  AppViewDetailMode,
  AppViewGanttScale,
  AppViewHierarchyMode,
  AppViewImageFit,
  AppViewType,
} from '@/services/appForms'
import {FieldPicker} from '@/components/biz/views/FieldPicker'
import {
  attachmentFieldCandidates,
  dateFieldCandidates,
  kanbanGroupFieldCandidates,
  selfReferenceFieldCandidates,
  titleFieldCandidates,
} from '@/components/biz/views/viewUtils'

function SettingRow({label, hint, children}: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium text-foreground">{label}</div>
      {children}
      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  )
}

function MissingFieldHint({children}: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0"/>
      <span>{children}</span>
    </div>
  )
}

/** 各视图类型的专属配置。字段选项已按类型过滤，避免保存后才发现不合法。 */
export function ViewTypeSettings({
                                   form,
                                   type,
                                   config,
                                   onChange,
                                 }: {
  form: AppForm
  type: AppViewType
  config: AppViewConfig
  onChange: (next: AppViewConfig) => void
}) {
  const titleFields = titleFieldCandidates(form)
  const dateFields = dateFieldCandidates(form)
  const groupFields = kanbanGroupFieldCandidates(form)
  const coverFields = attachmentFieldCandidates(form)
  const parentFields = selfReferenceFieldCandidates(form)
  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))

  const changeStart = (fieldName: string | null) => {
    const start = fieldName ? fieldMap.get(fieldName) : undefined
    const currentEnd = config.endField ? fieldMap.get(config.endField) : undefined
    let endField = config.endField ?? null
    if (endField && start && currentEnd?.type !== start.type) endField = null
    if (!endField && start) {
      const candidate = dateFields.find((field) => field.name !== start.name && field.type === start.type)
      endField = candidate?.name ?? null
    }
    onChange({...config, startField: fieldName, endField})
  }

  const changeEnd = (fieldName: string | null) => {
    const start = config.startField ? fieldMap.get(config.startField) : undefined
    const end = fieldName ? fieldMap.get(fieldName) : undefined
    if (start && end && start.type !== end.type) return
    onChange({...config, endField: fieldName})
  }

  const sameTypeEndFields: AppFormField[] = config.startField
    ? dateFields.filter((field) => field.name !== config.startField && field.type === fieldMap.get(config.startField ?? '')?.type)
    : dateFields

  if (type === 'TABLE') return null

  return (
    <div className="space-y-4">
      {type === 'KANBAN' && (
        <>
          <SettingRow label="分组字段" hint="决定看板列，空值会进入“未分组”；拖拽卡片会修改该字段。">
            {groupFields.length ? (
              <FieldPicker
                fields={groupFields}
                value={config.groupField ?? null}
                onChange={(fieldName) => onChange({...config, groupField: fieldName})}
              />
            ) : (
              <MissingFieldHint>表单还没有可用于分组的选项、布尔或关联字段。</MissingFieldHint>
            )}
          </SettingRow>
          <SettingRow label="卡片标题">
            <FieldPicker
              fields={titleFields}
              value={config.titleField ?? null}
              allowEmpty
              emptyLabel="使用主显字段"
              onChange={(fieldName) => onChange({...config, titleField: fieldName})}
            />
          </SettingRow>
        </>
      )}

      {type === 'CALENDAR' && (
        <>
          {!dateFields.length && <MissingFieldHint>表单还没有日期或日期时间字段，无法配置日历。</MissingFieldHint>}
          <SettingRow label="开始字段" hint="事件按该字段定位，拖拽会修改开始时间。">
            <FieldPicker
              fields={dateFields}
              value={config.startField ?? null}
              onChange={changeStart}
            />
          </SettingRow>
          <SettingRow label="结束字段" hint="可选；必须与开始字段同为日期或日期时间。">
            <FieldPicker
              fields={sameTypeEndFields}
              value={config.endField ?? null}
              allowEmpty
              emptyLabel="不设置结束字段"
              onChange={changeEnd}
            />
          </SettingRow>
          <SettingRow label="标题字段">
            <FieldPicker
              fields={titleFields}
              value={config.titleField ?? null}
              allowEmpty
              emptyLabel="使用主显字段"
              onChange={(fieldName) => onChange({...config, titleField: fieldName})}
            />
          </SettingRow>
          <SettingRow label="默认周期">
            <Select
              value={config.calendarUnit ?? 'MONTH'}
              onValueChange={(unit) => onChange({...config, calendarUnit: unit as AppViewCalendarUnit})}
            >
              <SelectTrigger className="h-9 w-full" aria-label="日历默认周期"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTH">月</SelectItem>
                <SelectItem value="WEEK">周</SelectItem>
                <SelectItem value="DAY">日</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </>
      )}

      {type === 'GALLERY' && (
        <>
          <SettingRow label="封面字段" hint="可选；没有图片时显示统一占位。">
            <FieldPicker
              fields={coverFields}
              value={config.coverField ?? null}
              allowEmpty
              emptyLabel="不使用封面"
              onChange={(fieldName) => onChange({...config, coverField: fieldName})}
            />
          </SettingRow>
          <SettingRow label="标题字段">
            <FieldPicker
              fields={titleFields}
              value={config.titleField ?? null}
              allowEmpty
              emptyLabel="使用主显字段"
              onChange={(fieldName) => onChange({...config, titleField: fieldName})}
            />
          </SettingRow>
          <SettingRow label="图片裁切">
            <Select
              value={config.imageFit ?? 'COVER'}
              onValueChange={(fit) => onChange({...config, imageFit: fit as AppViewImageFit})}
            >
              <SelectTrigger className="h-9 w-full" aria-label="图片裁切方式"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="COVER">裁切填满</SelectItem>
                <SelectItem value="CONTAIN">完整显示</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </>
      )}

      {type === 'DETAIL' && (
        <SettingRow label="展示模式">
          <Select
            value={config.detailMode ?? 'LIST'}
            onValueChange={(mode) => onChange({...config, detailMode: mode as AppViewDetailMode})}
          >
            <SelectTrigger className="h-9 w-full" aria-label="详情展示模式"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="LIST">列表 + 详情</SelectItem>
              <SelectItem value="SINGLE">仅显示第一条详情</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      )}

      {type === 'HIERARCHY' && (
        <>
          <SettingRow label="父节点字段" hint="必须是关联本表单的单条引用字段；不支持跨表层级。">
            {parentFields.length ? (
              <FieldPicker
                fields={parentFields}
                value={config.parentField ?? null}
                onChange={(fieldName) => onChange({...config, parentField: fieldName})}
              />
            ) : (
              <MissingFieldHint>
                当前表单暂无关联本表单的引用字段，请先在表单设计中添加一个“关联记录”字段并选择本表单。
              </MissingFieldHint>
            )}
          </SettingRow>
          <SettingRow label="展示形态" hint="层级树适合浏览结构，树形表格适合同时查看多个字段。">
            <Select
              value={config.hierarchyMode ?? 'TREE'}
              onValueChange={(mode) => onChange({...config, hierarchyMode: mode as AppViewHierarchyMode})}
            >
              <SelectTrigger className="h-9 w-full" aria-label="层级展示形态"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="TREE">层级树</SelectItem>
                <SelectItem value="TABLE">树形表格</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </>
      )}

      {type === 'GANTT' && (
        <>
          {dateFields.length < 2 && <MissingFieldHint>甘特视图至少需要两个同类型的日期字段。</MissingFieldHint>}
          <SettingRow label="开始字段">
            <FieldPicker
              fields={dateFields}
              value={config.startField ?? null}
              onChange={changeStart}
            />
          </SettingRow>
          <SettingRow label="结束字段" hint="必须与开始字段类型一致，且不能早于开始。">
            <FieldPicker
              fields={sameTypeEndFields}
              value={config.endField ?? null}
              onChange={changeEnd}
            />
          </SettingRow>
          <SettingRow label="标题字段">
            <FieldPicker
              fields={titleFields}
              value={config.titleField ?? null}
              allowEmpty
              emptyLabel="使用主显字段"
              onChange={(fieldName) => onChange({...config, titleField: fieldName})}
            />
          </SettingRow>
          <SettingRow label="默认刻度" hint="浏览时可以在工具栏临时切换，不会修改视图配置。">
            <Select
              value={config.ganttScale ?? 'WEEK'}
              onValueChange={(scale) => onChange({...config, ganttScale: scale as AppViewGanttScale})}
            >
              <SelectTrigger className="h-9 w-full" aria-label="甘特默认刻度"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="DAY">日</SelectItem>
                <SelectItem value="WEEK">周</SelectItem>
                <SelectItem value="MONTH">月</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </>
      )}
    </div>
  )
}

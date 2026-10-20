import * as React from 'react'
import {
  BarChart3,
  ClipboardCheck,
  Gauge,
  LineChart,
  PieChart,
  Star,
  Table2,
  type LucideIcon,
} from 'lucide-react'
import {BizDialog} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {Input} from '@/components/ui/input'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {AppLoading} from '@/components/biz/AppLoading'
import {ComponentCanvas} from '@/components/biz/ComponentCanvas'
import {getAppForms, type AppForm, type AppFormField} from '@/services/appForms'
import {getAppMenus, type AppMenu} from '@/services/appMenus'
import {menuIcon} from '@/services/appMenuNavigation'
import {
  WORKBENCH_GRID_COLUMNS,
  WORKBENCH_MAX_GRID_HEIGHT,
  type WorkbenchComponent,
  type WorkbenchComponentConfig,
  type WorkbenchComponentData,
  type WorkbenchComponentType,
  type WorkbenchAggregationType,
  type WorkbenchChartType,
  type WorkbenchPaletteType,
} from '@/services/workbenches'
import {cn} from '@/lib/utils'

const componentTypeIcons: Record<string, LucideIcon> = {
  metric: Gauge,
  'chart-line': LineChart,
  'chart-bar': BarChart3,
  'chart-pie': PieChart,
  dataloader: Table2,
  shortcuts: Star,
  tasks: ClipboardCheck,
}

const componentTypes: Array<{
  type: WorkbenchComponentType
  chartType?: WorkbenchChartType
  label: string
  description: string
  w: number
  h: number
}> = [
  {type: 'metric', label: '指标', description: '突出展示核心指标', w: 3, h: 3},
  {type: 'chart', chartType: 'line', label: '折线图', description: '观察数据趋势', w: 6, h: 4},
  {type: 'chart', chartType: 'bar', label: '柱状图', description: '比较分组数据', w: 6, h: 4},
  {type: 'chart', chartType: 'pie', label: '饼图', description: '展示分组占比', w: 4, h: 4},
  {type: 'dataloader', label: '明细', description: '查看表单记录', w: 12, h: 5},
  {type: 'shortcuts', label: '快捷入口', description: '直达表单菜单', w: 6, h: 3},
  {type: 'tasks', label: '我的任务', description: '查看流程待办', w: 4, h: 4},
]

export interface ComponentDesignerResult {
  title: string
  type: WorkbenchComponentType
  w: number
  h: number
  config: DesignerConfig
}

export type SavedComponentDesignerResult = Omit<ComponentDesignerResult, 'config'> & {
  config: WorkbenchComponentConfig
}

interface DesignerConfig {
  type: WorkbenchComponentType
  chartType: WorkbenchChartType
  formName: string
  dimensionField: string
  measureField: string
  aggregation: WorkbenchAggregationType
  showLegend: boolean
  showLabel: boolean
  smooth: boolean
  palette: WorkbenchPaletteType
  metricField: string | null
  visibleColumns: string[]
  shortcuts: string[]
  columnsPerRow: number
}

type ComponentTypeOption = (typeof componentTypes)[number]

interface ComponentDesignerProps {
  appId: string
  open: boolean
  mode: 'create' | 'edit'
  component?: WorkbenchComponent
  onSave: (result: SavedComponentDesignerResult) => void
  onClose: () => void
}

const dataComponentTypes = new Set<WorkbenchComponentType>([
  'metric',
  'chart',
  'dataloader',
])

function isMeasureField(field: AppFormField) {
  return field.type === 'NUMBER' || field.type === 'DECIMAL'
}

function flattenMenus(menus: AppMenu[]): AppMenu[] {
  return menus.flatMap((menu) => [menu, ...flattenMenus(menu.children ?? [])])
}

function baseConfig(form: AppForm | undefined): DesignerConfig {
  const measureField = form?.fields.find(isMeasureField)?.name
  return {
    type: 'chart',
    chartType: 'line',
    formName: form?.name ?? '',
    dimensionField: form?.displayField || form?.fields[0]?.name || '',
    measureField: measureField || '',
    aggregation: measureField ? 'sum' : 'count',
    showLegend: false,
    showLabel: true,
    smooth: true,
    palette: 'primary',
    metricField: null,
    visibleColumns: form?.fields.slice(0, 6).map((field) => field.name) ?? [],
    shortcuts: [],
    columnsPerRow: 2,
  }
}

function toDesignerConfig(
  config: WorkbenchComponentConfig | undefined,
  fallbackForm: AppForm | undefined,
): DesignerConfig {
  const base = baseConfig(fallbackForm)
  if (!config) return base
  switch (config.type) {
    case 'metric':
      return {
        ...base,
        type: 'metric',
        formName: config.formName,
        aggregation: config.aggregation ?? 'count',
        metricField: config.aggregation === 'count' || !config.aggregation
          ? null
          : (config.field ?? null),
      }
    case 'chart':
      return {
        ...base,
        type: 'chart',
        chartType: config.chartType,
        formName: config.formName,
        dimensionField: config.dimensionField,
        measureField: config.measureField ?? base.measureField,
        aggregation: config.aggregation,
        showLegend: config.showLegend,
        showLabel: config.showLabel,
        ...(config.chartType === 'line' ? {smooth: config.smooth} : {}),
        palette: config.palette,
      }
    case 'dataloader':
      return {
        ...base,
        type: 'dataloader',
        formName: config.formName,
        visibleColumns: config.visibleColumns,
      }
    case 'shortcuts':
      return {
        ...base,
        type: 'shortcuts',
        shortcuts: config.shortcuts,
        columnsPerRow: config.columnsPerRow,
      }
    case 'tasks':
      return {...base, type: 'tasks'}
  }
}

function optionKey(option: ComponentTypeOption) {
  return option.chartType ? `chart-${option.chartType}` : option.type
}

function resultOptionKey(result: ComponentDesignerResult) {
  return result.type === 'chart' ? `chart-${result.config.chartType}` : result.type
}

function selectedOption(config: DesignerConfig): ComponentTypeOption {
  const key = config.type === 'chart' ? `chart-${config.chartType}` : config.type
  return componentTypes.find((item) => optionKey(item) === key) ?? componentTypes[1]
}

function toWorkbenchConfig(result: ComponentDesignerResult): WorkbenchComponentConfig {
  const config = result.config
  switch (result.type) {
    case 'metric':
      return {
        type: 'metric',
        formName: config.formName,
        aggregation: config.aggregation,
        field: config.aggregation === 'count' ? null : config.metricField,
      }
    case 'chart':
      return {
        type: 'chart',
        chartType: config.chartType,
        formName: config.formName,
        dimensionField: config.dimensionField,
        measureField: config.aggregation === 'count' ? null : config.measureField,
        aggregation: config.aggregation,
        showLegend: config.showLegend,
        showLabel: config.showLabel,
        ...(config.chartType === 'line' ? {smooth: config.smooth} : {}),
        palette: config.palette,
      }
    case 'dataloader':
      return {
        type: 'dataloader',
        formName: config.formName,
        visibleColumns: config.visibleColumns,
      }
    case 'shortcuts':
      return {
        type: 'shortcuts',
        shortcuts: config.shortcuts,
        columnsPerRow: config.columnsPerRow,
      }
    case 'tasks':
      return {type: 'tasks'}
  }
}

function toResult(
  component: WorkbenchComponent | undefined,
  fallbackForm?: AppForm,
): ComponentDesignerResult {
  const config = toDesignerConfig(component?.config, fallbackForm)
  const preset = selectedOption(config)
  return {
    title: component?.title ?? preset.label,
    type: preset.type,
    w: component?.placement.w ?? preset.w,
    h: component?.placement.h ?? preset.h,
    config,
  }
}

export function ComponentDesigner({
                                    appId,
                                    open,
                                    mode,
                                    component,
                                    onSave,
                                    onClose,
                                  }: ComponentDesignerProps) {
  const [forms, setForms] = React.useState<AppForm[]>([])
  const [menus, setMenus] = React.useState<AppMenu[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ComponentDesignerResult>(() =>
    toResult(component),
  )
  const [titleError, setTitleError] = React.useState('')
  const previewStageRef = React.useRef<HTMLDivElement | null>(null)
  const [previewStageSize, setPreviewStageSize] = React.useState({width: 0, height: 0})

  React.useEffect(() => {
    if (!open) return
    const stageElement = previewStageRef.current
    if (!stageElement) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setPreviewStageSize({width: rect.width, height: rect.height})
    })
    observer.observe(stageElement)
    return () => observer.disconnect()
  }, [open])

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    Promise.all([getAppForms(appId), getAppMenus(appId)])
      .then(([loadedForms, loadedMenus]) => {
        if (cancelled) return
        setForms(loadedForms)
        setMenus(loadedMenus)
        setResult(toResult(component, loadedForms[0]))
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setLoadError(caught instanceof Error ? caught.message : '加载配置失败。')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, component, open])

  const updateResult = (patch: Partial<ComponentDesignerResult>) => {
    setResult((previous) => ({...previous, ...patch}))
  }

  const updateConfig = (patch: Partial<DesignerConfig>) => {
    setResult((previous) => ({...previous, config: {...previous.config, ...patch}}))
  }

  const changeType = (preset: ComponentTypeOption) => {
    const selectedForm = forms.find((form) => form.name === result.config.formName) ?? forms[0]
    const nextBase = baseConfig(selectedForm)
    setResult((previous) => ({
      ...previous,
      type: preset.type,
      title:
        !previous.title.trim() ||
        previous.title.trim() === selectedOption(previous.config).label
          ? preset.label
          : previous.title,
      w: preset.w,
      h: preset.h,
      config: {
        ...nextBase,
        type: preset.type,
        chartType: preset.chartType ?? nextBase.chartType,
        aggregation: preset.type === 'metric' ? 'count' : nextBase.aggregation,
        metricField: null,
        showLegend: preset.chartType === 'pie',
        palette: preset.chartType === 'pie' ? 'multi' : 'primary',
      },
    }))
  }

  const changeForm = (formName: string) => {
    const nextConfig = baseConfig(forms.find((form) => form.name === formName))
    updateConfig({
      formName: nextConfig.formName,
      dimensionField: nextConfig.dimensionField,
      measureField: nextConfig.measureField,
      aggregation: nextConfig.aggregation,
      metricField: result.type === 'metric' && result.config.aggregation !== 'count'
        ? nextConfig.measureField || null
        : null,
      visibleColumns: nextConfig.visibleColumns,
    })
  }

  const save = () => {
    const title = result.title.trim()
    if (!title) {
      setTitleError('请输入组件标题')
      return
    }
    if (result.w < 1 || result.w > WORKBENCH_GRID_COLUMNS || result.h < 1 || result.h > WORKBENCH_MAX_GRID_HEIGHT) {
      return
    }
    onSave({...result, title, config: toWorkbenchConfig(result)})
  }

  const selectedForm = forms.find((form) => form.name === result.config.formName)
  const formMenus = flattenMenus(menus).filter(
    (menu) => menu.type === 'ITEM' && menu.target?.type === 'FORM',
  )
  const shortcutTargets = formMenus.map((menu) => ({
    id: menu.id,
    label: menu.name,
    to: menu.pageRoute ?? `/apps/${appId}/${menu.id}`,
    icon: menuIcon(menu.iconName),
  }))
  const previewComponent: WorkbenchComponent = {
    id: component?.id ?? 'preview',
    title: result.title || '未命名组件',
    placement: {x: 0, y: 0, w: result.w, h: result.h},
    config: toWorkbenchConfig(result),
  }
  const previewData: WorkbenchComponentData | null = result.type === 'metric'
    ? {type: 'metric', value: 128}
    : result.type === 'chart'
      ? {
        type: 'chart',
        rows: [
          {dimension: '示例一', value: 32},
          {dimension: '示例二', value: 56},
          {dimension: '示例三', value: 24},
        ],
      }
      : result.type === 'dataloader'
        ? {type: 'dataloader', list: [], total: 0}
        : null
  const previewColumns = (selectedForm?.fields ?? []).map((field) => ({
    name: field.name,
    label: field.label,
  }))
  const selectedComponentType = componentTypes.find(
    (item) => optionKey(item) === resultOptionKey(result),
  ) ?? componentTypes[1]
  const previewRowHeight = 80
  const previewWidthUnits = Math.min(Math.max(result.w || 1, 1), WORKBENCH_GRID_COLUMNS)
  const previewHeightUnits = Math.min(Math.max(result.h || 1, 1), WORKBENCH_MAX_GRID_HEIGHT)
  const previewHeight = previewHeightUnits * previewRowHeight
  const previewScale =
    previewStageSize.height > 0 ? Math.min(1, previewStageSize.height / previewHeight) : 1
  const previewWidth = `${(previewWidthUnits / WORKBENCH_GRID_COLUMNS) * 100}%`

  return (
    <BizDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={mode === 'create' ? '新增组件' : '编辑组件'}
      width={1680}
      height="min(92vh, 960px)"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={save} disabled={isLoading || Boolean(loadError)}>保存</Button>
        </>
      }
    >
      {isLoading ? (
        <AppLoading className="min-h-[320px]"/>
      ) : loadError ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : (
        <div className="grid h-full min-h-0 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Tabs defaultValue="basic" className="min-h-0 rounded-xl border border-border bg-card p-4">
            <TabsList className="grid h-9 w-full grid-cols-4 rounded-lg bg-muted p-1">
              <TabsTrigger value="basic">基础</TabsTrigger>
              <TabsTrigger value="data">数据</TabsTrigger>
              <TabsTrigger value="style">样式</TabsTrigger>
              <TabsTrigger value="layout">布局</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="mt-5 space-y-4">
              <div>
                <span className="text-xs font-medium text-muted-foreground">组件类型</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {componentTypes.map((item) => {
                    const key = optionKey(item)
                    const Icon = componentTypeIcons[key]
                    const selected = resultOptionKey(result) === key
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => changeType(item)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/50',
                          selected ? 'border-primary bg-primary/5 text-primary' : 'border-border text-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
                            selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <Icon className="h-4 w-4"/>
                        </span>
                        <span className="truncate text-sm font-medium">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {selectedComponentType.description}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">组件标题</label>
                <Input
                  value={result.title}
                  placeholder="请输入组件标题"
                  onChange={(event) => {
                    setTitleError('')
                    updateResult({title: event.target.value})
                  }}
                />
                {titleError ? <p className="mt-1 text-xs text-destructive">{titleError}</p> : null}
              </div>
            </TabsContent>

            <TabsContent value="data" className="mt-4 space-y-4">
              {dataComponentTypes.has(result.type) ? (
                <>
                  <div>
                    <span className="text-sm font-medium text-foreground">数据表单</span>
                    <Select value={result.config.formName} onValueChange={changeForm}>
                      <SelectTrigger className="mt-2"><SelectValue placeholder="请选择表单"/></SelectTrigger>
                      <SelectContent>
                        {forms.map((form) => (
                          <SelectItem key={form.name} value={form.name}>{form.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {result.type === 'chart' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <span className="text-sm font-medium text-foreground">分组字段</span>
                      <Select
                        value={result.config.dimensionField || undefined}
                        onValueChange={(value) => updateConfig({dimensionField: value})}
                      >
                        <SelectTrigger className="mt-2"><SelectValue placeholder="请选择字段"/></SelectTrigger>
                        <SelectContent>
                          {(selectedForm?.fields ?? []).map((field) => (
                            <SelectItem key={field.name} value={field.name}>{field.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                      <>
                        <div>
                          <span className="text-sm font-medium text-foreground">聚合方式</span>
                          <Select
                            value={result.config.aggregation || 'count'}
                            onValueChange={(value) =>
                              updateConfig({aggregation: value as 'count' | 'sum' | 'avg'})
                            }
                          >
                            <SelectTrigger className="mt-2"><SelectValue/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="count">记录数</SelectItem>
                              <SelectItem value="sum">求和</SelectItem>
                              <SelectItem value="avg">平均值</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {result.config.aggregation !== 'count' ? (
                          <div>
                            <span className="text-sm font-medium text-foreground">指标字段</span>
                            <Select
                              value={result.config.measureField || undefined}
                              onValueChange={(value) => updateConfig({measureField: value})}
                            >
                              <SelectTrigger className="mt-2"><SelectValue placeholder="请选择字段"/></SelectTrigger>
                              <SelectContent>
                                {(selectedForm?.fields ?? []).filter(isMeasureField).map((field) => (
                                  <SelectItem key={field.name} value={field.name}>{field.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}
                      </>
                  </div>
                  ) : null}
                  {result.type === 'metric' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <span className="text-sm font-medium text-foreground">聚合方式</span>
                        <Select
                          value={result.config.aggregation || 'count'}
                          onValueChange={(value) => updateConfig({
                            aggregation: value as WorkbenchAggregationType,
                            metricField: value === 'count' ? null : (result.config.metricField ?? ''),
                          })}
                        >
                          <SelectTrigger className="mt-2"><SelectValue/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="count">记录数</SelectItem>
                            <SelectItem value="sum">求和</SelectItem>
                            <SelectItem value="avg">平均值</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {result.config.aggregation !== 'count' ? (
                        <div>
                          <span className="text-sm font-medium text-foreground">指标字段</span>
                          <Select
                            value={result.config.metricField || undefined}
                            onValueChange={(value) => updateConfig({metricField: value})}
                          >
                            <SelectTrigger className="mt-2"><SelectValue placeholder="请选择字段"/></SelectTrigger>
                            <SelectContent>
                              {(selectedForm?.fields ?? []).filter(isMeasureField).map((field) => (
                                <SelectItem key={field.name} value={field.name}>{field.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {result.type === 'dataloader' ? (
                    <div>
                      <span className="text-sm font-medium text-foreground">显示列</span>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {(selectedForm?.fields ?? []).map((field) => {
                          const checked = (result.config.visibleColumns ?? []).includes(field.name)
                          return (
                            <label
                              key={field.name}
                              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => {
                                  const next = new Set(result.config.visibleColumns ?? [])
                                  if (checked) next.delete(field.name)
                                  else next.add(field.name)
                                  updateConfig({visibleColumns: [...next]})
                                }}
                              />
                              {field.label}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : result.type === 'shortcuts' ? (
                <div>
                  <span className="text-sm font-medium text-foreground">快捷入口</span>
                  <div className="mt-2">
                    <span className="text-sm font-medium text-foreground">每行数量</span>
                    <Select
                      value={String(result.config.columnsPerRow ?? 2)}
                      onValueChange={(value) => updateConfig({columnsPerRow: Number(value)})}
                    >
                      <SelectTrigger className="mt-2"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 12}, (_, index) => index + 1).map((count) => (
                          <SelectItem key={count} value={String(count)}>{count} 个</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {formMenus.map((menu) => {
                      const checked = (result.config.shortcuts ?? []).includes(menu.id)
                      return (
                        <label
                          key={menu.id}
                          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => {
                              const next = new Set(result.config.shortcuts ?? [])
                              if (checked) next.delete(menu.id)
                              else next.add(menu.id)
                              updateConfig({shortcuts: [...next]})
                            }}
                          />
                          {menu.name}
                        </label>
                      )
                    })}
                    {!formMenus.length ? (
                      <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
                        暂无可关联的表单菜单。
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                  该组件当前使用系统任务数据，无需配置数据源。
                </div>
              )}
            </TabsContent>

            <TabsContent value="style" className="mt-4 space-y-3">
              {result.type === 'chart' ? (
                <>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={result.config.showLegend ?? false}
                      onCheckedChange={(checked) => updateConfig({showLegend: Boolean(checked)})}
                    />
                    显示图例
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={result.config.showLabel ?? false}
                      onCheckedChange={(checked) => updateConfig({showLabel: Boolean(checked)})}
                    />
                    显示数值标签
                  </label>
                  {result.config.chartType === 'line' ? (
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={result.config.smooth ?? false}
                        onCheckedChange={(checked) => updateConfig({smooth: Boolean(checked)})}
                      />
                      平滑曲线
                    </label>
                  ) : null}
                  <div>
                    <span className="text-sm font-medium text-foreground">配色</span>
                    <Select
                      value={result.config.palette ?? 'primary'}
                      onValueChange={(value) => updateConfig({palette: value as 'primary' | 'multi'})}
                    >
                      <SelectTrigger className="mt-2"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">主色</SelectItem>
                        <SelectItem value="multi">多色</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                  该组件暂无样式配置。
                </div>
              )}
            </TabsContent>

            <TabsContent value="layout" className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="component-width">宽度（1-12）</label>
                  <Input
                    id="component-width"
                    className="mt-2"
                    type="number"
                    min={1}
                    max={WORKBENCH_GRID_COLUMNS}
                    value={result.w}
                    onChange={(event) => updateResult({w: Number(event.target.value)})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="component-height">高度（1-24）</label>
                  <Input
                    id="component-height"
                    className="mt-2"
                    type="number"
                    min={1}
                    max={WORKBENCH_MAX_GRID_HEIGHT}
                    value={result.h}
                    onChange={(event) => updateResult({h: Number(event.target.value)})}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                宽高以网格单元保存；编辑配置后可直接在工作台拖动和缩放组件。
              </p>
            </TabsContent>
          </Tabs>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/40">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {React.createElement(componentTypeIcons[resultOptionKey(result)], {className: 'h-4 w-4'})}
                </span>
                <h4 className="truncate text-sm font-semibold text-foreground">{previewComponent.title}</h4>
              </div>
              <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                {result.w}/12 · {result.h}行
              </span>
            </div>
            <div ref={previewStageRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">
              <div
                className="overflow-hidden rounded-xl border border-border bg-background shadow-sm"
                style={{
                  width: previewWidth,
                  height: previewHeight,
                  transform: `scale(${previewScale})`,
                }}
              >
                <ComponentCanvas
                  component={previewComponent}
                  data={previewData}
                  columns={previewColumns}
                  shortcutTargets={shortcutTargets}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </BizDialog>
  )
}

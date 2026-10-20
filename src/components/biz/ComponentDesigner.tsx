import * as React from 'react'
import {
  BarChart3,
  ClipboardCheck,
  Gauge,
  LineChart,
  PieChart,
  Star,
  Table2,
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
  type WorkbenchComponentType,
  type WorkbenchLayoutItem,
} from '@/services/workbenches'
import {kpiOptions} from '@/data/mock'
import {cn} from '@/lib/utils'

const componentTypeIcons = {
  index: Gauge,
  line: LineChart,
  bar: BarChart3,
  pie: PieChart,
  dataloader: Table2,
  shortcuts: Star,
  tasks: ClipboardCheck,
}

const componentTypes: Array<{
  type: WorkbenchComponentType
  label: string
  description: string
  w: number
  h: number
}> = [
  {type: 'index', label: '指标', description: '突出展示核心指标', w: 3, h: 3},
  {type: 'line', label: '折线图', description: '观察数据趋势', w: 6, h: 4},
  {type: 'bar', label: '柱状图', description: '比较分组数据', w: 6, h: 4},
  {type: 'pie', label: '饼图', description: '展示分组占比', w: 4, h: 4},
  {type: 'dataloader', label: '明细', description: '查看表单记录', w: 12, h: 5},
  {type: 'shortcuts', label: '快捷入口', description: '直达表单菜单', w: 6, h: 3},
  {type: 'tasks', label: '我的任务', description: '查看流程待办', w: 4, h: 4},
]

export interface ComponentDesignerResult {
  title: string
  type: WorkbenchComponentType
  w: number
  h: number
  config: WorkbenchComponentConfig
}

interface ComponentDesignerProps {
  appId: string
  open: boolean
  mode: 'create' | 'edit'
  component?: WorkbenchComponent
  item?: WorkbenchLayoutItem
  onSave: (result: ComponentDesignerResult) => void
  onClose: () => void
}

const dataComponentTypes = new Set<WorkbenchComponentType>([
  'index',
  'line',
  'bar',
  'pie',
  'dataloader',
])

function isMeasureField(field: AppFormField) {
  return field.type === 'NUMBER' || field.type === 'DECIMAL'
}

function flattenMenus(menus: AppMenu[]): AppMenu[] {
  return menus.flatMap((menu) => [menu, ...flattenMenus(menu.children ?? [])])
}

function firstFormConfig(form: AppForm | undefined): WorkbenchComponentConfig {
  if (!form) return {}
  const measureField = form.fields.find(isMeasureField)?.name
  return {
    formName: form.name,
    dimensionField: form.displayField || form.fields[0]?.name || '',
    measureField: measureField ?? '',
    aggregation: measureField ? 'sum' as const : 'count' as const,
    visibleColumns: form.fields.slice(0, 6).map((field) => field.name),
  }
}

function toResult(
  component: WorkbenchComponent | undefined,
  item: WorkbenchLayoutItem | undefined,
  fallbackForm?: AppForm,
): ComponentDesignerResult {
  const type = component?.type ?? 'line'
  const preset = componentTypes.find((item) => item.type === type) ?? componentTypes[1]
  const config = component?.config ?? {
    ...firstFormConfig(fallbackForm),
    showLegend: type === 'pie',
    showLabel: type !== 'line',
    smooth: type === 'line',
    palette: type === 'pie' ? 'multi' : 'primary',
    metric: kpiOptions[0]?.id,
    shortcuts: [],
    columnsPerRow: 2,
  }
  return {
    title: component?.title ?? preset.label,
    type,
    w: item?.w ?? preset.w,
    h: item?.h ?? preset.h,
    config,
  }
}

export function ComponentDesigner({
                                    appId,
                                    open,
                                    mode,
                                    component,
                                    item,
                                    onSave,
                                    onClose,
                                  }: ComponentDesignerProps) {
  const [forms, setForms] = React.useState<AppForm[]>([])
  const [menus, setMenus] = React.useState<AppMenu[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ComponentDesignerResult>(() =>
    toResult(component, item),
  )
  const [titleError, setTitleError] = React.useState('')

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
        setResult(toResult(component, item, loadedForms[0]))
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setLoadError(caught instanceof Error ? caught.message : '加载配置失败。')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [appId, component, item, open])

  const updateResult = (patch: Partial<ComponentDesignerResult>) => {
    setResult((previous) => ({...previous, ...patch}))
  }

  const updateConfig = (patch: WorkbenchComponentConfig) => {
    setResult((previous) => ({...previous, config: {...previous.config, ...patch}}))
  }

  const changeType = (type: WorkbenchComponentType) => {
    const preset = componentTypes.find((item) => item.type === type)
    if (!preset) return
    const selectedForm = forms.find((form) => form.name === result.config.formName) ?? forms[0]
    setResult((previous) => ({
      ...previous,
      type,
      title:
        !previous.title.trim() ||
        previous.title.trim() === componentTypes.find((item) => item.type === previous.type)?.label
          ? preset.label
          : previous.title,
      w: preset.w,
      h: preset.h,
      config: {
        ...firstFormConfig(selectedForm),
        showLegend: type === 'pie',
        showLabel: type !== 'line',
        smooth: type === 'line',
        palette: type === 'pie' ? 'multi' : 'primary',
        metric: previous.config.metric ?? kpiOptions[0]?.id,
        shortcuts: [],
        columnsPerRow: 2,
      },
    }))
  }

  const changeForm = (formName: string) => {
    updateConfig(firstFormConfig(forms.find((form) => form.name === formName)))
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
    const config: WorkbenchComponentConfig = {}
    if (dataComponentTypes.has(result.type)) {
      config.formName = result.config.formName
      config.dimensionField = result.config.dimensionField
      config.measureField = result.config.measureField
      config.aggregation = result.config.aggregation
      if (result.type === 'index') config.metric = result.config.metric
      if (result.type === 'dataloader') config.visibleColumns = result.config.visibleColumns ?? []
    }
    if (result.type === 'line' || result.type === 'bar' || result.type === 'pie') {
      config.showLegend = result.config.showLegend ?? false
      config.showLabel = result.config.showLabel ?? false
      config.smooth = result.config.smooth ?? false
      config.palette = result.config.palette ?? 'primary'
    }
    if (result.type === 'shortcuts') {
      config.shortcuts = result.config.shortcuts ?? []
      config.columnsPerRow = result.config.columnsPerRow ?? 2
    }
    onSave({...result, title, config})
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
    type: result.type,
    config: result.config,
  }
  const previewColumns = (selectedForm?.fields ?? []).map((field) => ({
    name: field.name,
    label: field.label,
  }))

  return (
    <BizDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={mode === 'create' ? '新增组件' : '编辑组件'}
      width={1080}
      height="min(82vh, 760px)"
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
        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Tabs defaultValue="basic" className="min-h-0">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">基础</TabsTrigger>
              <TabsTrigger value="data">数据</TabsTrigger>
              <TabsTrigger value="style">样式</TabsTrigger>
              <TabsTrigger value="layout">布局</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">组件标题</label>
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
              <div className="grid gap-2 sm:grid-cols-2">
                {componentTypes.map((item) => {
                  const Icon = componentTypeIcons[item.type]
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => changeType(item.type)}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/50',
                        result.type === item.type && 'border-primary bg-primary/5',
                      )}
                    >
                      <Icon className="mt-0.5 h-4 w-4 text-primary"/>
                      <span>
                        <span className="block text-sm font-medium text-foreground">{item.label}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                      </span>
                    </button>
                  )
                })}
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
                    {result.type !== 'dataloader' ? (
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
                    ) : null}
                  </div>
                  {result.type === 'index' ? (
                    <div>
                      <span className="text-sm font-medium text-foreground">指标模板</span>
                      <Select
                        value={result.config.metric}
                        onValueChange={(value) => updateConfig({metric: value})}
                      >
                        <SelectTrigger className="mt-2"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {kpiOptions.map((metric) => (
                            <SelectItem key={metric.id} value={metric.id}>{metric.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
              {result.type === 'line' || result.type === 'bar' || result.type === 'pie' ? (
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
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={result.config.smooth ?? false}
                      onCheckedChange={(checked) => updateConfig({smooth: Boolean(checked)})}
                    />
                    平滑曲线
                  </label>
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

          <div className="min-h-0 overflow-hidden rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex h-full min-h-[320px] flex-col">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">{previewComponent.title}</h4>
                <span className="text-xs text-muted-foreground">
                  {result.w}/12 · {result.h}行
                </span>
              </div>
              <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background p-4">
                <ComponentCanvas
                  component={previewComponent}
                  refreshKey={0}
                  filter="全部"
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

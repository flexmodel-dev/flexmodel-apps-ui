import * as React from 'react'
import {
  BarChart3,
  Gauge,
  LineChart,
  PieChart,
  Star,
  Table2,
  ClipboardCheck,
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
import {ComponentCanvas} from '@/components/biz/ComponentCanvas'
import {
  addableComponentTypes,
  businessObjects,
  defaultComponentConfig,
  favoriteForms,
  getBusinessObject,
  getComponentRows,
  getRecords,
  isComponentMeasureField,
  kpiOptions,
  salesColumns,
  type ComponentConfig,
  type WorkbenchComponent,
} from '@/data/mock'
import {cn} from '@/lib/utils'

const componentTypeIcons = {
  index: Gauge,
  line: LineChart,
  bar: BarChart3,
  pie: PieChart,
  dataloader: Table2,
  favorites: Star,
  tasks: ClipboardCheck,
}

export interface ComponentDesignerResult {
  title: string
  type: WorkbenchComponent['type']
  w: number
  h: number
  config: ComponentConfig
}

interface ComponentDesignerProps {
  open: boolean
  mode: 'create' | 'edit'
  component?: WorkbenchComponent
  onSave: (result: ComponentDesignerResult) => void
  onClose: () => void
}

function createDefaultResult(): ComponentDesignerResult {
  const type: WorkbenchComponent['type'] = 'line'
  const config = defaultComponentConfig(type)
  return {
    title: '',
    type,
    w: 6,
    h: 6,
    config: {...config, title: ''},
  }
}

function toResult(component: WorkbenchComponent): ComponentDesignerResult {
  const config = component.config ?? defaultComponentConfig(component.type)
  return {
    title: component.title,
    type: component.type,
    w: component.w,
    h: component.h,
    config: {...config, title: component.title, type: component.type},
  }
}

export function ComponentDesigner({open, mode, component, onSave, onClose}: ComponentDesignerProps) {
  const [result, setResult] = React.useState<ComponentDesignerResult>(() =>
    component ? toResult(component) : createDefaultResult(),
  )
  const [titleError, setTitleError] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setResult(component ? toResult(component) : createDefaultResult())
    setTitleError('')
  }, [component, open])

  const updateResult = (patch: Partial<ComponentDesignerResult>) => {
    setResult((previous) => ({...previous, ...patch}))
  }

  const updateConfig = (patch: Partial<ComponentConfig>) => {
    setResult((previous) => ({...previous, config: {...previous.config, ...patch}}))
  }

  const changeType = (type: WorkbenchComponent['type']) => {
    const nextConfig = defaultComponentConfig(type)
    setResult((previous) => ({
      ...previous,
      type,
      w: addableComponentTypes.find((item) => item.type === type)?.w ?? previous.w,
      h: addableComponentTypes.find((item) => item.type === type)?.h ?? previous.h,
      config: {...nextConfig, title: previous.title, type},
    }))
  }

  const save = () => {
    const title = result.title.trim()
    if (!title) {
      setTitleError('请输入组件标题')
      return
    }
    onSave({
      ...result,
      title,
      config: {...result.config, title, type: result.type},
    })
  }

  const previewComponent: WorkbenchComponent = {
    id: component?.id ?? 'preview',
    title: result.title || '未命名组件',
    type: result.type,
    w: result.w,
    h: result.h,
    x: component?.x ?? 0,
    y: component?.y ?? 0,
    config: result.config,
  }

  const selectedForm = getBusinessObject(result.config.formName) ?? businessObjects[0]
  const selectedDimensionField = selectedForm?.fields.find(
    (field) => field.name === result.config.dimensionField,
  )
  const selectedMeasureField = selectedForm?.fields.find(
    (field) => field.name === result.config.measureField,
  )

  const changeForm = (formName: string) => {
    const nextForm = getBusinessObject(formName) ?? businessObjects[0]
    if (!nextForm) return

    const dimensionField =
      nextForm.fields.find((field) => field.name === nextForm.displayField)?.name ??
      nextForm.fields[0]?.name ??
      ''
    const measureField = nextForm.fields.find(isComponentMeasureField)?.name ?? ''

    updateConfig({
      formName: nextForm.name,
      dimensionField,
      measureField,
      aggregation: measureField ? result.config.aggregation : 'count',
    })
  }

  return (
    <BizDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={mode === 'create' ? '新增组件' : '编辑组件'}
      width={1080}
      height="min(80vh, 720px)"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={save}>
            保存
          </Button>
        </>
      }
    >
      <div className="grid h-full min-h-0 gap-4 md:grid-cols-[360px_1fr]">
        <Tabs defaultValue="component" className="min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="component">组件</TabsTrigger>
            <TabsTrigger value="data">数据</TabsTrigger>
            <TabsTrigger value="style">样式</TabsTrigger>
            <TabsTrigger value="layout">布局</TabsTrigger>
          </TabsList>

          <TabsContent value="component" className="mt-4 space-y-4">
            <div>
              <label htmlFor="component-designer-title" className="text-sm font-medium text-foreground">
                组件标题
              </label>
              <Input
                id="component-designer-title"
                value={result.title}
                placeholder="例如：本月商机转化率"
                className="mt-2"
                onChange={(event) => {
                  updateResult({title: event.target.value})
                  setTitleError('')
                }}
              />
              {titleError && <p className="mt-2 text-xs text-destructive">{titleError}</p>}
            </div>

            <div>
              <span className="text-sm font-medium text-foreground">组件类型</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {addableComponentTypes.map((preset) => {
                  const Icon = componentTypeIcons[preset.type]
                  return (
                    <button
                      type="button"
                      key={preset.type}
                      onClick={() => changeType(preset.type)}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                        result.type === preset.type
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card',
                      )}
                    >
                      <Icon
                        className={cn(
                          'mt-0.5 h-4 w-4',
                          result.type === preset.type ? 'text-primary' : 'text-muted-foreground',
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{preset.label}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {preset.description}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="data" className="mt-4 space-y-4">
            {result.type === 'index' && (
              <div>
                <span className="text-sm font-medium text-foreground">指标</span>
                <Select
                  value={result.config.metric}
                  onValueChange={(value) => updateConfig({metric: value})}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue/>
                  </SelectTrigger>
                  <SelectContent>
                    {kpiOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {result.type === 'dataloader' && (
              <div>
                <span className="text-sm font-medium text-foreground">展示列</span>
                <div className="mt-2 space-y-2">
                  {salesColumns.map((column) => (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      <Checkbox
                        checked={result.config.visibleColumns.includes(column.id)}
                        onCheckedChange={(checked) => {
                          const visibleColumns = checked
                            ? [...result.config.visibleColumns, column.id]
                            : result.config.visibleColumns.filter((id) => id !== column.id)
                          updateConfig({visibleColumns})
                        }}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {result.type === 'favorites' && (
              <div>
                <span className="text-sm font-medium text-foreground">常用表单</span>
                <div className="mt-2 space-y-2">
                  {favoriteForms.map((item) => (
                    <label key={item.to} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={result.config.favoriteForms.includes(item.to)}
                        onCheckedChange={(checked) => {
                          const favoriteFormsValue = checked
                            ? [...result.config.favoriteForms, item.to]
                            : result.config.favoriteForms.filter((to) => to !== item.to)
                          updateConfig({favoriteForms: favoriteFormsValue})
                        }}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {(result.type === 'line' || result.type === 'bar' || result.type === 'pie') && (
              <>
                <div>
                  <span className="text-sm font-medium text-foreground">表单</span>
                  <Select
                    value={result.config.formName}
                    onValueChange={(value) => changeForm(value)}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue/>
                    </SelectTrigger>
                    <SelectContent>
                      {businessObjects.map((item) => (
                        <SelectItem key={item.name} value={item.name}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <span className="text-sm font-medium text-foreground">维度字段</span>
                  <Select
                    value={result.config.dimensionField}
                    onValueChange={(value) => updateConfig({dimensionField: value})}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue/>
                    </SelectTrigger>
                    <SelectContent>
                      {selectedForm?.fields.map((field) => (
                        <SelectItem key={field.name} value={field.name}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <span className="text-sm font-medium text-foreground">统计方式</span>
                  <Select
                    value={result.config.aggregation}
                    onValueChange={(value) =>
                      updateConfig({
                        aggregation: value === 'count' || value === 'average' ? value : 'sum',
                      })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sum">求和</SelectItem>
                      <SelectItem value="count">计数</SelectItem>
                      <SelectItem value="average">平均值</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {result.config.aggregation !== 'count' && (
                  <div>
                    <span className="text-sm font-medium text-foreground">指标字段</span>
                    <Select
                      value={result.config.measureField}
                      onValueChange={(value) => updateConfig({measureField: value})}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue/>
                      </SelectTrigger>
                      <SelectContent>
                        {selectedForm?.fields.filter(isComponentMeasureField).map((field) => (
                          <SelectItem key={field.name} value={field.name}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                  <div>表单：{selectedForm?.label}</div>
                  <div>维度：{selectedDimensionField?.label ?? '未选择'}</div>
                  <div>
                    指标：
                    {result.config.aggregation === 'count'
                      ? '记录数'
                      : `${selectedMeasureField?.label ?? '未选择'}（${
                        result.config.aggregation === 'average' ? '平均值' : '求和'
                      }）`}
                  </div>
                  <div>记录：{selectedForm ? getRecords(selectedForm.name).length : 0} 条</div>
                  <div>聚合结果：{getComponentRows(result.config).length} 组</div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="style" className="mt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={result.config.showLegend}
                onCheckedChange={(checked) => updateConfig({showLegend: Boolean(checked)})}
              />
              显示图例
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={result.config.showLabel}
                onCheckedChange={(checked) => updateConfig({showLabel: Boolean(checked)})}
              />
              显示数值标签
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={result.config.smooth}
                onCheckedChange={(checked) => updateConfig({smooth: Boolean(checked)})}
              />
              平滑曲线
            </label>

            <div>
              <span className="text-sm font-medium text-foreground">配色</span>
              <Select
                value={result.config.palette}
                onValueChange={(value) =>
                  updateConfig({palette: value === 'multi' ? 'multi' : 'primary'})
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">主色</SelectItem>
                  <SelectItem value="multi">多色</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="layout" className="mt-4 space-y-4">
            <div>
              <span className="text-sm font-medium text-foreground">宽度</span>
              <Select
                value={String(result.w)}
                onValueChange={(value) => updateResult({w: Number(value)})}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue/>
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 6, 8, 12].map((width) => (
                    <SelectItem key={width} value={String(width)}>
                      {width} / 12
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <span className="text-sm font-medium text-foreground">高度</span>
              <Select
                value={String(result.h)}
                onValueChange={(value) => updateResult({h: Number(value)})}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue/>
                </SelectTrigger>
                <SelectContent>
                  {[4, 5, 6, 7, 8].map((height) => (
                    <SelectItem key={height} value={String(height)}>
                      {height} 行
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <div className="min-h-0 overflow-hidden rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">{previewComponent.title}</h4>
              <span className="text-xs text-muted-foreground">
                {result.w} × {result.h}
              </span>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background p-4">
              <ComponentCanvas component={previewComponent} refreshKey={0} filter="全部"/>
            </div>
          </div>
        </div>
      </div>
    </BizDialog>
  )
}

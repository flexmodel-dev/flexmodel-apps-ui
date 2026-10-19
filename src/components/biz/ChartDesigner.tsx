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
import {ChartCanvas} from '@/components/biz/ChartCanvas'
import {
  addableChartTypes,
  chartDataSources,
  defaultChartConfig,
  favoriteForms,
  kpiOptions,
  salesColumns,
  type ChartConfig,
  type DashChart,
} from '@/data/mock'
import {cn} from '@/lib/utils'

const chartTypeIcons = {
  index: Gauge,
  line: LineChart,
  bar: BarChart3,
  pie: PieChart,
  dataloader: Table2,
  favorites: Star,
  tasks: ClipboardCheck,
}

export interface ChartDesignerResult {
  title: string
  type: DashChart['type']
  w: number
  h: number
  config: ChartConfig
}

interface ChartDesignerProps {
  open: boolean
  mode: 'create' | 'edit'
  chart?: DashChart
  onSave: (result: ChartDesignerResult) => void
  onClose: () => void
}

function createDefaultResult(): ChartDesignerResult {
  const type: DashChart['type'] = 'line'
  const config = defaultChartConfig(type)
  return {
    title: '',
    type,
    w: 6,
    h: 6,
    config: {...config, title: ''},
  }
}

function toResult(chart: DashChart): ChartDesignerResult {
  const config = chart.config ?? defaultChartConfig(chart.type)
  return {
    title: chart.title,
    type: chart.type,
    w: chart.w,
    h: chart.h,
    config: {...config, title: chart.title, type: chart.type},
  }
}

export function ChartDesigner({open, mode, chart, onSave, onClose}: ChartDesignerProps) {
  const [result, setResult] = React.useState<ChartDesignerResult>(() =>
    chart ? toResult(chart) : createDefaultResult(),
  )
  const [titleError, setTitleError] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setResult(chart ? toResult(chart) : createDefaultResult())
    setTitleError('')
  }, [chart, open])

  const updateResult = (patch: Partial<ChartDesignerResult>) => {
    setResult((previous) => ({...previous, ...patch}))
  }

  const updateConfig = (patch: Partial<ChartConfig>) => {
    setResult((previous) => ({...previous, config: {...previous.config, ...patch}}))
  }

  const changeType = (type: DashChart['type']) => {
    const nextConfig = defaultChartConfig(type)
    setResult((previous) => ({
      ...previous,
      type,
      w: addableChartTypes.find((item) => item.type === type)?.w ?? previous.w,
      h: addableChartTypes.find((item) => item.type === type)?.h ?? previous.h,
      config: {...nextConfig, title: previous.title, type},
    }))
  }

  const save = () => {
    const title = result.title.trim()
    if (!title) {
      setTitleError('请输入图表标题')
      return
    }
    onSave({
      ...result,
      title,
      config: {...result.config, title, type: result.type},
    })
  }

  const previewChart: DashChart = {
    id: chart?.id ?? 'preview',
    title: result.title || '未命名图表',
    type: result.type,
    w: result.w,
    h: result.h,
    x: chart?.x ?? 0,
    y: chart?.y ?? 0,
    config: result.config,
  }

  const selectedSource =
    chartDataSources.find((item) => item.id === result.config.dataSource) ?? chartDataSources[0]

  return (
    <BizDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={mode === 'create' ? '新增图表' : '编辑图表'}
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
        <Tabs defaultValue="chart" className="min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chart">图表</TabsTrigger>
            <TabsTrigger value="data">数据</TabsTrigger>
            <TabsTrigger value="style">样式</TabsTrigger>
            <TabsTrigger value="layout">布局</TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="mt-4 space-y-4">
            <div>
              <label htmlFor="chart-designer-title" className="text-sm font-medium text-foreground">
                图表标题
              </label>
              <Input
                id="chart-designer-title"
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
              <span className="text-sm font-medium text-foreground">图表类型</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {addableChartTypes.map((preset) => {
                  const Icon = chartTypeIcons[preset.type]
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
                  <span className="text-sm font-medium text-foreground">数据源</span>
                  <Select
                    value={result.config.dataSource}
                    onValueChange={(value) => updateConfig({dataSource: value})}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue/>
                    </SelectTrigger>
                    <SelectContent>
                      {chartDataSources.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                  <div>维度：{selectedSource.dimension}</div>
                  <div className="mt-1">指标：{selectedSource.measure}</div>
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
              <h4 className="text-sm font-semibold text-foreground">{previewChart.title}</h4>
              <span className="text-xs text-muted-foreground">
                {result.w} × {result.h}
              </span>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background p-4">
              <ChartCanvas chart={previewChart} refreshKey={0} filter="全部"/>
            </div>
          </div>
        </div>
      </div>
    </BizDialog>
  )
}

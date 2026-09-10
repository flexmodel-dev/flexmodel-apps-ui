import * as React from 'react'
import ReactECharts from 'echarts-for-react'
import { GridStack } from 'gridstack'
import 'gridstack/dist/gridstack.min.css'
import { Lock, LockOpen, Maximize, RefreshCw } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { chartData, dashCharts, dashboards } from '@/data/mock'

type DashChart = (typeof dashCharts)['dash-0'][number]

function buildOption(type: string, refreshKey = 0, filter = '全部') {
  const filterWeight = filter.length
  const jitter = (value: number, offset: number) => value + ((refreshKey * 3 + offset + filterWeight) % 7) - 3

  if (type === 'line') {
    return {
      grid: { top: 30, left: 40, right: 20, bottom: 30 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: chartData.newCustomers12m.months, axisLine: { lineStyle: { color: '#e4e4e7' } }, axisLabel: { color: '#71717a' } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f4f4f5' } }, axisLabel: { color: '#71717a' } },
      series: [
        {
          type: 'line',
          smooth: true,
          symbolSize: 6,
          data: chartData.newCustomers12m.values.map(jitter),
          itemStyle: { color: '#4f46e5' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(79, 70, 229, 0.28)' },
                { offset: 1, color: 'rgba(79, 70, 229, 0.02)' },
              ],
            },
          },
        },
      ],
    }
  }

  if (type === 'pie') {
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#71717a', fontSize: 11 } },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          label: { show: false },
          data: chartData.industryDist.map((item, index) => ({
            ...item,
            value: jitter(item.value, index),
            itemStyle: { color: ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b'][index], borderColor: '#fff', borderWidth: 2 },
          })),
        },
      ],
    }
  }

  if (type === 'payment-bar') {
    return {
      grid: { top: 30, left: 50, right: 20, bottom: 30 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: chartData.monthlyPayment.months, axisLabel: { color: '#71717a' }, axisLine: { lineStyle: { color: '#e4e4e7' } } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f4f4f5' } }, axisLabel: { color: '#71717a' } },
      series: [
        {
          type: 'bar',
          barWidth: 22,
          data: chartData.monthlyPayment.values.map(jitter),
          itemStyle: {
            borderRadius: 4,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#67e8f9' },
                { offset: 1, color: '#0891b2' },
              ],
            },
          },
        },
      ],
    }
  }

  return {
    grid: { top: 30, left: 50, right: 20, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: chartData.stageAmount.stages, axisLabel: { color: '#71717a' }, axisLine: { lineStyle: { color: '#e4e4e7' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f4f4f5' } }, axisLabel: { color: '#71717a' } },
    series: [
      {
        type: 'bar',
        barWidth: 22,
        data: chartData.stageAmount.values.map(jitter),
        itemStyle: {
          borderRadius: 4,
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#a5b4fc' },
              { offset: 1, color: '#4338ca' },
            ],
          },
        },
      },
    ],
  }
}

function ChartCard({
  chart,
  refreshKey,
  editable,
  filter,
  onRefresh,
}: {
  chart: DashChart
  refreshKey: number
  editable: boolean
  filter: string
  onRefresh: () => void
}) {
  const chartRef = React.useRef<ReactECharts>(null)
  let body: React.ReactNode

  if (chart.type === 'index') {
    const values: Record<string, number> = { 'c-01': 20, 'c-02': 8, 'c-11': 86, 'c-12': 42 }
    const labels: Record<string, string> = {
      'c-01': '本月新增客户数',
      'c-02': '本月赢单商机数',
      'c-11': '销售目标完成率',
      'c-12': '本季新增线索数',
    }
    body = (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="bg-gradient-to-br from-primary to-cyan-500 bg-clip-text text-4xl font-light text-transparent">
          {(values[chart.id] ?? 0) + (refreshKey % 5) + filter.length}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">{labels[chart.id] ?? '指标'}</div>
      </div>
    )
  } else if (chart.type === 'dataloader') {
    body = (
      <table className="rb-table w-full">
        <thead>
          <tr>
            <th>姓名</th>
            <th>部门</th>
            <th>目标 (万元)</th>
            <th>完成 (万元)</th>
            <th>完成率</th>
          </tr>
        </thead>
        <tbody>
          {chartData.salesRank.map((item) => (
            <tr key={item.name}>
              <td>
                <div className="flex items-center gap-2">
                  <UserAvatar name={item.name} size={22} />
                  {item.name}
                </div>
              </td>
              <td>{item.dept}</td>
              <td>{item.target}</td>
              <td>{item.done + (refreshKey % 4) * 2}</td>
              <td>
                <span className="badge-secondary">{item.rate}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  } else {
    body = <ReactECharts ref={chartRef} option={buildOption(chart.type, refreshKey, filter)} style={{ height: '100%' }} opts={{ renderer: 'svg' }} notMerge />
  }

  React.useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance()
    if (!instance) return
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(instance.getDom())
    return () => observer.disconnect()
  }, [])

  return (
    <div className="grid-stack-item" gs-id={chart.id} gs-x={chart.x} gs-y={chart.y} gs-w={chart.w} gs-h={chart.h}>
      <div className="rb-card group grid-stack-item-content text-card-foreground">
        <div className="flex h-full flex-col p-5">
          <div className="flex items-center justify-between">
            <h6 className={cn('chart-title m-0 text-sm font-semibold', editable ? 'cursor-move' : 'cursor-default')}>{chart.title}</h6>
            <div className="flex items-center gap-1 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100">
              <Button variant="ghost" size="icon" className="h-7 w-7" title="刷新" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-3 flex-1 overflow-auto">{body}</div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardHome() {
  const gridRef = React.useRef<HTMLDivElement>(null)
  const [dash, setDash] = React.useState(dashboards[0].id)
  const [editable, setEditable] = React.useState(true)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [layout, setLayout] = React.useState(dashCharts[dash] ?? [])
  const [filter, setFilter] = React.useState('全部')
  const [refreshInterval, setRefreshInterval] = React.useState('无')

  React.useEffect(() => {
    setLayout(dashCharts[dash] ?? [])
    setRefreshKey(0)
  }, [dash])

  React.useEffect(() => {
    if (refreshInterval === '无') return
    const seconds = refreshInterval === '30秒' ? 30 : refreshInterval === '1分钟' ? 60 : refreshInterval === '5分钟' ? 300 : 600
    const timer = window.setInterval(() => setRefreshKey((key) => key + 1), seconds * 1000)
    return () => window.clearInterval(timer)
  }, [refreshInterval])

  React.useEffect(() => {
    if (!gridRef.current) return
    const gridContainer = gridRef.current
    const gridContainerParent = gridContainer.parentElement
    const maxRow = Math.max(...layout.map((chart) => chart.y + chart.h), 1)
    const getDynamicCellHeight = () => {
      const availableHeight = gridContainerParent?.clientHeight ?? 0
      return Math.max(60, Math.floor(availableHeight / maxRow))
    }
    const cellHeight = getDynamicCellHeight()
    const initialized = GridStack.init(
      {
        column: 12,
        cellHeight,
        margin: 5,
        animate: true,
        auto: true,
        float: true,
        handle: '.chart-title',
        disableDrag: !editable,
        disableResize: !editable,
        resizable: { handles: 'se,sw' },
      },
      gridRef.current,
    )

    if (!initialized) return
    const handleResizeStop = () => setRefreshKey((key) => key + 1)
    initialized.on('resizestop', handleResizeStop)

    const resizeObserver = new ResizeObserver(() => {
      initialized.cellHeight(getDynamicCellHeight())
    })
    if (gridContainerParent) resizeObserver.observe(gridContainerParent)

    return () => {
      initialized.off('resizestop')
      resizeObserver.disconnect()
      initialized.destroy(false)
    }
  }, [dash, layout, editable])

  return (
    <AppLayout noPadding>
      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 text-xl font-medium">
                {dashboards.find((item) => item.id === dash)?.name}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {dashboards.map((item) => (
                <DropdownMenuItem key={item.id} onClick={() => setDash(item.id)}>
                  {item.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {filter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {['全部', '本人', '本部门', '本部门及子部门', '本月', '上月', '本年', '去年'].map((item) => (
                  <DropdownMenuItem key={item} onClick={() => setFilter(item)}>
                    <span className={cn(filter === item && 'font-medium')}>{item}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" title="全屏" onClick={() => document.documentElement.requestFullscreen?.()}>
              <Maximize className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  自动刷新
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {['30秒', '1分钟', '5分钟', '10分钟', '无'].map((item) => (
                  <DropdownMenuItem key={item} onClick={() => setRefreshInterval(item)}>
                    <span className={cn(refreshInterval === item && 'font-medium')}>{item}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={() => setEditable((value) => !value)}>
              {editable ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {editable ? '编辑布局' : '锁定布局'}
            </Button>

            <Button variant="ghost" size="icon" title="刷新数据" onClick={() => setRefreshKey((key) => key + 1)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 h-[calc(100vh-9rem)] min-h-[300px] overflow-auto">
          <div className="grid-stack" ref={gridRef}>
            {layout.map((chart) => (
              <ChartCard
                key={`${dash}-${chart.id}`}
                chart={chart}
                refreshKey={refreshKey}
                editable={editable}
                filter={filter}
                onRefresh={() => setRefreshKey((key) => key + 1)}
              />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

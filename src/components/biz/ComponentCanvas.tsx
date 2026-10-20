import * as React from 'react'
import ReactECharts from 'echarts-for-react'
import {FileText, type LucideIcon} from 'lucide-react'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import type {
  WorkbenchComponent,
  WorkbenchComponentData,
  WorkbenchDataPoint,
} from '@/services/workbenches'
import {
  approvals,
  currentUser,
} from '@/data/mock'
import {cn} from '@/lib/utils'

export interface ComponentCanvasColumn {
  name: string
  label: string
}

export interface ComponentCanvasShortcut {
  id: string
  label: string
  to: string
  icon?: LucideIcon
}

function buildOption(component: WorkbenchComponent, source: WorkbenchDataPoint[]) {
  const config = component.config
  if (config.type !== 'chart') {
    throw new Error('图表组件配置不合法')
  }
  const primaryHsl = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
  const primary = `hsl(${primaryHsl})`
  const primaryMuted = `hsl(${primaryHsl} / 0.12)`

  if (config.chartType === 'pie') {
    return {
      tooltip: {trigger: 'item'},
      legend: {
        bottom: 0,
        itemWidth: 10,
        itemHeight: 10,
        show: config.showLegend,
        textStyle: {color: '#71717a', fontSize: 11},
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          label: {show: config.showLabel},
          data: source.map((row, index) => ({
            name: row.dimension,
            value: row.value,
            itemStyle: {
              color:
                config.palette === 'multi'
                  ? `hsl(${primaryHsl} / ${[1, 0.72, 0.48, 0.28][index] ?? 0.2})`
                  : primary,
            },
          })),
        },
      ],
    }
  }

  const isLine = config.chartType === 'line'
  return {
    grid: {top: 30, left: 50, right: 20, bottom: 30},
    tooltip: {trigger: 'axis'},
    xAxis: {
      type: 'category',
      data: source.map((row) => row.dimension),
      axisLabel: {color: '#71717a'},
      axisLine: {lineStyle: {color: '#e4e4e7'}},
    },
    yAxis: {
      type: 'value',
      splitLine: {lineStyle: {color: '#f4f4f5'}},
      axisLabel: {color: '#71717a'},
    },
    series: [
      {
        type: isLine ? 'line' : 'bar',
        smooth: config.smooth,
        symbolSize: isLine ? 6 : 0,
        barWidth: isLine ? undefined : 22,
        label: {show: config.showLabel && !isLine},
        data: source.map((row) => row.value),
        itemStyle: {
          borderRadius: isLine ? 0 : 4,
          color: primary,
        },
        areaStyle: isLine ? {color: primaryMuted} : undefined,
      },
    ],
  }
}

export function ComponentCanvas({
                                  component,
                                  data,
                                  isLoadingData = false,
                                  dataError = null,
                                  onOpenMenu,
                                  columns = [],
                                  shortcutTargets = [],
                                }: {
  component: WorkbenchComponent
  data?: WorkbenchComponentData | null
  isLoadingData?: boolean
  dataError?: string | null
  onOpenMenu?: (to: string) => void
  columns?: ComponentCanvasColumn[]
  shortcutTargets?: ComponentCanvasShortcut[]
}) {
  const config = component.config
  const dataMessage = dataError
    ? '数据加载失败'
    : isLoadingData
      ? '数据加载中...'
      : null
  const dataMessageNode = dataMessage ? (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {dataMessage}
    </div>
  ) : null

  if (config.type === 'metric') {
    if (dataMessageNode) return dataMessageNode
    const metricData = data?.type === 'metric' ? data : null
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="text-4xl font-light text-primary">{metricData?.value ?? '--'}</div>
      </div>
    )
  }

  if (config.type === 'dataloader') {
    if (dataMessageNode) return dataMessageNode
    const visibleColumns = columns.filter((column) =>
      config.visibleColumns.includes(column.name),
    )
    const rows = data?.type === 'dataloader' ? data.list : []
    return (
      <table className="app-table w-full">
        <thead>
        <tr>
          {visibleColumns.map((column) => (
            <th key={column.name}>{column.label}</th>
          ))}
        </tr>
        </thead>
        <tbody>
        {rows.map((row) => (
          <tr key={String(row.id)}>
            {visibleColumns.map((column) => (
              <td key={column.name}>{String(row[column.name] ?? '')}</td>
            ))}
          </tr>
        ))}
        </tbody>
      </table>
    )
  }

  if (config.type === 'shortcuts') {
    const menus = shortcutTargets.filter((item) => config.shortcuts.includes(item.id))
    const columnsPerRow = config.columnsPerRow
    const iconContainerSize =
      columnsPerRow === 1 ? 'h-20 w-20' :
        columnsPerRow === 2 ? 'h-16 w-16' :
          columnsPerRow === 3 ? 'h-14 w-14' :
            columnsPerRow === 4 ? 'h-12 w-12' :
              columnsPerRow <= 6 ? 'h-10 w-10' : 'h-8 w-8'
    const iconSize =
      columnsPerRow === 1 ? 'h-10 w-10' :
        columnsPerRow === 2 ? 'h-8 w-8' :
          columnsPerRow === 3 ? 'h-7 w-7' :
            columnsPerRow === 4 ? 'h-6 w-6' :
              columnsPerRow <= 6 ? 'h-5 w-5' : 'h-4 w-4'
    const textSize =
      columnsPerRow <= 3 ? 'text-base' :
        columnsPerRow <= 4 ? 'text-sm' : 'text-xs'
    return (
      <div
        className="grid h-full content-start gap-2"
        style={{gridTemplateColumns: `repeat(${columnsPerRow}, minmax(0, 1fr))`}}
      >
        {menus.map((item) => {
          const Icon = item.icon ?? FileText
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => onOpenMenu?.(item.to)}
              className="flex flex-col items-center gap-2 rounded-lg p-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  'flex items-center justify-center rounded-lg bg-primary/20 shadow-sm',
                  iconContainerSize,
                )}
              >
                <Icon className={cn('text-primary', iconSize)}/>
              </span>
              <span className={cn('font-medium text-foreground', textSize)}>{item.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  if (config.type === 'tasks') {
    const pendingTasks = approvals.filter((item) => item.status === '待审批')
    const recentTasks = approvals.filter((item) => item.status !== '待审批')
    const initiatedTasks = approvals.filter((item) => item.applicant === currentUser.fullName)

    const renderTasks = (items: typeof approvals) => {
      if (!items.length) {
        return <div className='rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground'>暂无数据</div>
      }
      return (
        <div className='divide-y divide-border'>
          {items.map((item) => (
            <button
              key={item.id}
              type='button'
              onClick={() => onOpenMenu?.('/approval/home')}
              className='flex w-full items-center justify-between gap-3 py-2 text-left transition-colors hover:bg-primary/5'
            >
              <span className='min-w-0 flex-1'>
                <span className='block truncate text-xs font-medium text-foreground'>{item.recordName}</span>
                <span className='mt-1 block truncate text-xs text-muted-foreground'>
                  {item.applicant} · {item.currentNode}
                </span>
              </span>
              <span className='shrink-0 text-xs text-muted-foreground'>{item.submittedOn}</span>
            </button>
          ))}
        </div>
      )
    }

    return (
      <Tabs defaultValue='pending' className='flex h-full min-h-0 flex-col'>
        <TabsList className='h-auto w-full justify-start rounded-none border-b bg-transparent p-0'>
          <TabsTrigger
            value='pending'
            className='h-10 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none'
          >
            待办工作
          </TabsTrigger>
          <TabsTrigger
            value='recent'
            className='h-10 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none'
          >
            最近处理
          </TabsTrigger>
          <TabsTrigger
            value='initiated'
            className='h-10 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none'
          >
            我发起的
          </TabsTrigger>
        </TabsList>
        <TabsContent value='pending' className='mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'>
          {renderTasks(pendingTasks)}
        </TabsContent>
        <TabsContent value='recent' className='mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'>
          {renderTasks(recentTasks)}
        </TabsContent>
        <TabsContent value='initiated' className='mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'>
          {renderTasks(initiatedTasks)}
        </TabsContent>
      </Tabs>
    )
  }

  if (config.type !== 'chart') {
    throw new Error('工作台组件类型不合法')
  }
  if (dataMessageNode) return dataMessageNode

  return (
    <ReactECharts
      option={buildOption(component, data?.type === 'chart' ? data.rows : [])}
      className="h-full w-full"
      style={{height: '100%', width: '100%'}}
      opts={{renderer: 'svg'}}
      notMerge
    />
  )
}

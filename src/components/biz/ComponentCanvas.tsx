import * as React from 'react'
import ReactECharts from 'echarts-for-react'
import {FileText} from 'lucide-react'
import {UserAvatar} from '@/components/ui/avatar'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {
  componentData,
  defaultComponentConfig,
  approvals,
  currentUser,
  favoriteForms,
  getComponentRows,
  kpiOptions,
  salesColumns,
  type WorkbenchComponent,
} from '@/data/mock'

function componentConfig(component: WorkbenchComponent) {
  return component.config ?? defaultComponentConfig(component.type)
}

function buildOption(component: WorkbenchComponent, refreshKey: number, filter: string) {
  const config = componentConfig(component)
  const source = getComponentRows(config)
  const primaryHsl = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
  const primary = `hsl(${primaryHsl})`
  const primaryMuted = `hsl(${primaryHsl} / 0.12)`
  const filterWeight = filter.length
  const jitter = (value: number, offset: number) =>
    value + ((refreshKey * 3 + offset + filterWeight) % 7) - 3

  if (config.type === 'pie') {
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
            value: jitter(row.value, index),
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

  const isLine = config.type === 'line'
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
        data: source.map((row, index) => jitter(row.value, index)),
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
                                  refreshKey,
                                  filter,
                                  onOpenMenu,
                                }: {
  component: WorkbenchComponent
  refreshKey: number
  filter: string
  onOpenMenu?: (to: string) => void
}) {
  const config = componentConfig(component)

  if (config.type === 'index') {
    const metric = kpiOptions.find((item) => item.id === config.metric) ?? kpiOptions[0]
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="text-4xl font-light text-primary">
          {metric.value + (refreshKey % 5) + filter.length}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">{metric.label}</div>
      </div>
    )
  }

  if (config.type === 'dataloader') {
    const visibleColumns = salesColumns.filter((column) =>
      config.visibleColumns.includes(column.id),
    )
    return (
      <table className="app-table w-full">
        <thead>
        <tr>
          {visibleColumns.map((column) => (
            <th key={column.id}>{column.label}</th>
          ))}
        </tr>
        </thead>
        <tbody>
        {componentDataRows().map((row) => (
          <tr key={row.name}>
            {visibleColumns.map((column) => (
              <td key={column.id}>{row[column.id]}</td>
            ))}
          </tr>
        ))}
        </tbody>
      </table>
    )
  }

  if (config.type === 'favorites') {
    const forms = favoriteForms.filter((item) => config.favoriteForms.includes(item.to))
    return (
      <div className="grid h-full grid-cols-1 content-start gap-2 sm:grid-cols-2">
        {forms.map((item) => (
          <button
            key={item.to}
            type="button"
            onClick={() => onOpenMenu?.(item.to)}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileText className="mt-0.5 h-4 w-4 text-primary"/>
            <span className="text-sm font-medium text-foreground">{item.label}</span>
          </button>
        ))}
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

  return (
    <ReactECharts
      option={buildOption(component, refreshKey, filter)}
      style={{height: '100%'}}
      opts={{renderer: 'svg'}}
      notMerge
    />
  )
}

function componentDataRows(): Record<string, string | number>[] {
  return componentData.salesRank
}

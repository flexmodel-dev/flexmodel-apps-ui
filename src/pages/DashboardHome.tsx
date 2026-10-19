import * as React from 'react'
import { GridStack } from 'gridstack'
import 'gridstack/dist/gridstack.min.css'
import {Lock, LockOpen, Maximize, Minimize, Pencil, Plus, RefreshCw} from 'lucide-react'
import {useNavigate} from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {ChartCanvas} from '@/components/biz/ChartCanvas'
import {ChartDesigner, type ChartDesignerResult} from '@/components/biz/ChartDesigner'
import {addDashChart, dashCharts, dashboards} from '@/data/mock'

type DashChart = (typeof dashCharts)['dash-0'][number]

function ChartCard({
  chart,
  refreshKey,
  editable,
  filter,
                     onOpenMenu,
                     onEdit,
  onRefresh,
}: {
  chart: DashChart
  refreshKey: number
  editable: boolean
  filter: string
  onOpenMenu: (to: string) => void
  onEdit: () => void
  onRefresh: () => void
}) {
  return (
    <div className="grid-stack-item" gs-id={chart.id} gs-x={chart.x} gs-y={chart.y} gs-w={chart.w} gs-h={chart.h}>
      <div className="app-card group grid-stack-item-content text-card-foreground">
        <div className="flex h-full flex-col p-5">
          <div className="flex items-center justify-between">
            <h6 className={cn('chart-title m-0 text-sm font-semibold', editable ? 'cursor-move' : 'cursor-default')}>{chart.title}</h6>
            <div className="flex items-center gap-1 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100">
              <Button variant="ghost" size="icon" className="h-7 w-7" title="编辑图表" onClick={onEdit}>
                <Pencil className="h-4 w-4"/>
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="刷新" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-3 flex-1 overflow-auto">
            <ChartCanvas chart={chart} refreshKey={refreshKey} filter={filter} onOpenMenu={onOpenMenu}/>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardHome() {
  const navigate = useNavigate()
  const gridRef = React.useRef<HTMLDivElement>(null)
  const [dash, setDash] = React.useState(dashboards[0].id)
  const [editable, setEditable] = React.useState(true)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [layout, setLayout] = React.useState(dashCharts[dash] ?? [])
  const [fullscreen, setFullscreen] = React.useState(Boolean(document.fullscreenElement))
  const [filter, setFilter] = React.useState('全部')
  const [refreshInterval, setRefreshInterval] = React.useState('无')
  const [designerOpen, setDesignerOpen] = React.useState(false)
  const [designerMode, setDesignerMode] = React.useState<'create' | 'edit'>('create')
  const [designerChart, setDesignerChart] = React.useState<DashChart | null>(null)

  React.useEffect(() => {
    setLayout(dashCharts[dash] ?? [])
    setRefreshKey(0)
  }, [dash])

  React.useEffect(() => {
    const handleFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.()
      return
    }
    await document.documentElement.requestFullscreen?.()
  }

  const openCreateDesigner = () => {
    setDesignerMode('create')
    setDesignerChart(null)
    setDesignerOpen(true)
  }

  const openEditDesigner = (chart: DashChart) => {
    setDesignerMode('edit')
    setDesignerChart(chart)
    setDesignerOpen(true)
  }

  const handleDesignerSave = (result: ChartDesignerResult) => {
    if (designerMode === 'create') {
      addDashChart(dash, result.title, result.type, result.config)
    } else if (designerChart) {
      const charts = dashCharts[dash] ?? []
      const index = charts.findIndex((item) => item.id === designerChart.id)
      if (index >= 0) {
        charts[index] = {
          ...charts[index],
          title: result.title,
          type: result.type,
          w: result.w,
          h: result.h,
          config: result.config,
        }
      }
    }

    setLayout([...(dashCharts[dash] ?? [])])
    setRefreshKey((key) => key + 1)
    setDesignerOpen(false)
    setDesignerChart(null)
  }

  const openMenu = (to: string) => {
    navigate(to)
  }

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
        float: false,
        handle: '.chart-title',
        disableDrag: !editable,
        disableResize: !editable,
        resizable: { handles: 'se,sw' },
      },
      gridRef.current,
    )

    if (!initialized) return
    const handleResizeStop = () => {
      initialized.compact()
      setRefreshKey((key) => key + 1)
    }
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
    <AppLayout noPadding noOuterScroll contentClassName="flex h-full min-h-0 flex-col" hideHeader={fullscreen}>
      <div className="flex h-full min-h-0 flex-col px-4 pb-4 md:px-6 md:pb-6">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
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
            <Button size="sm" onClick={openCreateDesigner}>
              <Plus className="h-4 w-4"/>
              添加图表
            </Button>

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

            <Button variant="ghost" size="icon" title={fullscreen ? '退出全屏' : '全屏'} onClick={toggleFullscreen}>
              {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
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

        <div className="mt-4 min-h-0 flex-1 overflow-auto">
          <div className="grid-stack" ref={gridRef}>
            {layout.map((chart) => (
              <ChartCard
                key={`${dash}-${chart.id}`}
                chart={chart}
                refreshKey={refreshKey}
                editable={editable}
                filter={filter}
                onOpenMenu={openMenu}
                onEdit={() => openEditDesigner(chart)}
                onRefresh={() => setRefreshKey((key) => key + 1)}
              />
            ))}
          </div>
        </div>

        <ChartDesigner
          open={designerOpen}
          mode={designerMode}
          chart={designerChart ?? undefined}
          onSave={handleDesignerSave}
          onClose={() => {
            setDesignerOpen(false)
            setDesignerChart(null)
          }}
        />
      </div>
    </AppLayout>
  )
}

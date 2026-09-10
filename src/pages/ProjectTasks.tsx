import * as React from 'react'
import { useParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { UserAvatar } from '@/components/ui/avatar'
import { projectPlans, projects } from '@/data/mock'
import { cn } from '@/lib/utils'
import { Columns3, Kanban, Search } from 'lucide-react'

/** 项目任务看板（复刻 project/project-tasks.html） */
export default function ProjectTasks() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = projects.find((p) => p.id === projectId) ?? projects[0]
  const [dragOver, setDragOver] = React.useState<string | null>(null)
  const [tasks, setTasks] = React.useState(projectPlans)

  const moveTask = (taskId: string, planId: string) => {
    setTasks((plans) =>
      plans.map((p) => {
        const found = p.tasks.find((t) => t.id === taskId)
        if (!found) return p
        return { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) }
      }).map((p) => {
        const src = projectPlans.flatMap((pp) => pp.tasks).find((t) => t.id === taskId)
        if (p.id === planId && src) {
          const exists = p.tasks.some((t) => t.id === taskId)
          if (exists) return p
          return { ...p, tasks: [...p.tasks, { ...src, planId }] }
        }
        return p
      })
    )
  }

  const priorityColor = (p: string) => {
    if (p === '高') return 'bg-[#ea4335]'
    if (p === '中') return 'bg-[#fbbc05]'
    return 'bg-[#34a853]'
  }

  return (
    <AppLayout noPadding>
      <div className="main-content container-fluid p-0">
        {/* 工具条（ps-toolbar 复刻：52px 高，5px 20px 白底，底边框 #e6e6e6） */}
        <div className="flex h-[52px] items-center justify-between border-b bg-card px-5 pb-[5px] pt-[7px]">
          <div className="project-head flex items-center gap-2">
            <h4 className="m-0 flex items-center gap-2 text-lg font-medium">
              {project.name}
              <span className="badge-secondary up-2">公开</span>
            </h4>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <a className="flex cursor-pointer items-center gap-1 hover:text-primary">
              <Columns3 className="h-4 w-4" /> 显示方式
            </a>
            <a className="flex cursor-pointer items-center gap-1 hover:text-primary">
              <Kanban className="h-4 w-4" /> 看板
            </a>
            <div className="flex">
              <input
                className="h-8 w-[200px] rounded-l-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="搜索标题和 ID"
              />
              <button className="rounded-r-md border border-l-0 border-input bg-muted px-2 text-muted-foreground">
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 任务完成度 */}
        <div className="px-5 py-1 text-sm text-muted-foreground">任务完成度 {project.progress}%</div>

        {/* 看板列（plan-box 320px 固定宽度横向排列） */}
        <div id="plan-boxes" className="flex gap-0 overflow-x-auto px-5 pb-4 pt-1">
          {tasks.map((plan) => (
            <div key={plan.id} className="plan-box-wrapper shrink-0 basis-[320px]">
            <div
              className={cn(
                'w-[300px] rounded-md bg-transparent',
                dragOver === plan.id && 'outline outline-1 outline-dashed outline-primary'
              )}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(plan.id)
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault()
                const taskId = e.dataTransfer.getData('taskId')
                if (taskId) moveTask(taskId, plan.id)
                setDragOver(null)
              }}
            >
              <div className="flex items-center justify-between px-1">
                <span className="plan-title m-0 my-[15px] block text-[13px] font-bold text-[#444] dark:text-[#ccc]">
                  {plan.name} <small className="text-sm font-normal text-muted-foreground">{plan.tasks.length}</small>
                </span>
              </div>
              <div className="task-list p-0">
                {plan.tasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('taskId', t.id)}
                    className={cn(
                      'mb-2 cursor-pointer rounded-md bg-card px-3.5 pb-2 pt-3 text-sm shadow-sm transition-shadow hover:shadow-md',
                      t.finished && 'opacity-70'
                    )}
                  >
                    <div className={cn('flex items-start gap-1.5', t.finished && 'line-through')}>
                      <i
                        className={cn('mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full', priorityColor(t.priority))}
                        title={`优先级：${t.priority}`}
                      />
                      <span className="min-w-0 flex-1">{t.title}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <UserAvatar name={t.executor} size={18} />
                        {t.executor}
                      </span>
                      <span className={cn('text-xs', t.deadline < '2026-09-08' && !t.finished ? 'text-[#ea4335]' : 'text-[#bbb]')}>
                        {t.deadline}
                      </span>
                    </div>
                    {t.progress > 0 && !t.finished && (
                      <div className="mt-2 h-1 w-full rounded-full bg-[#f0f0f0]">
                        <div className="h-1 rounded-full bg-primary" style={{ width: `${t.progress}%` }} />
                      </div>
                    )}
                  </div>
                ))}
                <div className="cursor-pointer py-1.5 text-center text-xs text-muted-foreground hover:text-primary">
                  + 添加任务
                </div>
              </div>
            </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

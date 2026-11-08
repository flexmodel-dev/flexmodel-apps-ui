import * as React from 'react'
import {Drawer, DrawerContent, DrawerTitle} from '@/components/ui/drawer'
import {Button} from '@/components/ui/button'
import {approvalStatus, getFlowTriggerLogs, listFlowInstances, type ApprovalItem} from '@/services/approvals'
import type {ApprovalFlow} from '@/types/approval'
import {InstanceDrawer} from './InstanceDrawer'
import {toErrorMessage} from '@/lib/utils'

export function FlowRunsDrawer({flow, onClose}: { flow: ApprovalFlow; onClose: () => void }) {
  const [instances, setInstances] = React.useState<ApprovalItem[]>([])
  const [logs, setLogs] = React.useState<Awaited<ReturnType<typeof getFlowTriggerLogs>>>([])
  const [selected, setSelected] = React.useState<ApprovalItem | null>(null)
  const [error, setError] = React.useState('')
  const load = React.useCallback(async () => {
    try {
      const [runs, events] = await Promise.all([listFlowInstances(flow.appId, flow.id), getFlowTriggerLogs(flow.appId, flow.id)]);
      setInstances(runs);
      setLogs(events);
      setError('')
    } catch (e) {
      setError(toErrorMessage(e, '读取执行记录失败'))
    }
  }, [flow.appId, flow.id])
  React.useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer)
  }, [load])
  return <><Drawer open onOpenChange={open => {
    if (!open) onClose()
  }}><DrawerContent className="ml-auto flex h-full w-full max-w-3xl flex-col">
    <div className="border-b p-5"><DrawerTitle>{flow.name} · 执行记录</DrawerTitle></div>
    <div className="min-h-0 flex-1 space-y-6 overflow-auto p-5">
      {error && <p role="alert" className="text-sm text-destructive">{error}<Button variant="link"
                                                                                    onClick={() => void load()}>重试</Button>
      </p>}
      <section className="space-y-2"><h3 className="text-sm font-medium">流程实例</h3>
        {!instances.length && <p className="text-sm text-muted-foreground">暂无执行实例</p>}
        {instances.map(run => <button key={run.id}
                                      className="flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm"
                                      onClick={() => setSelected(run)}>
          <span>{new Date(String(run.createdAt)).toLocaleString()}<span
            className="ml-2 text-xs text-muted-foreground">{run.recordId || '无关联记录'}</span></span>
          <span>{approvalStatus[run.status] ?? run.status}</span></button>)}
      </section>
      <section className="space-y-2"><h3 className="text-sm font-medium">触发日志</h3>
        {!logs.length && <p className="text-sm text-muted-foreground">暂无触发日志</p>}
        {logs.map(log => <div key={log.id} className="rounded-lg border p-3 text-sm">
          <p>{({
            ACCEPTED: '已接受启动',
            SKIPPED_OVERLAP: '跳过：上一轮未结束',
            SKIPPED_STALE: '跳过：触发配置已变化'
          } as Record<string, string>)[log.state] ?? log.state}</p>
          <p className="mt-1 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()} {log.reason}</p>
        </div>)}
      </section>
    </div>
  </DrawerContent></Drawer>{selected &&
    <InstanceDrawer item={selected} onClose={() => setSelected(null)} onChanged={() => void load()}/>}</>
}

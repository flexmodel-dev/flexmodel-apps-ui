import {Link, useParams} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {AppLayout} from '@/components/layout/AppLayout'
import {ApprovalFeed} from './ApprovalFeed'
import {cn} from '@/lib/utils'

export default function ApprovalHome() {
  const {appId} = useParams()
  const standalone = !appId
  return <AppLayout
    hideNavigation={standalone}
    showBack={standalone}
    noOuterScroll
    contentClassName={standalone ? 'h-full' : 'flex h-full min-h-0 flex-col'}
  >
    <div className={cn('flex h-full min-h-0 flex-col gap-4', standalone && 'mx-auto w-full max-w-5xl p-4 md:p-6')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold">待办中心</h1><p
          className="mt-1 text-xs text-muted-foreground">处理待办，跟踪审批进度与表单流程。</p></div>
        {standalone &&
          <Button variant="outline" size="sm" asChild><Link to="/admin/workbench">返回工作台</Link></Button>}
      </div>
      <div className="min-h-0 flex-1 rounded-lg border bg-card p-3 sm:p-5"><ApprovalFeed appId={appId}
                                                                                  showAppFilter={standalone}/></div>
    </div>
  </AppLayout>
}

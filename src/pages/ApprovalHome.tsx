import {useParams} from 'react-router-dom'
import {AppLayout} from '@/components/layout/AppLayout'
import {ApprovalFeed} from './Approvals/ApprovalFeed'

export default function ApprovalHome() {
  const {appId} = useParams()
  return <AppLayout>
    <div className="flex h-full min-h-0 flex-col p-6">
      <div className="mb-6"><h1 className="text-xl font-semibold">审批中心</h1><p
        className="mt-2 text-sm text-muted-foreground">处理待办，跟踪审批进度与表单流程。</p></div>
      <div className="min-h-0 flex-1 rounded-lg border bg-card p-5"><ApprovalFeed appId={appId}/></div>
    </div>
  </AppLayout>
}

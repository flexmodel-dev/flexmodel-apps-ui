import * as React from 'react'
import {Drawer, DrawerContent, DrawerDescription, DrawerTitle} from '@/components/ui/drawer'
import {Button} from '@/components/ui/button'
import {message} from '@/components/ui/message'
import {AppLoading} from '@/components/biz/AppLoading'
import {AppRecordDrawer} from '@/components/biz/AppRecordDrawer'
import {type AppNotification, notificationDetail, readNotification,} from '@/services/notifications'
import {toErrorMessage} from '@/lib/utils'

/**
 * 通知详情抽屉：通知中心、铃铛和站内浮窗共用。
 * 打开时自动标记已读，但不改变当前路由；关联审批/讨论继续用记录抽屉承载。
 */
export function NotificationDetailDrawer({
                                           notificationId,
                                           open,
                                           onOpenChange,
                                           onRead,
                                         }: {
  notificationId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRead?: () => void
}) {
  const [detail, setDetail] = React.useState<AppNotification | null>(null)
  const [detailError, setDetailError] = React.useState('')
  const [showApproval, setShowApproval] = React.useState(false)
  const [showDiscussion, setShowDiscussion] = React.useState(false)
  const [revision, reloadDetail] = React.useReducer((value: number) => value + 1, 0)

  React.useEffect(() => {
    if (!open || !notificationId) return
    let active = true
    setDetail(null)
    setDetailError('')
    setShowApproval(false)
    setShowDiscussion(false)
    void notificationDetail(notificationId).then(async (value) => {
      if (!active) return
      setDetail(value)
      if (!value.readAt) {
        try {
          await readNotification(notificationId)
          if (active) onRead?.()
        } catch {
          if (active) message.error('标记已读失败，请重试')
        }
      }
    }).catch((cause: unknown) => {
      if (active) setDetailError(toErrorMessage(cause, '读取通知失败'))
    })
    return () => {
      active = false
    }
    // onRead 不参与依赖，避免父组件每次渲染重复标记已读
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, notificationId, revision])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setShowApproval(false)
      setShowDiscussion(false)
    }
    onOpenChange(next)
  }

  return (
    <>
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="w-[min(96vw,600px)]">
          <div className="border-b p-6 pr-12">
            <DrawerTitle>{detail?.title ?? '通知详情'}</DrawerTitle>
            <DrawerDescription className="mt-2">
              {detail ? `${detail.appName} · ${new Date(detail.receivedAt).toLocaleString()}` : '查看消息内容'}
            </DrawerDescription>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-6">
            {detailError ? (
              <p role="alert" className="text-sm text-destructive">
                {detailError}
                <Button variant="link" onClick={reloadDetail}>重试</Button>
              </p>
            ) : !detail ? (
              <AppLoading className="py-8" label="正在加载通知详情"/>
            ) : (
              <p className="whitespace-pre-wrap break-words text-sm leading-7">{detail.content}</p>
            )}
          </div>
          {detail && (
            <div className="border-t p-4">
              {detail.canNavigate && detail.approval ? (
                <Button onClick={() => setShowApproval(true)}>查看审批</Button>
              ) : detail.canNavigate && detail.formName && detail.recordId ? (
                <Button onClick={() => setShowDiscussion(true)}>查看讨论</Button>
              ) : detail.instanceId || detail.discussionId ? (
                <p className="text-xs text-muted-foreground">关联内容已不可用或暂无查看权限</p>
              ) : null}
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {showApproval && detail?.approval && (
        <AppRecordDrawer
          open
          onOpenChange={(next) => {
            if (!next) setShowApproval(false)
          }}
          appId={detail.approval.appId}
          formName={detail.approval.formName}
          recordId={detail.approval.recordId}
          approvalInstanceId={detail.approval.id}
          stacked={false}
          onSaved={reloadDetail}
        />
      )}
      {showDiscussion && detail?.formName && detail.recordId && (
        <AppRecordDrawer
          open
          onOpenChange={(next) => {
            if (!next) setShowDiscussion(false)
          }}
          appId={detail.appId}
          formName={detail.formName}
          recordId={detail.recordId}
          initialAsideTab="discussion"
          stacked={false}
          onSaved={reloadDetail}
        />
      )}
    </>
  )
}

import * as React from 'react'
import {Check, X} from 'lucide-react'
import {Drawer, DrawerContent, DrawerTitle} from '@/components/ui/drawer'
import {Button} from '@/components/ui/button'
import {AppRecordFormModal} from '@/components/biz/AppRecordFormModal'
import {ApprovalDecisionDialog, useApprovalDecision} from '@/components/biz/approvalDecision'
import {getAppForm, type AppForm} from '@/services/appForms'
import {FINISHED_STATUS, type ApprovalItem} from '@/services/approvals'
import {ApprovalProgressPanel} from './ApprovalProgress'
import {toErrorMessage} from '@/lib/utils'

/**
 * 审批记录抽屉：统一用记录表单呈现审批关联的记录，右侧内嵌流程进度面板（右上角按钮展开/折叠）。
 * - 待我审批：只读表单 + 同意/不同意
 * - 流程进行中：只读表单
 * - 流程已结束：可编辑表单（编辑模式的表单，可保存）
 */
export function ApprovalTaskDrawer({item, onClose, onChanged}: {
  item: ApprovalItem | null
  onClose: () => void
  onChanged?: () => void
}) {
  const [form, setForm] = React.useState<AppForm | null>(null)
  const [error, setError] = React.useState('')
  const [revision, reload] = React.useReducer(value => value + 1, 0)
  const decision = useApprovalDecision(item?.appId ?? '', () => {
    onChanged?.()
    onClose()
  })

  // 待我审批的任务：列表项带 taskId 且尚未决策（已处理条目也带 taskId，但有 decision）
  const hasTask = !!item?.taskId && !item?.decision
  const finished = item ? FINISHED_STATUS.includes(item.status) : false
  const readOnly = !item || hasTask || !finished

  React.useEffect(() => {
    if (!item) return
    let active = true
    setForm(null)
    setError('')
    getAppForm(item.appId, item.formName)
      .then((loaded) => {
        if (active) {
          setForm(loaded)
          setError('')
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(toErrorMessage(caught, '读取表单失败'))
      })
    return () => {
      active = false
    }
  }, [item?.appId, item?.formName, item?.recordId, revision])

  const footer = hasTask ? (
    <>
      <Button variant="secondary" onClick={() => decision.openDecision('reject')}>
        <X className="h-4 w-4"/>不同意
      </Button>
      <Button onClick={() => decision.openDecision('approve')}>
        <Check className="h-4 w-4"/>同意
      </Button>
    </>
  ) : !finished ? (
    <Button variant="secondary" onClick={onClose}>关闭</Button>
  ) : undefined

  return (
    <>
      {item && !form && (
        <Drawer open onOpenChange={open => !open && onClose()}>
          <DrawerContent className="w-[min(96vw,720px)]">
            <div className="border-b px-6 py-5">
              <DrawerTitle
                className="text-base font-semibold">{hasTask ? `审批：${item.title}` : item.title}</DrawerTitle>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6 text-sm text-muted-foreground">
              {error
                ? (
                  <div role="alert" className="text-destructive">
                    {error}
                    <Button variant="link" onClick={reload}>重试</Button>
                  </div>
                )
                : '正在读取审批…'}
            </div>
          </DrawerContent>
        </Drawer>
      )}
      {item && form && (
        <AppRecordFormModal
          open
          onOpenChange={open => !open && onClose()}
          appId={item.appId}
          form={form}
          recordId={item.recordId}
          readOnly={readOnly}
          title={hasTask ? `审批：${item.title}` : item.title}
          footer={footer}
          aside={item ? <ApprovalProgressPanel appId={item.appId} instanceId={item.id}/> : undefined}
          onSaved={() => onChanged?.()}
        />
      )}
      <ApprovalDecisionDialog
        pending={decision.pending}
        comment={decision.comment}
        busy={decision.busy}
        onCommentChange={decision.setComment}
        onClose={decision.closeDecision}
        onConfirm={() => void decision.confirmDecision(item?.taskId)}
      />
    </>
  )
}

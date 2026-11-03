import * as React from 'react'

type FetchingListener = (fetching: boolean) => void

const ViewFetchingContext = React.createContext<FetchingListener | null>(null)

/**
 * 视图刷新状态上抛：页面工具栏据此展示刷新中状态。
 *
 * 视图内容区顶部直接紧挨着表格表头，任何贴顶的进度条都会和页签下方的分隔线混在一起，
 * 因此刷新反馈统一放在工具栏的刷新按钮上，内容区不再绘制横线。
 */
export function ViewFetchingProvider({
                                       onFetchingChange,
                                       children,
                                     }: {
  onFetchingChange: FetchingListener
  children: React.ReactNode
}) {
  return <ViewFetchingContext.Provider value={onFetchingChange}>{children}</ViewFetchingContext.Provider>
}

/** 上报当前视图的后台刷新状态；卸载或停止刷新时自动复位。 */
export function useViewFetching(active: boolean) {
  const report = React.useContext(ViewFetchingContext)
  React.useEffect(() => {
    if (!report) return
    report(active)
    return () => report(false)
  }, [active, report])
}

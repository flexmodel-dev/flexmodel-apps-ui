import * as React from 'react'
import {type AppViewQueryRequestInput, type AppViewQueryResponse, queryAppView} from '@/services/appViews'
import {toErrorMessage} from '@/lib/utils'

export interface ViewQueryState {
  data: AppViewQueryResponse | null
  isLoading: boolean
  error: string | null
}

/**
 * 视图统一查询 Hook：请求携带序号，切换视图或快速变更条件时丢弃过期响应。
 * `request` 以 JSON 序列化作为变更键，`reloadKey` 用于手动触发重载（如容器刷新信号）。
 * `enabled` 为 false 时不发起请求（如日历等待初始窗口）。
 */
export function useViewQuery(
  appId: string,
  formName: string,
  viewId: string,
  request: AppViewQueryRequestInput,
  reloadKey: number | string = 0,
  enabled = true,
): ViewQueryState {
  const [state, setState] = React.useState<ViewQueryState>({data: null, isLoading: true, error: null})
  const sequence = React.useRef(0)
  const requestKey = JSON.stringify(request)
  React.useEffect(() => {
    if (!enabled) return
    const current = ++sequence.current
    setState((previous) => ({...previous, isLoading: true, error: null}))
    queryAppView(appId, formName, viewId, request)
      .then((data) => {
        if (sequence.current !== current) return
        setState({data, isLoading: false, error: null})
      })
      .catch((caught: unknown) => {
        if (sequence.current !== current) return
        setState({data: null, isLoading: false, error: toErrorMessage(caught, '加载视图数据失败')})
      })
    return () => {
      sequence.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, formName, viewId, requestKey, reloadKey, enabled])
  return state
}

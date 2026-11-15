import * as React from 'react'
import {type AppViewQueryRequestInput, type AppViewQueryResponse, queryAppView} from '@/services/appViews'
import {toErrorMessage} from '@/lib/utils'

export interface ViewQueryState {
  data: AppViewQueryResponse | null
  error: string | null
  /** 首次加载（当前 query 还没有任何数据） */
  isLoading: boolean
  /** 任意请求进行中，包括翻页、刷新和后台重载 */
  isFetching: boolean
  /** 手动重试当前请求 */
  reload: () => void
}

interface InternalState {
  data: AppViewQueryResponse | null
  error: string | null
  isLoading: boolean
  isFetching: boolean
}

const initialState = (enabled: boolean): InternalState => ({
  data: null,
  error: null,
  isLoading: enabled,
  isFetching: enabled,
})

/**
 * 视图统一查询 Hook：请求携带序号，切换视图或快速变更条件时丢弃过期响应。
 *
 * - 重新加载时保留上一份数据，避免翻页/刷新把内容闪成空白；
 * - `isLoading` 只表示首次加载，刷新进度统一用 `isFetching`；
 * - 错误时保留已有数据，由视图展示横幅并允许重试。
 */
export function useViewQuery(
  appId: string,
  formName: string,
  viewId: string,
  request: AppViewQueryRequestInput,
  reloadKey: number | string = 0,
  enabled = true,
): ViewQueryState {
  const [state, setState] = React.useState<InternalState>(() => initialState(enabled))
  const [retryTick, setRetryTick] = React.useState(0)
  const sequence = React.useRef(0)
  const requestKey = JSON.stringify(request)
  const reload = React.useCallback(() => setRetryTick((tick) => tick + 1), [])

  React.useEffect(() => {
    if (!enabled) {
      setState((previous) => previous.isFetching || previous.isLoading
        ? {data: previous.data, error: null, isLoading: false, isFetching: false}
        : previous)
      return
    }
    const current = ++sequence.current
    setState((previous) => ({
      ...previous,
      isLoading: previous.data === null,
      isFetching: true,
      error: null,
    }))
    queryAppView(appId, formName, viewId, request)
      .then((data) => {
        if (sequence.current !== current) return
        setState({data, error: null, isLoading: false, isFetching: false})
      })
      .catch((caught: unknown) => {
        if (sequence.current !== current) return
        setState((previous) => ({
          data: previous.data,
          error: toErrorMessage(caught, '加载视图数据失败'),
          isLoading: false,
          isFetching: false,
        }))
      })
    return () => {
      sequence.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, formName, viewId, requestKey, reloadKey, enabled, retryTick])

  return {...state, reload}
}

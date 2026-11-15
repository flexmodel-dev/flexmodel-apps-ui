import * as React from 'react'
import {toErrorMessage} from '@/lib/utils'
import {
  listRecordHistories,
  type RecordHistoryItem,
} from '@/services/recordHistory'

const PAGE_SIZE = 20

function mergeItems(current: RecordHistoryItem[], next: RecordHistoryItem[]) {
  const merged = [...current]
  next.forEach(item => {
    if (!merged.some(existing => existing.id === item.id)) merged.push(item)
  })
  return merged
}

/** 记录历史：光标分页加载，切换记录立即重置，迟到响应不会串数据；无轮询。 */
export function useRecordHistory({appId, formName, recordId, enabled}: {
  appId: string;
  formName: string;
  recordId: string;
  enabled: boolean
}) {
  const [items, setItems] = React.useState<RecordHistoryItem[]>([])
  const [supported, setSupported] = React.useState(true)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [hasMore, setHasMore] = React.useState(false)
  const nextCursor = React.useRef<string | null>(null)
  const sequence = React.useRef(0)

  const loadFirstPage = React.useCallback(async (silent: boolean) => {
    if (!enabled) return
    const current = ++sequence.current
    if (!silent) setLoading(true)
    try {
      const page = await listRecordHistories(appId, formName, recordId, {size: PAGE_SIZE})
      if (current !== sequence.current) return
      setItems(page.list)
      setSupported(page.supported)
      setHasMore(page.hasMore)
      nextCursor.current = page.nextCursor
      setError('')
    } catch (cause) {
      if (current !== sequence.current) return
      if (!silent) setError(toErrorMessage(cause, '加载历史失败'))
    } finally {
      if (current === sequence.current && !silent) setLoading(false)
    }
  }, [appId, formName, recordId, enabled])

  React.useEffect(() => {
    if (!enabled) return
    // 切换记录时立即清空前一条记录的状态
    setItems([])
    setError('')
    setHasMore(false)
    setSupported(true)
    nextCursor.current = null
    setLoading(true)
    void loadFirstPage(false)
    // 页面重新获得焦点时静默刷新首屏
    const onFocus = () => {
      if (document.visibilityState !== 'hidden') void loadFirstPage(true)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      sequence.current++
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, loadFirstPage])

  const loadMore = React.useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor.current) return
    setLoadingMore(true)
    try {
      const page = await listRecordHistories(appId, formName, recordId, {
        size: PAGE_SIZE,
        cursor: nextCursor.current,
      })
      setItems(current => mergeItems(current, page.list))
      setHasMore(page.hasMore)
      nextCursor.current = page.nextCursor
    } catch (cause) {
      // 加载更多失败保留已加载内容
      setError(toErrorMessage(cause, '加载更多历史失败'))
    } finally {
      setLoadingMore(false)
    }
  }, [appId, formName, recordId, loadingMore, hasMore])

  const refresh = React.useCallback(() => {
    void loadFirstPage(false)
  }, [loadFirstPage])

  /** 保存、子表操作、提交审批和签核成功后的静默失效刷新。 */
  const refreshSilently = React.useCallback(() => {
    void loadFirstPage(true)
  }, [loadFirstPage])

  return {
    items,
    supported,
    loading,
    error,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    refreshSilently,
  }
}

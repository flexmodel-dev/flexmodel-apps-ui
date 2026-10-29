import * as React from 'react'
import {toErrorMessage} from '@/lib/utils'
import {
  createRecordDiscussion,
  deleteRecordDiscussion,
  listRecordDiscussions,
  type RecordDiscussionItem,
} from '@/services/recordDiscussions'

const PAGE_SIZE = 20
const MAX_WINDOW = 50
const POLL_INTERVAL = 3000

function insertDiscussion(roots: RecordDiscussionItem[], created: RecordDiscussionItem) {
  if (!created.parentId) return [created, ...roots]
  return roots.map(root => root.id === created.parentId
    ? {...root, replyCount: root.replyCount + 1, replies: [...root.replies, created]}
    : root)
}

function mergeRoots(current: RecordDiscussionItem[], next: RecordDiscussionItem[]) {
  const merged = [...current]
  next.forEach(item => {
    if (!merged.some(existing => existing.id === item.id)) merged.push(item)
  })
  return merged
}

/** 记录讨论：侧栏挂载时加载并每 3 秒轮询，卸载即停止。 */
export function useRecordDiscussions({appId, formName, recordId}: {
  appId: string;
  formName: string;
  recordId: string
}) {
  const [roots, setRoots] = React.useState<RecordDiscussionItem[]>([])
  const [total, setTotal] = React.useState(0)
  const [rootTotal, setRootTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const pagesLoaded = React.useRef(1)
  const sequence = React.useRef(0)

  const loadWindow = React.useCallback(async (silent: boolean) => {
    const current = ++sequence.current
    const size = Math.min(MAX_WINDOW, PAGE_SIZE * pagesLoaded.current)
    if (!silent) setLoading(true)
    try {
      const page = await listRecordDiscussions(appId, formName, recordId, 1, size)
      if (current !== sequence.current) return
      setRoots(page.list)
      setTotal(page.total)
      setRootTotal(page.rootTotal)
      setError('')
    } catch (cause) {
      if (current !== sequence.current) return
      if (!silent) setError(toErrorMessage(cause, '加载讨论失败'))
    } finally {
      if (current === sequence.current && !silent) setLoading(false)
    }
  }, [appId, formName, recordId])

  React.useEffect(() => {
    pagesLoaded.current = 1
    setRoots([])
    setTotal(0)
    setRootTotal(0)
    setError('')
    setLoading(true)
    void loadWindow(false)
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void loadWindow(true)
    }, POLL_INTERVAL)
    return () => {
      sequence.current++
      window.clearInterval(timer)
    }
  }, [loadWindow])

  const submit = React.useCallback(async (content: string, parentId?: string | null,
                                          mentionedUserIds?: string[], replyToId?: string | null) => {
    setSubmitting(true)
    try {
      const created = await createRecordDiscussion(appId, formName, recordId, {
        content,
        parentId: parentId ?? undefined,
        replyToId: replyToId ?? undefined,
        mentionedUserIds,
      })
      setRoots(current => insertDiscussion(current, created))
      setTotal(value => value + 1)
      if (!created.parentId) setRootTotal(value => value + 1)
      void loadWindow(true)
      return created
    } finally {
      setSubmitting(false)
    }
  }, [appId, formName, recordId, loadWindow])

  const remove = React.useCallback(async (discussionId: string) => {
    await deleteRecordDiscussion(appId, formName, recordId, discussionId)
    await loadWindow(true)
  }, [appId, formName, recordId, loadWindow])

  const loadMore = React.useCallback(async () => {
    if (loadingMore || roots.length >= rootTotal || roots.length >= MAX_WINDOW) return
    setLoadingMore(true)
    const nextPage = pagesLoaded.current + 1
    try {
      const page = await listRecordDiscussions(appId, formName, recordId, nextPage,
        Math.min(PAGE_SIZE, MAX_WINDOW - roots.length))
      pagesLoaded.current = nextPage
      setRoots(current => mergeRoots(current, page.list))
      setTotal(page.total)
      setRootTotal(page.rootTotal)
      setError('')
    } catch (cause) {
      setError(toErrorMessage(cause, '加载更多讨论失败'))
    } finally {
      setLoadingMore(false)
    }
  }, [appId, formName, recordId, loadingMore, roots.length, rootTotal])

  return {
    roots,
    total,
    rootTotal,
    loading,
    error,
    submitting,
    loadingMore,
    hasMore: roots.length < rootTotal && roots.length < MAX_WINDOW,
    submit,
    remove,
    loadMore,
    reload: () => loadWindow(false),
  }
}

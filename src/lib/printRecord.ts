import './recordPrint.css'

/** 复制当前详情，避免抽屉的固定定位与滚动容器截断打印内容。 */
// shortcut: 子表仅打印当前页，需要全量打印时再增加专用取数。
export function printRecord(content: HTMLElement | null, title: string) {
  if (!content) return
  const snapshot = document.createElement('article')
  snapshot.className = 'record-print'
  const heading = document.createElement('h1')
  heading.textContent = title
  snapshot.append(heading, content.cloneNode(true))
  document.body.append(snapshot)
  const cleanup = () => {
    snapshot.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  try {
    window.print()
  } catch (error) {
    cleanup()
    throw error
  }
}

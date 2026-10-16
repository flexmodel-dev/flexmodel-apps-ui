import * as React from 'react'
import {AlertCircle, CheckCircle2} from 'lucide-react'
import {cn} from '@/lib/utils'

type MessageType = 'success' | 'error'

interface MessageItem {
  id: number
  type: MessageType
  content: string
}

const MESSAGE_EVENT = 'flexmodel:message'
let messageId = 0

function showMessage(type: MessageType, content: string) {
  window.dispatchEvent(
    new CustomEvent<MessageItem>(MESSAGE_EVENT, {
      detail: {id: ++messageId, type, content},
    })
  )
}

export const message = {
  success: (content: string) => showMessage('success', content),
  error: (content: string) => showMessage('error', content),
}

export function MessageViewport() {
  const [items, setItems] = React.useState<MessageItem[]>([])

  React.useEffect(() => {
    const handleMessage = (event: Event) => {
      const item = (event as CustomEvent<MessageItem>).detail
      setItems(current => [...current, item])
      window.setTimeout(() => {
        setItems(current => current.filter(messageItem => messageItem.id !== item.id))
      }, 3200)
    }

    window.addEventListener(MESSAGE_EVENT, handleMessage)
    return () => window.removeEventListener(MESSAGE_EVENT, handleMessage)
  }, [])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[1200] flex w-full max-w-sm flex-col gap-2"
    >
      {items.map(item => (
        <div
          key={item.id}
          className={cn(
            'flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-lg',
            item.type === 'error' ? 'border-destructive/40 text-destructive' : 'text-foreground'
          )}
        >
          {item.type === 'error'
            ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>
            : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"/>}
          <span className="min-w-0 flex-1">{item.content}</span>
        </div>
      ))}
    </div>
  )
}

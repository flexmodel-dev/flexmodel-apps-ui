import * as React from 'react'
import {AtSign} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {UserAvatar} from '@/components/ui/avatar'
import {getAuthSession} from '@/services/auth'
import {getDirectory} from '@/services/directory'
import type {DirectoryMember} from '@/types/directory'

interface MentionState {
  start: number
  query: string
  open: boolean
  index: number
}

/** 讨论输入框：Enter 发送、Shift+Enter 换行，输入 @ 选择应用成员。 */
export function DiscussionComposer({appId, replyTo, submitting, onSubmit}: {
  appId: string;
  replyTo?: { authorName: string } | null;
  submitting: boolean;
  onSubmit: (content: string, mentionedUserIds: string[]) => Promise<boolean>
}) {
  const [draft, setDraft] = React.useState('')
  const [members, setMembers] = React.useState<DirectoryMember[]>([])
  const [directoryError, setDirectoryError] = React.useState('')
  const [selected, setSelected] = React.useState<Array<{ id: string; name: string }>>([])
  const [mention, setMention] = React.useState<MentionState | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    let active = true
    setMembers([])
    setDirectoryError('')
    const userId = getAuthSession()?.user.id
    getDirectory(appId).then(directory => {
      if (!active) return
      setMembers(directory.members.filter(member => member.id !== userId && member.status !== 'DISABLED'))
    }).catch(() => {
      if (active) setDirectoryError('成员目录加载失败，仍可直接输入 @姓名')
    })
    return () => {
      active = false
    }
  }, [appId])

  React.useEffect(() => {
    if (replyTo) textareaRef.current?.focus()
  }, [replyTo])

  const candidates = React.useMemo(() => {
    if (!mention?.open) return []
    const query = mention.query.trim().toLowerCase()
    return members
      .filter(member => !query || member.name.toLowerCase().includes(query))
      .slice(0, 8)
  }, [mention, members])

  const activeIndex = Math.min(mention?.index ?? 0, Math.max(0, candidates.length - 1))

  const updateMention = (value: string, caret: number) => {
    const before = value.slice(0, caret)
    const at = before.lastIndexOf('@')
    const query = at >= 0 ? before.slice(at + 1) : ''
    if (at < 0 || /\s/.test(query)) {
      setMention(null)
      return
    }
    setMention({
      start: at,
      query,
      open: true,
      index: 0,
    })
  }

  const selectMention = (member: DirectoryMember) => {
    if (!mention) return
    const textarea = textareaRef.current
    const caret = textarea?.selectionStart ?? draft.length
    const next = draft.slice(0, mention.start) + `@${member.name} ` + draft.slice(caret)
    const cursor = mention.start + member.name.length + 2
    setDraft(next)
    setSelected(current => [...current.filter(item => item.id !== member.id), {id: member.id, name: member.name}])
    setMention(null)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(cursor, cursor)
    })
  }

  const triggerMention = () => {
    const textarea = textareaRef.current
    const caret = textarea?.selectionStart ?? draft.length
    const prefix = caret > 0 && !/\s/.test(draft[caret - 1] ?? '') ? ' ' : ''
    const insertion = `${prefix}@`
    const next = draft.slice(0, caret) + insertion + draft.slice(caret)
    const cursor = caret + insertion.length
    setDraft(next)
    setMention({start: cursor - 1, query: '', open: true, index: 0})
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(cursor, cursor)
    })
  }

  const submit = async () => {
    const content = draft.trim()
    if (!content || submitting) return
    const mentionedUserIds = selected
      .filter(member => content.includes(`@${member.name}`))
      .slice(0, 20)
      .map(member => member.id)
    const success = await onSubmit(content, mentionedUserIds)
    if (success) {
      setDraft('')
      setSelected([])
      setMention(null)
    }
  }

  return <div className="relative">
    {mention?.open && <div
      className="absolute left-0 top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
      {directoryError ? <p className="px-2 py-2 text-xs text-muted-foreground">{directoryError}</p>
        : !members.length ? <p className="px-2 py-2 text-xs text-muted-foreground">正在加载成员…</p>
          : !candidates.length ? <p className="px-2 py-2 text-xs text-muted-foreground">没有匹配的成员</p>
            : candidates.map((member, index) => <button
              key={member.id}
              type="button"
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${index === activeIndex ? 'bg-primary/10 text-foreground' : 'hover:bg-muted'}`}
              onMouseDown={event => {
                event.preventDefault()
                selectMention(member)
              }}>
              <UserAvatar name={member.name} src={member.avatar} size={24}/>
              <span className="min-w-0 flex-1 truncate text-[13px]">{member.name}</span>
              {member.role && <span className="shrink-0 text-[11px] text-muted-foreground">{member.role}</span>}
            </button>)}
    </div>}
    <div
      className="rounded-lg border bg-background transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
        <textarea
          ref={textareaRef}
          aria-label={replyTo ? `回复 ${replyTo.authorName}` : '添加讨论'}
          disabled={submitting}
          value={draft}
          maxLength={2000}
          onChange={event => {
            setDraft(event.target.value)
            updateMention(event.target.value, event.target.selectionStart)
          }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) return
            if (mention?.open && candidates.length > 0) {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setMention(current => current
                  ? {...current, index: (activeIndex + 1) % candidates.length}
                  : current)
                return
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setMention(current => current
                  ? {...current, index: (activeIndex - 1 + candidates.length) % candidates.length}
                  : current)
                return
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setMention(null)
                return
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                selectMention(candidates[activeIndex])
                return
              }
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
          rows={2}
          placeholder={replyTo ? `回复 ${replyTo.authorName} 的讨论` : '说点什么吧'}
          className="block min-h-[56px] w-full resize-none rounded-t-lg bg-transparent px-3 pt-2.5 text-[13px] leading-6 outline-none placeholder:text-muted-foreground"/>
      <div className="flex items-center justify-between pb-2 pl-2 pr-2">
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="提及成员"
                  className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={triggerMention}>
            <AtSign className="h-4 w-4"/>
          </button>
          <span className="text-[11px] text-muted-foreground">Enter 发送</span>
        </div>
        <Button size="xs" className="px-3" disabled={!draft.trim() || submitting} onClick={() => void submit()}>
          {submitting ? '发送中…' : '发送'}
        </Button>
      </div>
    </div>
  </div>
}

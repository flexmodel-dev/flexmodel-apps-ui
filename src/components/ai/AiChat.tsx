import * as React from 'react'
import ReactMarkdown, {type Components} from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  AtSign,
  Bot,
  Brain,
  Check,
  ChevronDown,
  Copy,
  History,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Send,
  Square,
  Trash2,
  Wrench,
  X
} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from '@/components/ui/dropdown-menu'
import {useAiAssistant} from './AiProvider'
import {getApps, type App} from '@/services/apps'
import {getAppPrimaryColor} from '@/theme/appPrimaryColors'
import {type AiMessage, type AiRobot} from '@/services/ai'
import {cn} from '@/lib/utils'

interface MentionState {
  start: number;
  query: string
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 应用名可能自带空格，所以按已知应用名精确匹配（长名优先），不能取到下一个空白为止。
const mentionAlternation = (apps: App[]) => {
  const names = apps.map(app => app.name).filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRegExp)
  return names.length ? `(?:^|\\s)@(${names.join('|')})` : ''
}

export function AiComposer({onSend, onStop, busy, placeholder = '发送消息，Shift + Enter 换行', initialValue = ''}: {
  onSend: (content: string) => Promise<boolean | void>;
  onStop?: () => void;
  busy: boolean;
  placeholder?: string;
  initialValue?: string
}) {
  const [draft, setDraft] = React.useState(initialValue)
  const [caret, setCaret] = React.useState(0)
  const [apps, setApps] = React.useState<App[] | null>(null)
  const {refreshVersion} = useAiAssistant()
  React.useEffect(() => {
    setApps(null)
  }, [refreshVersion])
  const [dismissed, setDismissed] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const overlayRef = React.useRef<HTMLDivElement>(null)

  // 光标前的“@词”视为正在输入的应用提及；仅识别行首或空白后的 @。
  const mention = React.useMemo<MentionState | null>(() => {
    const before = draft.slice(0, caret)
    const match = /(?:^|\s)@([^\s@]*)$/.exec(before)
    if (!match) return null
    return {start: caret - match[1].length - 1, query: match[1]}
  }, [draft, caret])

  const loadApps = React.useCallback(() => {
    if (apps !== null) return
    getApps().then(list => setApps(list)).catch(() => setApps([]))
  }, [apps])

  React.useEffect(() => {
    if (mention) loadApps()
  }, [mention, loadApps])
  React.useEffect(() => {
    if (draft.includes('@')) loadApps()
  }, [draft, loadApps])
  React.useEffect(() => {
    setDismissed(false);
    setActiveIndex(0)
  }, [mention?.query])

  const candidates = React.useMemo(() => {
    if (!mention || dismissed || apps === null) return []
    const query = mention.query.toLowerCase()
    return apps.filter(app => !query || app.name.toLowerCase().includes(query)).slice(0, 8)
  }, [mention, dismissed, apps])

  const mentionAlt = React.useMemo(() => apps?.length ? mentionAlternation(apps) : '', [apps])
  // 着色：整段提及后必须是空白或文本结尾，才视为“已选中”的提及。
  const mentionPattern = React.useMemo(() => mentionAlt ? new RegExp(`${mentionAlt}(?=\\s|$)`, 'g') : null, [mentionAlt])
  const mentionTailPattern = React.useMemo(() => mentionAlt ? new RegExp(`${mentionAlt} ?$`) : null, [mentionAlt])
  const mentionColor = React.useMemo(() => new Map((apps ?? []).map(app => [app.name, getAppPrimaryColor(app.primaryColor).swatch] as const)), [apps])

  // 输入框内的完整 @ 应用提及按应用主色加粗展示（叠加层渲染，textarea 文字透明）。
  // 加粗用 text-stroke 而不是 font-bold：字重会改变字形宽度，光标与选区就会和着色层错位。
  const renderedDraft = React.useMemo(() => {
    if (!mentionPattern || !draft.includes('@')) return draft
    const parts: React.ReactNode[] = []
    let last = 0
    mentionPattern.lastIndex = 0
    for (let match = mentionPattern.exec(draft); match; match = mentionPattern.exec(draft)) {
      const start = match.index + match[0].length - match[1].length - 1
      const end = match.index + match[0].length
      if (start > last) parts.push(draft.slice(last, start))
      parts.push(<span key={start} style={{
        color: mentionColor.get(match[1]),
        WebkitTextStroke: '0.4px currentColor'
      }}>{draft.slice(start, end)}</span>)
      last = end
    }
    if (!parts.length) return draft
    parts.push(draft.slice(last))
    return parts
  }, [draft, mentionPattern, mentionColor])

  const syncCaret = () => setCaret(textareaRef.current?.selectionStart ?? 0)
  const focusAt = (position: number) => {
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(position, position)
      setCaret(position)
    })
  }
  const pickApp = (app: App) => {
    if (!mention) return
    const next = draft.slice(0, mention.start) + `@${app.name} ` + draft.slice(mention.start + 1 + mention.query.length)
    setDraft(next)
    focusAt(mention.start + app.name.length + 2)
  }
  // 退格时若光标紧随一个完整选中的 @ 应用提及（含其尾随空格），整体删除而不是删一个字符。
  const deleteMentionBeforeCaret = () => {
    const el = textareaRef.current
    if (!el || el.selectionStart !== el.selectionEnd || !mentionTailPattern) return false
    const caret = el.selectionStart
    const match = mentionTailPattern.exec(draft.slice(0, caret))
    if (!match) return false
    // 还没打尾随空格说明可能仍在输入，下拉开着就退回逐字删除。
    const trailingSpace = match[0].endsWith(' ')
    if (!trailingSpace && !dismissed) return false
    const start = match.index === 0 ? 0 : match.index + 1
    const end = trailingSpace || draft[caret] !== ' ' ? caret : caret + 1
    setDraft(draft.slice(0, start) + draft.slice(end))
    focusAt(start)
    return true
  }
  // 下方 @ 按钮：在光标处插入 "@"，随即弹出应用下拉（光标前非空白时自动补一个空格）。
  const openMentionPicker = () => {
    loadApps()
    if (mention) {
      setDismissed(false);
      textareaRef.current?.focus();
      return
    }
    const at = textareaRef.current?.selectionStart ?? draft.length
    const before = draft.slice(0, at)
    const prefix = before === '' || /\s$/.test(before) ? '' : ' '
    const next = before + prefix + '@' + draft.slice(at)
    setDraft(next)
    focusAt(at + prefix.length + 1)
    setDismissed(false)
  }
  const submit = async () => {
    if (!draft.trim() || busy) return
    const sent = draft.trim()
    const success = await onSend(sent)
    if (success !== false) setDraft(current => current.trim() === sent ? '' : current)
  }
  return <form onSubmit={event => {
    event.preventDefault();
    void submit()
  }} className="relative rounded-xl border bg-background p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
    {candidates.length > 0 && <div role="listbox" aria-label="选择应用"
                                   className="absolute bottom-full left-2 z-50 mb-2 max-h-64 w-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
      {candidates.map((app, index) => <button type="button" role="option" aria-selected={index === activeIndex}
                                              key={app.id}
                                              onMouseEnter={() => setActiveIndex(index)} onClick={() => pickApp(app)}
                                              className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                                                index === activeIndex ? 'bg-accent text-accent-foreground' : 'text-popover-foreground')}>
        <span className="truncate">{app.name}</span>
      </button>)}
    </div>}
    <div className="relative">
      <div ref={overlayRef} aria-hidden
           className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-2 py-1 text-sm">
        {renderedDraft}
      </div>
      <Textarea ref={textareaRef} aria-label="消息内容" value={draft} maxLength={4000} rows={2}
                placeholder={placeholder}
                onChange={event => {
                  setDraft(event.target.value);
                  setCaret(event.target.selectionStart)
                }}
                onClick={syncCaret} onSelect={syncCaret} onKeyUp={syncCaret}
                onScroll={event => {
                  if (overlayRef.current) overlayRef.current.scrollTop = event.currentTarget.scrollTop
                }}
                onKeyDown={event => {
                  if (event.nativeEvent.isComposing) return
                  if (event.key === 'Backspace' && deleteMentionBeforeCaret()) {
                    event.preventDefault();
                    return
                  }
                  if (candidates.length > 0) {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setActiveIndex(index => (index + 1) % candidates.length);
                      return
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setActiveIndex(index => (index - 1 + candidates.length) % candidates.length);
                      return
                    }
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      pickApp(candidates[activeIndex]);
                      return
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setDismissed(true);
                      return
                    }
                  }
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submit()
                  }
                }}
                className="max-h-40 min-h-[68px] resize-none border-0 bg-transparent px-2 py-1 text-transparent shadow-none focus-visible:ring-0 [caret-color:hsl(var(--foreground))]"/>
    </div>
    <div className="flex items-center justify-between gap-2 px-1 pt-1">
      <div className="flex min-w-0 items-center gap-1">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground"
                aria-label="上传附件（暂不支持）" disabled>
          <Paperclip className="h-3.5 w-3.5"/>
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground"
                aria-label="选择应用" title="选择要操作的应用" onClick={openMentionPicker} disabled={busy}>
          <AtSign className="h-3.5 w-3.5"/>
        </Button>
        {draft.length > 3500 && <span className="truncate text-[11px] text-muted-foreground">{draft.length}/4000</span>}
      </div>
      {busy && onStop
        ? <Button type="button" size="icon" className="h-8 w-8 shrink-0" onClick={onStop} aria-label="停止生成"
                  title="停止生成">
          <Square className="h-3 w-3 fill-current"/>
        </Button>
        : <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={busy || !draft.trim()}
                  aria-label="发送消息">
          {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
        </Button>}
    </div>
  </form>
}

// react-markdown 默认不渲染原始 HTML，回复里的链接改为新标签页打开。
const markdownRemarkPlugins = [remarkGfm]
const markdownComponents: Components = {
  a: ({node, children, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>
}

// 回复还没落地时的占位动效：跳动的三点比静态省略号更能说明仍在生成。
export function AiTypingIndicator({label = '正在回复'}: { label?: string }) {
  return <div role="status" aria-live="polite" className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
    <span className="flex items-center gap-1" aria-hidden>
      {[0, 160, 320].map(delay => <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
                                        style={{animationDelay: `${delay}ms`, animationDuration: '900ms'}}/>)}
    </span>
    <span>{label}…</span>
  </div>
}

// 流式增量只在该区域本来就贴底时才跟随滚动，否则用户上翻阅读会被每一次 token 拽回底部。
// jump 变化时无条件贴底（切换会话、展开折叠内容）。
function useStickyScroll<T extends HTMLElement>(jump: string | number, follow: string | number) {
  const ref = React.useRef<T>(null)
  const pinned = React.useRef(true)
  React.useEffect(() => {
    pinned.current = true
    const scroller = ref.current
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [jump])
  React.useEffect(() => {
    const scroller = ref.current
    if (scroller && pinned.current) scroller.scrollTop = scroller.scrollHeight
  }, [follow])
  const onScroll = (event: React.UIEvent<T>) => {
    const scroller = event.currentTarget
    pinned.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 32
  }
  return {ref, onScroll}
}

// 单轮推理的折叠块：正在生成的那一轮展开，已结束的轮次收起；用户手动开合后不再被后续渲染覆盖。
export function AiReasoningBlock({content, label, streaming = false}: {
  content: string;
  label?: string;
  streaming?: boolean
}) {
  const [open, setOpen] = React.useState(streaming)
  const scroll = useStickyScroll<HTMLDivElement>(open ? 'open' : 'closed', content.length)
  if (!content) return null
  return <div className="mb-2 overflow-hidden rounded-lg border border-border/60 bg-muted/30">
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
      {streaming
        ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin"/>
        : <Brain className="h-3.5 w-3.5 shrink-0"/>}
      <span className="shrink-0">{streaming ? '正在思考' : '思考过程'}</span>
      {label && <span className="truncate opacity-70">{label}</span>}
      <ChevronDown className={cn('ml-auto h-3.5 w-3.5 shrink-0 transition-transform', !open && '-rotate-90')}/>
    </button>
    {open && <div ref={scroll.ref} onScroll={scroll.onScroll}
                  className="slim-scroll max-h-60 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words border-t border-border/60 px-3 py-2.5 text-xs leading-6 text-muted-foreground">
      {content}
      {streaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-current align-middle"/>}
    </div>}
  </div>
}

// 多轮思考时给每轮编号，避免连续几条同款折叠行难以区分。
const reasoningLabel = (index: number, total: number) => total > 1 ? `第 ${index + 1} 步` : undefined

export function AiMessageView({message}: { message: Pick<AiMessage, 'role' | 'content'> & Partial<AiMessage> }) {
  const [copied, setCopied] = React.useState(false)
  const reasoningParts = message.parts?.filter(part => part.type === 'reasoning' && part.content) ?? []
  return message.role === 'user' ? <div
      className="ml-auto max-w-[90%] whitespace-pre-wrap break-words rounded-xl bg-muted px-4 py-3 text-sm">{message.content}</div> :
    <div className="flex min-w-0 gap-3">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-background text-primary"><Bot
        className="h-4 w-4"/></span>
      <div className="min-w-0 flex-1">
        {reasoningParts.map((part, index) => <AiReasoningBlock key={index} content={part.content}
                                                               label={reasoningLabel(index, reasoningParts.length)}/>)}
        <div className="ai-markdown break-words text-sm leading-7"><ReactMarkdown remarkPlugins={markdownRemarkPlugins}
                                                                                  components={markdownComponents}>{message.content}</ReactMarkdown>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" aria-label="复制回复"
                  onClick={() => {
                    void navigator.clipboard?.writeText(message.content).then(() => setCopied(true)).catch(() => setCopied(false))
                  }}>{copied ? <Check className="h-3.5 w-3.5"/> : <Copy className="h-3.5 w-3.5"/>}</Button>
        </div>
      </div>
    </div>
}

export function AiChat({robot, compact = false, showSuggestions = true, receivePrompt = false, title, onClose}: {
  robot: AiRobot;
  compact?: boolean;
  showSuggestions?: boolean;
  receivePrompt?: boolean;
  title?: string;
  onClose?: () => void
}) {
  const ai = useAiAssistant()
  const {ensureRoom, send} = ai
  const room = ai.room(robot.id)
  const conversation = room.conversations.find(item => item.id === room.activeId)
  const messages = conversation?.messages ?? []
  const streaming = room.streaming
  const streamingReasoning = streaming?.reasoningParts ?? []
  const reasoningLength = streaming
    ? streamingReasoning.reduce((size, part) => size + part.length, 0) + streaming.reasoning.length : 0
  const listScroll = useStickyScroll<HTMLDivElement>(room.activeId ?? '',
    `${messages.length}|${streaming?.text.length ?? 0}|${reasoningLength}`)
  React.useEffect(() => {
    void ensureRoom(robot.id)
  }, [robot.id, ensureRoom])
  React.useEffect(() => {
    // 快捷提问按机器人定向：未指定机器人时由内置助手消费。
    // 首次挂载时 ensureRoom 已经把房间标记为加载中，这里必须等历史会话就绪，否则提问会被消费却发不出去。
    const promptTarget = !ai.request.robotId || ai.request.robotId === robot.id
    if (receivePrompt && ai.request.prompt && promptTarget && room.initialized && !room.loading && !room.busy) {
      const prompt = ai.request.prompt
      ai.consumePrompt()
      void send(robot.id, prompt)
    }
  }, [receivePrompt, ai.request, robot.id, room.initialized, room.loading, room.busy, send, ai.consumePrompt])
  const sendText = (content: string) => send(robot.id, content)
  // 面板形态：标题在左，会话操作只保留图标。
  const iconOnly = !!title
  const actionSize = iconOnly ? 'icon' : 'sm'
  const actionClass = iconOnly ? 'h-8 w-8 shrink-0' : undefined
  return <div className="flex h-full min-h-0 flex-col" data-testid="ai-chat">
    <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
      {title && <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h3>}
      <Button variant="ghost" size={actionSize} className={actionClass} aria-label="新对话" title="新对话"
              disabled={room.busy} onClick={() => ai.selectConversation(robot.id)}><MessageSquarePlus
        className="h-4 w-4"/>{!iconOnly && '新对话'}</Button>
      <div className={cn('flex items-center gap-1', !title && 'ml-auto')}>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size={actionSize} className={actionClass}
                                                           aria-label="历史会话" title="历史会话"
                                                           disabled={room.loading || room.busy}><History
          className="h-4 w-4"/>{!iconOnly && '历史会话'}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
            {room.conversations.length ? room.conversations.map(item => <div key={item.id}
                                                                             className="flex items-center gap-1">
              <DropdownMenuItem className="min-w-0 flex-1"
                                onClick={() => ai.selectConversation(robot.id, item.id)}><span
                className="truncate">{item.title}</span></DropdownMenuItem>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground"
                      aria-label={`删除会话 ${item.title}`}
                      onClick={() => void ai.removeConversation(robot.id, item.id)}><Trash2
                className="h-3.5 w-3.5"/></Button>
            </div>) : <p className="p-3 text-xs text-muted-foreground">暂无历史会话</p>}
          </DropdownMenuContent>
        </DropdownMenu>
        {onClose && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="关闭 AI 助手"
                            title="关闭 AI 助手" onClick={onClose}><X className="h-4 w-4"/></Button>}
      </div>
    </div>
    <div ref={listScroll.ref} onScroll={listScroll.onScroll}
         className="slim-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
      <div className={cn('mx-auto flex w-full flex-col gap-6', !compact && 'max-w-3xl')}>
        {room.loading ?
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/>
          </div> : !messages.length && !streaming ?
            <div className={cn('flex flex-col items-start', compact ? 'py-5' : 'py-12 md:py-20')}>
              <div
                className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border bg-primary/5 text-primary">
                <Bot className="h-6 w-6"/></div>
              <h2 className={cn('font-semibold tracking-tight', compact ? 'text-lg' : 'text-2xl')}>有什么可以帮你？</h2>
              <p
                className="mt-3 max-w-xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{robot.greeting}</p>
              {showSuggestions && <div className="mt-6 flex flex-wrap gap-2">{robot.suggestions.map(question =>
                <Button key={question} variant="outline" size="sm"
                        className="h-auto max-w-full whitespace-normal py-2 text-left font-normal"
                        disabled={!robot.enabled || !!room.error}
                        onClick={() => void sendText(question)}>{question}</Button>)}</div>}
            </div> : messages.map(message => <AiMessageView key={message.id} message={message}/>)}
        {streaming && <div className="flex flex-col gap-6" data-testid="ai-streaming">
          <AiMessageView message={{role: 'user', content: streaming.user}}/>
          <div className="flex min-w-0 gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-background text-primary"><Bot
              className="h-4 w-4"/></span>
            <div className="min-w-0 flex-1">
              {streamingReasoning.map((content, index) => <AiReasoningBlock key={index} content={content}
                                                                            label={reasoningLabel(index, streamingReasoning.length + (streaming.reasoning ? 1 : 0))}/>)}
              <AiReasoningBlock streaming content={streaming.reasoning}/>
              {streaming.tool &&
                <p
                  className="mb-2 flex items-center gap-1.5 rounded-md bg-primary/5 px-2.5 py-1.5 text-xs text-muted-foreground">
                  <Wrench
                    className="h-3.5 w-3.5 shrink-0 text-primary"/>正在调用工具 {streaming.tool}…</p>}
              <div className="ai-markdown break-words text-sm leading-7">
                {streaming.text
                  ? <ReactMarkdown remarkPlugins={markdownRemarkPlugins}
                                   components={markdownComponents}>{streaming.text}</ReactMarkdown>
                  : !streaming.reasoning && !streamingReasoning.length && !streaming.tool &&
                  <AiTypingIndicator label="正在思考"/>}
              </div>
            </div>
          </div>
        </div>}
        {room.busy && (!streaming || streaming.text) &&
          <AiTypingIndicator label={streaming ? '正在回复' : '正在整理回复'}/>}
      </div>
    </div>
    <div className="shrink-0 px-4 pb-4">
      <div className={cn('mx-auto w-full', !compact && 'max-w-3xl')}>
        {room.error && <div role="alert"
                            className="mb-3 flex items-center justify-between gap-2 rounded-md bg-destructive/5 p-3 text-xs text-destructive">
          <span>{room.error}</span><Button variant="ghost" size="sm"
                                           onClick={() => void ensureRoom(robot.id, true)}>重试</Button></div>}
        {!robot.enabled && <p className="mb-2 text-xs text-muted-foreground">该机器人已停用</p>}
        <AiComposer key={robot.id} onSend={sendText} onStop={room.busy ? () => ai.stop(robot.id) : undefined}
                    busy={room.busy || room.loading || !robot.enabled}/>
        <p className="mb-0 mt-2 text-center text-[11px] text-muted-foreground">AI
          生成内容仅供参考，写操作仅应用所有者与管理员可用</p>
      </div>
    </div>
  </div>
}

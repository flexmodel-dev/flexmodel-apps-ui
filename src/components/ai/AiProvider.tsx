import * as React from 'react'
import {useLocation} from 'react-router-dom'
import {getAuthSession} from '@/services/auth'
import {
  AI_ASSISTANT_ROBOT_ID, createAiConversation, deleteAiConversation, getAiConversations, getAiRobots,
  streamAiMessage, type AiConversation, type AiMessage, type AiRobot,
} from '@/services/ai'
import {toErrorMessage} from '@/lib/utils'

/** streaming：发送后到 done/error 之间的本地草稿（用户消息 + 推理块 + 增量回复 + 执行中的工具名）。 */
interface Room {
  conversations: AiConversation[]
  activeId?: string
  loading: boolean
  busy: boolean
  error?: string
  /** 历史会话是否已加载完毕；快捷提问要等它就绪，否则会和首次 ensureRoom 抢跑。 */
  initialized?: boolean
  streaming?: { user: string; text: string; tool?: string; reasoning: string; reasoningParts: string[] }
}

const emptyRoom: Room = {conversations: [], loading: false, busy: false}

interface OpenRequest {
  robotId?: string;
  prompt?: string;
  nonce?: number
}

/**
 * 统一 AI 会话状态：房间按机器人区分（内置助手全站共用一个房间）。
 * 发送消息时若在应用内且对话对象是内置助手，自动携带当前应用作为隐藏上下文；
 * 用户也可以在消息中用「@应用名」显式指定一个或多个应用。
 */
function useAiState() {
  const location = useLocation()
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [request, setRequest] = React.useState<OpenRequest>({})
  const [rooms, setRooms] = React.useState<Record<string, Room>>({})
  const roomRef = React.useRef(rooms)
  const controllersRef = React.useRef<Record<string, AbortController>>({})
  const routeAppId = location.pathname.match(/\/(?:admin\/)?apps\/([^/]+)/)?.[1]
  const appId = routeAppId
  const isAdmin = location.pathname.startsWith('/admin')
  const userId = getAuthSession()?.user.id ?? ''
  const keyFor = React.useCallback((robot: string) => `${userId}:${robot}`, [userId])
  const update = React.useCallback((key: string, mutate: (room: Room) => Room) => {
    const next = {...roomRef.current, [key]: mutate(roomRef.current[key] ?? emptyRoom)}
    roomRef.current = next
    setRooms(next)
  }, [])
  const ensureRoom = React.useCallback(async (robot: string, retry = false) => {
    const key = keyFor(robot)
    if (roomRef.current[key] && !retry) return
    update(key, room => ({...room, loading: true, error: undefined}))
    try {
      const conversations = await getAiConversations(robot)
      update(key, room => ({...room, conversations, loading: false, initialized: true}))
    } catch (error) {
      update(key, room => ({
        ...room,
        loading: false,
        initialized: true,
        error: toErrorMessage(error, '加载历史会话失败')
      }))
    }
  }, [keyFor, update])
  const send = React.useCallback(async (robot: string, content: string) => {
    const key = keyFor(robot)
    if (!content.trim() || roomRef.current[key]?.busy || roomRef.current[key]?.loading) return false
    const controller = new AbortController()
    controllersRef.current[key] = controller
    update(key, room => ({
      ...room, busy: true, error: undefined,
      streaming: {user: content, text: '', reasoning: '', reasoningParts: []}
    }))
    // token/tool 事件结束当前推理块；之后的 reasoning 增量属于新块，与后端块边界规则一致。
    const closeReasoning = (draft: NonNullable<Room['streaming']>) => draft.reasoning
      ? {...draft, reasoning: '', reasoningParts: [...draft.reasoningParts, draft.reasoning]}
      : draft
    const appendToken = (delta: string) => update(key, room => room.streaming
      ? {...room, streaming: {...closeReasoning(room.streaming), text: room.streaming.text + delta}} : room)
    const appendReasoning = (delta: string) => update(key, room => room.streaming
      ? {...room, streaming: {...room.streaming, reasoning: room.streaming.reasoning + delta}} : room)
    const markTool = (tool: string) => update(key, room => room.streaming
      ? {...room, streaming: {...closeReasoning(room.streaming), tool}} : room)
    const handleDone = (conversation: AiConversation) => update(key, room => ({
      ...room, busy: false, streaming: undefined,
      conversations: [conversation, ...room.conversations.filter(item => item.id !== conversation.id)]
    }))
    const handleError = (message: string) => update(key, room => ({
      ...room,
      busy: false,
      streaming: undefined,
      error: message
    }))
    // 主动终止不算失败：把已流出的片段落到本地会话，否则提问和半截回复会一起消失。
    const finalizeStopped = () => update(key, room => {
      const draft = room.streaming
      const active = room.conversations.find(item => item.id === room.activeId)
      if (!draft || !active) return {...room, busy: false, streaming: undefined}
      const createdAt = new Date().toISOString()
      const stamp = Date.now()
      const messages: AiMessage[] = [...active.messages, {
        id: `local-${stamp}-user`,
        role: 'user',
        content: draft.user,
        createdAt
      }]
      // 停止时已流出的推理块也一并落为本地消息，刷新后以服务端成功历史为准。
      const reasoning = draft.reasoningParts.concat(draft.reasoning ? [draft.reasoning] : [])
      if (draft.text || reasoning.length) messages.push({
        id: `local-${stamp}-assistant`, role: 'assistant', content: draft.text,
        parts: reasoning.length ? reasoning.map(content => ({type: 'reasoning' as const, content})) : undefined,
        createdAt
      })
      return {
        ...room, busy: false, streaming: undefined,
        conversations: room.conversations.map(item => item.id === active.id ? {...item, messages} : item)
      }
    })
    try {
      let id = roomRef.current[key]?.activeId
      if (!id) {
        const conversation = await createAiConversation(robot)
        id = conversation.id
        update(key, room => ({...room, activeId: id, conversations: [conversation, ...room.conversations]}))
      }
      // 隐藏应用上下文：仅内置助手携带当前所在应用；应用机器人的上下文由后端按机器人归属解析。
      const contextApp = robot === AI_ASSISTANT_ROBOT_ID ? appId : undefined
      await streamAiMessage(id, content, {
        onToken: appendToken,
        onReasoning: appendReasoning,
        onTool: markTool,
        onDone: handleDone,
        onError: handleError
      }, contextApp, controller.signal)
      return true
    } catch (error) {
      if (controller.signal.aborted) {
        finalizeStopped();
        return true
      }
      update(key, room => ({
        ...room,
        busy: false,
        streaming: undefined,
        error: toErrorMessage(error, '发送失败，请重试')
      }))
      return false
    } finally {
      delete controllersRef.current[key]
    }
  }, [appId, keyFor, update])
  const stop = React.useCallback((robot: string) => {
    controllersRef.current[keyFor(robot)]?.abort()
  }, [keyFor])
  const removeConversation = async (robot: string, id: string) => {
    const key = keyFor(robot)
    if (roomRef.current[key]?.busy) return
    try {
      await deleteAiConversation(id)
      update(key, room => ({
        ...room,
        conversations: room.conversations.filter(item => item.id !== id),
        activeId: room.activeId === id ? undefined : room.activeId
      }))
    } catch (error) {
      update(key, room => ({...room, error: toErrorMessage(error, '删除会话失败')}))
    }
  }
  return {
    panelOpen, request, appId, isAdmin,
    openAssistant: (input: OpenRequest = {}) => {
      setRequest({...input, nonce: Date.now()});
      setPanelOpen(true)
    },
    closeAssistant: () => {
      setPanelOpen(false)
      // 关闭时丢弃未发送的快捷提问，避免下次打开时重复发送。
      setRequest(previous => ({...previous, prompt: undefined}))
    },
    consumePrompt: () => setRequest(previous => ({...previous, prompt: undefined})),
    room: (robot: string) => rooms[keyFor(robot)] ?? emptyRoom,
    ensureRoom, send, stop, removeConversation,
    selectConversation: (robot: string, activeId?: string) => update(keyFor(robot), room => room.busy ? room : {
      ...room,
      activeId,
      error: undefined
    }),
  }
}

type AiContextValue = ReturnType<typeof useAiState>
const AiContext = React.createContext<AiContextValue | null>(null)

export function AiProvider({children}: { children: React.ReactNode }) {
  return <AiContext.Provider value={useAiState()}>{children}</AiContext.Provider>
}

export function useAiAssistant() {
  const context = React.useContext(AiContext)
  if (!context) throw new Error('AI components must be wrapped in AiProvider')
  return context
}

export function useAiRobots(appId?: string) {
  const [robots, setRobots] = React.useState<AiRobot[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [version, refresh] = React.useReducer(value => value + 1, 0)
  React.useEffect(() => {
    const updated = (event: Event) => {
      if ((event as CustomEvent).detail === appId) refresh()
    }
    window.addEventListener('ai-robots-updated', updated)
    return () => window.removeEventListener('ai-robots-updated', updated)
  }, [appId])
  React.useEffect(() => {
    let cancelled = false
    setRobots([]);
    setError('');
    setLoading(Boolean(appId))
    if (appId) getAiRobots(appId).then(items => {
      if (!cancelled) setRobots(items)
    })
      .catch(caught => {
        if (!cancelled) setError(toErrorMessage(caught, '加载机器人失败'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appId, version])
  return {robots, loading, error, refresh}
}

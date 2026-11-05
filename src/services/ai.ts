import {requestJson, requestSse} from '@/services/http'

export interface AiRobot {
  id: string
  name: string
  description: string
  greeting: string
  suggestions: string[]
  prompt: string
  enabled: boolean
}

export type AiRobotInput = Omit<AiRobot, 'id'>

/** 消息内容块：reasoning 为供应商原生返回的推理文本，前端折叠展示。 */
export interface AiMessagePart {
  type: 'reasoning' | 'text'
  content: string
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  parts?: AiMessagePart[]
}

export interface AiConversation {
  id: string
  robotId: string
  title: string
  messages: AiMessage[]
  updatedAt: string
}

/** 顶部常驻助手的保留机器人ID：与后端 ASSISTANT_ROBOT_ID 对应，不写机器人表。 */
export const AI_ASSISTANT_ROBOT_ID = 'assistant'
/** 应用助手：在应用内打开时自动携带当前应用作为隐藏上下文。 */
export const AI_ASSISTANT_ROBOT: AiRobot = {
  id: AI_ASSISTANT_ROBOT_ID,
  name: '应用助手',
  description: '围绕当前应用回答问题',
  greeting: '你好，我可以帮你查询记录、整理信息，或分析业务情况。用「@应用名」也可以操作其他应用。',
  suggestions: ['最近有哪些新增记录？', '帮我汇总当前业务情况', '有哪些需要优先处理的事项？'],
  prompt: '围绕当前应用回答业务问题。',
  enabled: true,
}
/** 管理区助手：同一机器人（assistant）的另一套展示文案，会话与应用助手共用。 */
export const AI_BUILDER_ROBOT: AiRobot = {
  id: AI_ASSISTANT_ROBOT_ID,
  name: '应用搭建助手',
  description: '创建与完善你的应用',
  greeting: '你好，描述你想管理的业务，我会帮你创建应用、表单、流程、工作台与导航。用「@应用名」可以切换到具体应用。',
  suggestions: ['帮我搭建一个客户跟进管理应用', '创建一个库存与出入库管理应用', '搭建一个费用报销应用'],
  prompt: '',
  enabled: true,
}

const robotsBase = (appId: string) => `/api/apps/${encodeURIComponent(appId)}/ai/robots`
const robotBase = (appId: string, robotId: string) => `${robotsBase(appId)}/${encodeURIComponent(robotId)}`
export const getAiRobots = (appId: string) => requestJson<AiRobot[]>(robotsBase(appId))

export async function saveAiRobot(appId: string, input: AiRobotInput, id?: string) {
  const robot = await requestJson<AiRobot>(id ? robotBase(appId, id) : robotsBase(appId), {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(input)
  })
  window.dispatchEvent(new CustomEvent('ai-robots-updated', {detail: appId}))
  return robot
}

export async function deleteAiRobot(appId: string, id: string) {
  await requestJson<null>(robotBase(appId, id), {method: 'DELETE'})
  window.dispatchEvent(new CustomEvent('ai-robots-updated', {detail: appId}))
}

/**
 * 统一 AI 会话：按机器人 + 用户隔离，不按应用拆分。
 * robotId 省略使用内置助手；当前应用上下文在发送时以隐藏参数 appId 传递
 * （进入应用后由前端自动带上），消息中「@应用名」显式指定的应用优先且可多个。
 */
const conversationsBase = '/api/ai/conversations'
export const getAiConversations = (robotId: string = AI_ASSISTANT_ROBOT_ID) =>
  requestJson<AiConversation[]>(`${conversationsBase}?robotId=${encodeURIComponent(robotId)}`)
export const createAiConversation = (robotId: string = AI_ASSISTANT_ROBOT_ID) =>
  requestJson<AiConversation>(conversationsBase, {method: 'POST', body: JSON.stringify({robotId})})
export const deleteAiConversation = (id: string) =>
  requestJson<null>(`${conversationsBase}/${encodeURIComponent(id)}`, {method: 'DELETE'})

/** SSE 流式事件：token=增量文本、reasoning=推理增量、tool=工具名、done=完整会话、error=失败原因。 */
export interface AiStreamHandlers {
  onToken: (delta: string) => void
  onReasoning?: (delta: string) => void
  onTool?: (tool: string) => void
  onDone: (conversation: AiConversation) => void
  onError: (message: string) => void
}

export const streamAiMessage = (id: string, content: string, handlers: AiStreamHandlers, appId?: string, signal?: AbortSignal) =>
  streamEvents(`${conversationsBase}/${encodeURIComponent(id)}/messages`, {content, appId}, handlers, signal)

interface AiStreamEvent {
  type?: string;
  content?: string;
  conversation?: AiConversation
}

async function streamEvents(path: string, payload: {
  content: string;
  appId?: string
}, handlers: AiStreamHandlers, signal?: AbortSignal) {
  let finished = false
  await requestSse(path, {method: 'POST', body: JSON.stringify(payload), signal}, data => {
    if (!data || data === '[DONE]') return
    let event: AiStreamEvent
    try {
      event = JSON.parse(data) as AiStreamEvent
    } catch {
      return
    }
    if (event.type === 'token' && event.content) handlers.onToken(event.content)
    else if (event.type === 'reasoning' && event.content) handlers.onReasoning?.(event.content)
    else if (event.type === 'tool' && event.content) handlers.onTool?.(event.content)
    else if (event.type === 'done' && event.conversation) {
      finished = true
      handlers.onDone(event.conversation)
    } else if (event.type === 'error') {
      finished = true
      handlers.onError(event.content || 'AI 模型调用失败，请重试')
    }
  })
  if (!finished && !signal?.aborted) throw new Error('AI 连接已中断，请重试')
}

import type {NotificationEvent} from './notifications'

/** Streaming decoder handles arbitrary UTF-8 and CRLF chunk boundaries. */
export class SseDecoder {
  private buffer = ''

  constructor(private emit: (type: string, data: NotificationEvent) => void) {
  }

  push(chunk: string) {
    this.buffer += chunk
    const frames = this.buffer.split(/\r?\n\r?\n/)
    this.buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const lines = frame.split(/\r?\n/)
      const raw = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
      if (!raw) continue
      const type = lines.find(line => line.startsWith('event:'))?.slice(6).trim() ?? 'message'
      const data = JSON.parse(raw) as NotificationEvent
      if (!/^\d+$/.test(data.version)) throw new Error('通知事件版本无效')
      this.emit(type, data)
    }
  }
}

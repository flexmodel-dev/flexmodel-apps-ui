import {SseDecoder, type AppNotification, type NotificationEvent} from './notifications'
import type {AuthSession} from './auth'

interface Options {
  session: AuthSession
  onEvent: (type: string, data: NotificationEvent) => void
  onStatus: (status: string) => void
  onAlert: (item: AppNotification) => void
  onUnauthorized: () => void
}

type Packet =
  | { kind: 'presence'; tab: string; focused: boolean; time: number }
  | { kind: 'event'; type: string; data: NotificationEvent }
  | { kind: 'alert'; tab: string; item: AppNotification }
  | { kind: 'status'; status: string }
  | { kind: 'unauthorized' }
  | { kind: 'leave'; tab: string }

/** One authenticated stream per account and browser origin. No network polling. */
export function connectNotifications(options: Options) {
  const tab = crypto.randomUUID(), key = `flexmodel.notifications.${options.session.user.id}`
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(key) : null
  const lifetime = new AbortController()
  const presence = new Map<string, { focused: boolean; time: number }>()
  let leader = false, cursor = localStorage.getItem(`${key}.cursor`) ?? '', streamAbort: AbortController | undefined
  let connectionStatus = 'connecting'
  let disposed = false
  const shown = new Set<Notification>()
  const focused = () => document.visibilityState === 'visible' && document.hasFocus()
  const publish = (packet: Packet) => {
    channel?.postMessage(packet);
    receive(packet)
  }
  const status = (value: string) => {
    connectionStatus = value;
    publish({kind: 'status', status: value})
  }
  const open = (item: AppNotification) => {
    window.focus();
    window.location.hash = `/notifications?open=${encodeURIComponent(item.id)}`
  }
  const alert = (item: AppNotification) => {
    if (lifetime.signal.aborted) return
    const active = [...presence.entries()].filter(([, p]) => p.focused && Date.now() - p.time < 16000).sort((a, b) => b[1].time - a[1].time)[0]?.[0]
    if (active) {
      publish({kind: 'alert', tab: active, item});
      return
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(item.appName || 'Flexmodel', {
          body: item.title,
          tag: `${key}:${item.id}`,
          icon: '/favicon.ico'
        })
        shown.add(notification)
        notification.onclose = () => shown.delete(notification)
        notification.onclick = () => {
          open(item);
          notification.close()
        }
      } catch {
        options.onAlert(item)
      }
    } else options.onAlert(item)
  }

  function receive(packet: Packet) {
    if (lifetime.signal.aborted) return
    if (packet.kind === 'presence') {
      presence.set(packet.tab, {focused: packet.focused, time: packet.time})
      if (leader && packet.tab !== tab) channel?.postMessage({kind: 'status', status: connectionStatus})
    }
    if (packet.kind === 'leave') presence.delete(packet.tab)
    if (packet.kind === 'status') options.onStatus(packet.status)
    if (packet.kind === 'unauthorized') {
      options.onUnauthorized();
      lifetime.abort();
      streamAbort?.abort()
    }
    if (packet.kind === 'alert' && packet.tab === tab) options.onAlert(packet.item)
    if (packet.kind === 'event') options.onEvent(packet.type, packet.data)
  }

  if (channel) channel.onmessage = event => receive(event.data as Packet)
  const announce = () => {
    for (const [id, item] of presence) if (Date.now() - item.time > 16000) presence.delete(id)
    publish({kind: 'presence', tab, focused: focused(), time: Date.now()})
  }
  const pulse = window.setInterval(announce, 5000)
  window.addEventListener('focus', announce);
  window.addEventListener('blur', announce);
  document.addEventListener('visibilitychange', announce)
  announce()
  const run = async () => {
    leader = true
    let failures = 0
    while (!lifetime.signal.aborted) {
      streamAbort = new AbortController()
      const abort = () => streamAbort?.abort()
      lifetime.signal.addEventListener('abort', abort, {once: true})
      let timeout = window.setTimeout(abort, 45000)
      try {
        status('connecting')
        const response = await fetch('/api/notifications/stream', {
          headers: {Authorization: `Bearer ${options.session.token}`, ...(cursor ? {'Last-Event-ID': cursor} : {})},
          signal: streamAbort.signal
        })
        if (response.status === 401 || response.status === 403) {
          publish({kind: 'unauthorized'});
          break
        }
        if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('通知连接失败')
        const decoder = new TextDecoder()
        const parser = new SseDecoder((type, data) => {
          if (type !== 'ready' && type !== 'snapshot' && cursor && BigInt(data.version) <= BigInt(cursor)) return
          publish({kind: 'event', type, data})
          cursor = data.version;
          localStorage.setItem(`${key}.cursor`, cursor)
          if (type === 'ready') {
            failures = 0;
            status('connected')
          }
          if (type === 'notification.created' && !data.replay && data.notification) alert(data.notification)
        })
        const reader = response.body.getReader()
        try {
          while (!lifetime.signal.aborted) {
            const {done, value} = await reader.read()
            if (done) break
            clearTimeout(timeout);
            timeout = window.setTimeout(abort, 45000)
            parser.push(decoder.decode(value, {stream: true}))
          }
        } finally {
          await reader.cancel().catch(() => {
          })
        }
      } catch { /* Transport failures reconnect; persisted events provide catch-up. */
      } finally {
        clearTimeout(timeout);
        lifetime.signal.removeEventListener('abort', abort)
      }
      if (lifetime.signal.aborted) break
      status('reconnecting')
      const delay = Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)) * (0.8 + Math.random() * 0.4)
      await new Promise<void>(resolve => {
        const timer = window.setTimeout(resolve, delay);
        lifetime.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve()
        }, {once: true})
      })
    }
  }
  if (navigator.locks && channel) void navigator.locks.request(key, {signal: lifetime.signal}, run).catch(() => {
  })
  else void run()
  const online = () => {
    if (leader) streamAbort?.abort()
  }
  window.addEventListener('online', online)
  const dispose = () => {
    if (disposed) return
    disposed = true
    channel?.postMessage({kind: 'leave', tab})
    lifetime.abort();
    streamAbort?.abort();
    clearInterval(pulse)
    channel?.close();
    window.removeEventListener('focus', announce);
    window.removeEventListener('blur', announce);
    document.removeEventListener('visibilitychange', announce);
    window.removeEventListener('online', online)
    shown.forEach(notification => notification.close());
    shown.clear()
    window.removeEventListener('pagehide', dispose)
  }
  window.addEventListener('pagehide', dispose)
  const resume = (event: PageTransitionEvent) => {
    if (event.persisted) window.location.reload()
  }
  window.addEventListener('pageshow', resume)
  return () => {
    dispose();
    window.removeEventListener('pageshow', resume)
  }
}

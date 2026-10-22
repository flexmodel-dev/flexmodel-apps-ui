import {describe, it, expect} from 'vitest'
import {SseDecoder} from './notificationSse'
import {cloneNode, createApprovalNode, notificationTemplatePaths, renderNotificationTemplate} from '../lib/approval'

describe('notification stream and templates', () => {
  it('decodes UTF-8 chunks, CRLF frames, comments and string cursors', () => {
    const events: unknown[] = []
    const parser = new SseDecoder((type, data) => events.push({type, ...data}))
    const wire = ':heartbeat\r\n\r\nevent: notification.created\r\nid: 9007199254740993\r\ndata: {"version":"9007199254740993","notification":{"title":"审批提醒"}}\r\n\r\n'
    for (const char of wire) parser.push(char)
    expect(events).toEqual([{
      type: 'notification.created',
      version: '9007199254740993',
      notification: {title: '审批提醒'}
    }])
  })
  it('renders paths as plain text and rejects expressions, empty or oversized output', () => {
    expect(renderNotificationTemplate('金额 {{record.amount}} / {{missing}}', {record: {amount: 12}}, 200)).toBe('金额 12 / ')
    expect(() => notificationTemplatePaths('{{record.amount + 1}}')).toThrow()
    expect(() => renderNotificationTemplate('{{missing}}', {}, 200)).toThrow()
    expect(() => renderNotificationTemplate('abc', {}, 2)).toThrow()
    expect(() => renderNotificationTemplate('{{record.__proto__}}', {record: {}}, 200)).toThrow()
  })
  it('copies notification recipient rules and upstream output references', () => {
    const root = createApprovalNode('branch'), query = createApprovalNode('query'),
      notice = createApprovalNode('notification')
    if (query.data.config.kind !== 'query' || notice.data.config.kind !== 'notification') throw Error()
    query.data.config.output = 'queried'
    notice.data.config.titleTemplate = '{{queried.name}}'
    notice.data.config.rules = [{
      id: 'rule',
      source: 'variable',
      values: ['queried.owner'],
      scope: 'self',
      includeChildren: false
    }]
    root.blocks = [query, notice]
    const copy = cloneNode(root), next = copy.blocks![1].data.config
    if (next.kind !== 'notification') throw Error()
    expect(next.titleTemplate).not.toBe('{{queried.name}}')
    expect(next.rules[0].values[0]).not.toBe('queried.owner')
    expect(next.rules[0].id).not.toBe('rule')
  })
})

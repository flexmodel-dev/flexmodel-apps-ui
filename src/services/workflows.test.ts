import {beforeEach, describe, expect, it, vi} from 'vitest'
import {
  createApprovalFlow,
  duplicateApprovalFlow,
  getApprovalFlows,
  saveApprovalFlow,
  setApprovalFlowStatus
} from './workflows'
import {createApprovalNode, emptyDocument, newRule} from '../lib/workflow'
import type {ApprovalFlow} from '../types/workflow'
import {encodeApprovalFlow} from './workflow-model'

const transport = vi.hoisted(() => vi.fn())
vi.mock('./http', () => ({requestJson: transport}))
beforeEach(() => {
  transport.mockReset()
})
const flow = (): ApprovalFlow => ({
  id: 'flow-id',
  appId: 'app-a',
  name: '测试',
  description: '',
  status: 'draft',
  updatedAt: '',
  form: {kind: 'app', name: 'expense'},
  definition: emptyDocument()
})
describe('服务端审批契约', () => {
  it('空列表保持为空，接口错误直接反馈，不生成本地模板', async () => {
    transport.mockResolvedValueOnce([])
    expect(await getApprovalFlows('app-a')).toEqual([])
    transport.mockRejectedValueOnce(new Error('网络失败'))
    await expect(getApprovalFlows('app-a')).rejects.toThrow('网络失败')
  })
  it('保存走模型契约，启用走独立发布接口', async () => {
    const item = flow();
    transport.mockResolvedValue(encodeApprovalFlow(item))
    await saveApprovalFlow(item)
    const body = JSON.parse(transport.mock.calls[0][1].body)
    expect(body.id).toBe(item.id)
    expect(body.model.flowElementList).toBeInstanceOf(Array)
    expect(body.definition).toBeUndefined()
    await setApprovalFlowStatus(item, 'enabled')
    expect(transport.mock.calls[1][0]).toContain('/flow-id/publish')
  })
  it('复制重建节点引用，不复用发布身份', async () => {
    const item = flow(), first = createApprovalNode('approval'), second = createApprovalNode('approval')
    if (second.data.config.kind === 'approval') second.data.config.rules = [{
      ...newRule(),
      source: 'node',
      values: [first.id]
    }]
    item.definition.nodes.splice(1, 0, first, second);
    transport.mockImplementation((_path, init) => Promise.resolve(JSON.parse(init.body)))
    const copy = await duplicateApprovalFlow(item)
    expect(copy.definition.nodes[1].id).not.toBe(first.id)
    const config = copy.definition.nodes[2].data.config
    expect(config.kind === 'approval' && config.rules[0].values).toEqual([copy.definition.nodes[1].id])
  })
  it('表单事件触发创建的流程携带事件类型与监听表单', async () => {
    transport.mockImplementation((_path, init) => Promise.resolve(JSON.parse(init.body)))
    const created = await createApprovalFlow('app-a', '订单事件', {
      type: 'DATA_EVENT',
      formName: 'orders',
      operations: ['CREATE', 'UPDATE']
    })
    expect(created.form).toEqual({kind: 'app', name: 'orders'})
    const start = created.definition.nodes[0]
    const trigger = start.data.config.kind === 'start' ? start.data.config.trigger : undefined
    expect(trigger?.type === 'DATA_EVENT' && trigger.operations).toEqual(['CREATE', 'UPDATE'])
  })
  it('定时触发创建的流程不带表单，Cron 随触发配置保存', async () => {
    transport.mockImplementation((_path, init) => Promise.resolve(JSON.parse(init.body)))
    const created = await createApprovalFlow('app-a', '每日汇总', {
      type: 'SCHEDULE',
      cron: '0 0 9 * * ?',
      timezone: 'Asia/Shanghai'
    })
    expect(created.form).toEqual({kind: 'app', name: ''})
    const start = created.definition.nodes[0]
    const trigger = start.data.config.kind === 'start' ? start.data.config.trigger : undefined
    expect(trigger?.type === 'SCHEDULE' && trigger.cron).toBe('0 0 9 * * ?')
  })
})

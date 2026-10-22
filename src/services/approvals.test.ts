import {beforeEach, describe, expect, it, vi} from 'vitest'
import {
  createApprovalFlow,
  duplicateApprovalFlow,
  getApprovalFlows,
  saveApprovalFlow,
  setApprovalFlowStatus
} from './approvals'
import {createApprovalNode, emptyDocument, newRule} from '../lib/approval'
import type {ApprovalFlow} from '../types/approval'
import {encodeApprovalFlow} from './approval-model'

const transport = vi.hoisted(() => vi.fn())
vi.mock('./http', () => ({requestJson: transport}))
beforeEach(() => {
  transport.mockReset()
})
const flow = (): ApprovalFlow => ({
  id: 'flow-id',
  appId: 'app-a',
  revision: 3,
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
  it('保存传递版本，启用走独立发布接口', async () => {
    const item = flow();
    transport.mockResolvedValue(encodeApprovalFlow(item))
    await saveApprovalFlow(item)
    expect(JSON.parse(transport.mock.calls[0][1].body).revision).toBe(3)
    const body = JSON.parse(transport.mock.calls[0][1].body)
    expect(body.flow_module_id).toBe(item.id)
    expect(typeof body.flow_model).toBe('string')
    expect(body.definition).toBeUndefined()
    await setApprovalFlowStatus(item, 'enabled')
    expect(transport.mock.calls[1][0]).toContain('/flow-id/status')
    expect(JSON.parse(transport.mock.calls[1][1].body).status).toBe(2)
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
  it('示例模板绑定真实表单并清除模拟人员', async () => {
    transport.mockImplementation((_path, init) => Promise.resolve(JSON.parse(init.body)))
    const created = await createApprovalFlow('app-a', '报销', true, {kind: 'app', name: 'expense'})
    expect(created.form).toEqual({kind: 'app', name: 'expense'})
    const approval = created.definition.nodes.find(node => node.type === 'approval')
    expect(approval?.data.config.kind === 'approval' && approval.data.config.rules[0].source).toBe('initiator')
  })
})

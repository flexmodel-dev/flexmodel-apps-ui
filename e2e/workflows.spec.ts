import {test, expect} from '@playwright/test'
import {createApprovalTemplates, approvalDirectory, approvalDemoForms, users} from '../src/data/mock'
import {validateFlow} from '../src/lib/approval'
import {decodeApprovalFlow, encodeApprovalFlow} from '../src/services/approval-model'

const app = {
  id: 'approval-demo',
  projectId: 'approval-demo',
  name: '审批体验应用',
  description: '审批界面验证',
  iconName: 'Boxes',
  primaryColor: 'blue',
  enabled: true,
  owner: 'admin',
  createdAt: '2026-10-21',
  updatedAt: '2026-10-21',
}
test.beforeEach(async ({page}) => {
  let flows = structuredClone(createApprovalTemplates('approval-demo'))
  await page.addInitScript((userId) => {
    localStorage.setItem('flexmodel-apps.auth.token', 'local-e2e-token')
    localStorage.setItem(
      'flexmodel-apps.auth.user',
      JSON.stringify({
        id: userId,
        name: '审批体验',
        email: 'demo@example.com',
      }),
    )
  }, users[3].id)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const root = '/api/apps/approval-demo/flows'
    const method = route.request().method()
    const body = method === 'POST' || method === 'PUT' ? route.request().postDataJSON() : null
    if (url.pathname === '/api/apps/approval-demo/directory') {
      return route.fulfill({
        json: {
          ...approvalDirectory,
          roles: [...new Set(approvalDirectory.members.map(member => member.role))].map(id => ({id, name: id}))
        }
      })
    }
    if (url.pathname === root + '/validate') return route.fulfill({
      json: validateFlow(decodeApprovalFlow(body, app.id), flows, [
        ...approvalDemoForms,
        {
          ref: {kind: 'app', name: 'expense'},
          label: '报销单',
          fields: [{name: 'id', label: '记录 ID', type: 'TEXT'}, {
            name: 'title', label: '报销事由', type: 'TEXT'
          }, {name: 'amount', label: '报销金额', type: 'DECIMAL'}, {
            name: 'category', label: '费用类型', type: 'TEXT'
          }]
        },
        {
          ref: {
            kind: 'app',
            name: 'purchase'
          },
          label: '采购申请',
          fields: [{name: 'id', label: 'ID', type: 'TEXT'}, {
            name: 'title',
            label: '申请事由',
            type: 'TEXT'
          }, {name: 'amount', label: '申请金额', type: 'DECIMAL'}]
        }
      ])
    })
    if (url.pathname === root && method === 'GET') return route.fulfill({json: flows.map(encodeApprovalFlow)})
    if (url.pathname === root && method === 'POST') {
      const created = {
        ...decodeApprovalFlow(body, app.id),
        id: crypto.randomUUID(),
        status: 'draft' as const,
        updatedAt: new Date().toISOString()
      }
      flows.unshift(created);
      return route.fulfill({status: 201, json: encodeApprovalFlow(created)})
    }
    if (url.pathname.startsWith(root + '/')) {
      const segments = url.pathname.slice(root.length + 1).split('/')
      const id = segments[0]
      const index = flows.findIndex(flow => flow.id === id)
      if (method === 'DELETE') {
        flows = flows.filter(flow => flow.id !== id);
        return route.fulfill({status: 204})
      }
      if (segments[1] === 'publish' && method === 'POST' && index >= 0) {
        flows[index] = {...flows[index], status: 'enabled' as const}
        return route.fulfill({json: encodeApprovalFlow(flows[index])})
      }
      if (segments[1] === 'enabled' && method === 'PUT' && index >= 0) {
        flows[index] = {
          ...flows[index],
          status: body.enabled ? 'enabled' as const : 'disabled' as const
        }
        return route.fulfill({json: encodeApprovalFlow(flows[index])})
      }
      if (index >= 0 && method === 'PUT') {
        flows[index] = {
          ...flows[index], ...decodeApprovalFlow(body, app.id),
          status: 'draft' as const,
          updatedAt: new Date().toISOString()
        }
        return route.fulfill({json: encodeApprovalFlow(flows[index])})
      }
    }
    const payload =
      url.pathname === '/api/apps/approval-demo'
        ? app
        : url.pathname === '/api/apps'
          ? [app]
          : url.pathname === '/api/apps/approval-demo/forms'
            ? [
              {
                name: 'expense',
                label: '报销单',
                description: '',
                fields: [
                  {
                    name: 'id',
                    label: '记录 ID',
                    type: 'TEXT',
                    required: true,
                    builtin: true,
                  },
                  {
                    name: 'title',
                    label: '报销事由',
                    type: 'TEXT',
                    required: true,
                    builtin: false,
                  },
                  {
                    name: 'amount',
                    label: '报销金额',
                    type: 'DECIMAL',
                    required: true,
                    builtin: false,
                  },
                  {
                    name: 'category',
                    label: '费用类型',
                    type: 'TEXT',
                    required: false,
                    builtin: false,
                  },
                ],
                layout: {items: []},
              },
              {
                name: 'purchase',
                label: '采购申请',
                description: '',
                fields: [
                  {
                    name: 'id',
                    label: '记录 ID',
                    type: 'TEXT',
                    required: true,
                    builtin: true,
                  },
                  {
                    name: 'title',
                    label: '申请事由',
                    type: 'TEXT',
                    required: true,
                    builtin: false,
                  },
                  {
                    name: 'amount',
                    label: '申请金额',
                    type: 'DECIMAL',
                    required: true,
                    builtin: false,
                  },
                ],
                layout: {items: []},
              },
            ]
            : []
    await route.fulfill({json: payload})
  })
})
test('模板可完整模拟，列表与设计器保存恢复并适配主题', async ({page}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/#/admin/apps/approval-demo/settings/workflows')
  await expect(page.getByText('管理手动、数据事件和定时工作流。')).toBeVisible()
  await expect(page.getByRole('columnheader', {name: '触发方式', exact: true})).toBeVisible()
  await expect(page.getByRole('columnheader', {name: '节点', exact: true})).toHaveCount(0)
  await expect(page.getByRole('cell', {name: '手动触发', exact: true}).first()).toBeVisible()
  await page.screenshot({
    animations: 'disabled',
    path: 'artifacts/approvals-list-light.png',
    fullPage: true,
  })
  await page
    .getByRole('button', {name: '编辑费用报销审批', exact: true})
    .click()
  await expect(
    page.locator('.approval-node[data-node-id="demo-manager"]'),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', {name: '流程设置', exact: true}),
  ).toBeVisible()
  await page.screenshot({
    animations: 'disabled',
    path: 'artifacts/approvals-designer-light.png',
  })
  await page.getByRole('button', {name: '模拟预览', exact: true}).click()
  await page.getByLabel('模拟报销金额').fill('8600')
  await page.getByRole('button', {name: '开始模拟', exact: true}).click()
  await expect(page.getByRole('heading', {name: '等待审批'})).toBeVisible()
  await page.getByRole('button', {name: '同意钱迅', exact: true}).click()
  await page.getByRole('button', {name: '同意李杰', exact: true}).click()
  await expect(page.getByRole('heading', {name: '流程已完成'})).toBeVisible()
  await expect(
    page.getByText('已新增 1 条模拟记录', {exact: true}),
  ).toBeVisible()
  await page.screenshot({
    animations: 'disabled',
    path: 'artifacts/approvals-simulation.png',
  })
  await page.getByTitle('关闭模拟预览').click()
  await page.locator('.approval-node[data-node-id="demo-manager"]').click()
  await page.screenshot({
    animations: 'disabled',
    path: 'artifacts/approvals-node-settings.png',
  })
  await page
    .getByRole('textbox', {name: '节点名称', exact: true})
    .fill('主管审批 · 已调整')
  await page.getByRole('button', {name: '保存草稿', exact: true}).click()
  await page.reload()
  await expect(
    page.getByText('主管审批 · 已调整', {exact: true}),
  ).toBeVisible()
  await page.getByTitle('切换明暗主题').click()
  await page.screenshot({
    animations: 'disabled',
    path: 'artifacts/approvals-designer-dark.png',
  })
  await page.setViewportSize({width: 1280, height: 800})
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1280)
  await page.screenshot({
    animations: 'disabled',
    path: 'artifacts/approvals-designer-1280.png',
  })
  await page.setViewportSize({width: 900, height: 800})
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByTitle('关闭配置面板').click()
  await page.getByRole('button', {name: '配置面板', exact: true}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(errors).toEqual([])
})

test('七类节点可插入、撤销与重做，条件分支可以增减', async ({page}) => {
  await page.goto('/#/admin/apps/approval-demo/workflow/demo-expense/design')
  await expect(
    page.locator('.approval-node[data-node-id="demo-manager"]'),
  ).toBeVisible()
  await page
    .getByRole('button', {name: '添加流程节点', exact: true})
    .first()
    .click()
  for (const label of [
    '审批节点',
    '条件网关',
    '新增记录',
    '更新记录',
    '查询记录',
    '删除记录',
    '子流程',
  ])
    await expect(page.getByText(label, {exact: true}).last()).toBeVisible()
  await page.getByText('查询记录', {exact: true}).last().click()
  await expect(page.locator('[data-node-type="query"]')).toHaveCount(1)
  await page.getByTitle('撤销', {exact: true}).click()
  await expect(page.locator('[data-node-type="query"]')).toHaveCount(0)
  await page.getByTitle('重做', {exact: true}).click()
  await expect(page.locator('[data-node-type="query"]')).toHaveCount(1)
  await page.locator('[data-node-type="gateway"]').click()
  await page.getByRole('button', {name: '添加条件分支', exact: true}).click()
  await expect(page.locator('[data-node-type="branch"]')).toHaveCount(3)
  await page.getByRole('button', {name: '删除节点', exact: true}).click()
  await page.getByRole('button', {name: '确认删除', exact: true}).click()
  await expect(page.locator('[data-node-type="branch"]')).toHaveCount(2)
})

test('真实字段可配置记录节点，多组审批人可保存，校验定位缺失条件', async ({
                                                                          page,
                                                                        }) => {
  await page.goto('/#/admin/apps/approval-demo/settings/workflows')
  await page
    .getByRole('button', {name: '新建流程', exact: true})
    .first()
    .click()
  await page
    .getByRole('textbox', {name: '流程名称', exact: true})
    .fill('采购审批测试')
  await page
    .getByLabel('流程关联表单', {exact: true})
    .selectOption('purchase')
  await page.getByRole('button', {name: '创建并设计'}).click()
  await expect(
    page.getByRole('heading', {name: '采购审批测试', exact: true}),
  ).toBeVisible()
  for (const label of [
    '新增记录',
    '更新记录',
    '查询记录',
    '删除记录',
    '审批节点',
    '子流程',
  ]) {
    await page
      .getByRole('button', {name: '添加流程节点', exact: true})
      .first()
      .click()
    await page
      .getByRole('button', {name: new RegExp(`^${label}`)})
      .last()
      .click()
    await expect(
      page.getByRole('heading', {name: label, exact: true}),
    ).toBeVisible()
  }
  await page.locator('[data-node-type="approval"]').click()
  await expect(
    page.getByLabel('规则1成员来源').locator('option[value="script"]'),
  ).toHaveCount(0)
  await expect(
    page.getByLabel('规则1成员来源').locator('option'),
  ).toHaveText([
    '静态成员 · 指定用户',
    '静态成员 · 指定角色',
    '静态成员 · 指定组织架构',
    '动态成员 · 流程发起人',
    '动态成员 · 流程节点执行人',
    '动态成员 · 流程变量',
  ])
  await page.getByLabel('规则1成员来源').selectOption('roles')
  await page.getByRole('button', {name: '选择角色', exact: true}).click()
  await page.getByRole('checkbox', {name: '会计', exact: true}).click()
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', {name: '添加执行人规则', exact: true})
    .click()
  await page.getByLabel('规则2成员来源').selectOption('initiator')
  await page.getByLabel('规则2人员范围').selectOption('manager')
  await page.getByText('依次审批', {exact: true}).click()
  await page.getByRole('button', {name: '保存草稿', exact: true}).click()
  await page.locator('[data-node-type="create"]').click()
  await expect(page.getByLabel('目标表单', {exact: true})).toHaveValue(
    'app:purchase',
  )
  await page.getByRole('button', {name: '添加字段赋值', exact: true}).click()
  await page.getByLabel('赋值字段', {exact: true}).selectOption('amount')
  await expect(
    page.getByRole('spinbutton', {name: '固定值', exact: true}),
  ).toBeVisible()
  await page
    .getByRole('spinbutton', {name: '固定值', exact: true})
    .fill('1200')
  await page.getByRole('button', {name: '模拟预览', exact: true}).click()
  await expect(page.getByText(/项配置待完善/)).toBeVisible()
  await page
    .getByRole('button', {name: /更新记录 · 更新和删除记录必须设置筛选条件/})
    .click()
  await expect(
    page.getByRole('heading', {name: '更新记录', exact: true}),
  ).toBeVisible()
})

test('列表支持复制、停用、筛选和删除，真实元数据读取失败可重试', async ({
                                                                       page,
                                                                     }) => {
  await page.route('**/api/apps/approval-demo/forms', (route) =>
    route.fulfill({status: 500, json: {message: '元数据暂不可用'}}),
  )
  await page.goto('/#/admin/apps/approval-demo/settings/workflows')
  await expect(page.getByRole('alert')).toContainText('元数据暂不可用')
  await page.getByRole('button', {name: '费用报销审批更多操作'}).click()
  await page.getByText('复制流程', {exact: true}).click()
  await expect(
    page.getByText('费用报销审批（副本）', {exact: true}),
  ).toBeVisible()
  await page.getByRole('button', {name: '费用报销审批更多操作'}).click()
  await page.getByText('停用流程', {exact: true}).click()
  await page.getByRole('button', {name: /^已停用/}).click()
  await expect(page.getByText('审批归档子流程', {exact: true})).toHaveCount(0)
  await page.getByRole('button', {name: /^全部流程/}).click()
  await page.getByRole('textbox', {name: '搜索流程'}).fill('副本')
  await page
    .getByRole('button', {name: '费用报销审批（副本）更多操作'})
    .click()
  await page.getByText('删除流程', {exact: true}).click()
  await page.getByRole('button', {name: '确认删除', exact: true}).click()
  await expect(page.getByText('没有找到匹配的流程')).toBeVisible()
  await page.unroute('**/api/apps/approval-demo/forms')
  await page.getByRole('button', {name: '重试', exact: true}).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('拖动节点可更改顺序并保存，未保存修改离开时提醒', async ({page}) => {
  await page.goto('/#/admin/apps/approval-demo/workflow/demo-expense/design')
  await expect(
    page.locator('.approval-node[data-node-id="demo-manager"]'),
  ).toBeVisible()
  await page
    .getByRole('button', {name: '添加流程节点', exact: true})
    .first()
    .click()
  await page.getByRole('button', {name: /^查询记录/}).click()
  await page.getByTitle('适应画布', {exact: true}).click()
  await page.locator('[data-node-type="query"]').click({trial: true})
  const source = (await page.locator('[data-node-type="query"]').boundingBox())!
  const managerBounds = (await page
    .locator('.approval-node[data-node-id="demo-manager"]')
    .boundingBox())!
  const target = {
    x: managerBounds.x,
    y: managerBounds.y + managerBounds.height + 24,
    width: managerBounds.width,
    height: 0,
  }
  await page.mouse.move(source.x + 25, source.y + 20)
  await page.mouse.down()
  await page.mouse.move(source.x + 35, source.y + 28, {steps: 4})
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    {steps: 15},
  )
  await page.mouse.up()
  await page.getByRole('button', {name: '保存草稿', exact: true}).click()
  await expect(page.getByText('流程草稿已保存到服务器', {exact: true})).toBeVisible()
  const order = await page.evaluate(async () => {
    const response = await fetch('/api/apps/approval-demo/flows')
    const flows = await response.json()
    const record = flows.find((flow: { id: string }) => flow.id === 'demo-expense')
    return record.model.flowElementList
      .filter((element: {
        properties: { designer?: { parent: string } }
      }) => element.properties.designer?.parent === '')
      .sort((a: { properties: { designer: { order: number } } }, b: {
        properties: { designer: { order: number } }
      }) => a.properties.designer.order - b.properties.designer.order)
      .map((element: { properties: { config: { kind: string } } }) => element.properties.config.kind)
  })
  expect(order.slice(0, 4)).toEqual(['start', 'approval', 'query', 'gateway'])
  await page.locator('.approval-node[data-node-id="demo-manager"]').click()
  await page
    .getByRole('textbox', {name: '节点名称', exact: true})
    .fill('未保存的修改')
  await page.getByTitle('返回审批流程').click()
  await expect(
    page.getByText('还有未保存的修改', {exact: true}),
  ).toBeVisible()
  await page.getByRole('button', {name: '继续编辑', exact: true}).click()
  await expect(
    page.getByRole('textbox', {name: '节点名称', exact: true}),
  ).toHaveValue('未保存的修改')
})

import {expect, type Page, test} from '@playwright/test'
import type {AppDataChange} from '../src/services/appDataCache'

async function setup(page: Page) {
  const app = {id: 'refreshapp', name: '刷新测试应用', primaryColor: 'blue', enabled: true}
  const state = {
    apps: [app],
    navs: [{id: 'orders', type: 'ENTRY', name: '订单', destination: {type: 'FORM', id: 'orders'}, children: []}],
    form: {
      name: 'orders', label: '订单', displayField: 'name', builtin: false,
      fields: [{name: 'name', label: '订单名称', type: 'TEXT', required: true}],
      layout: {items: [{type: 'FIELD', name: 'name', width: 'FULL'}]},
      viewTabs: [{id: 'all', label: '全部', type: 'TABLE', displayFields: ['name']}],
    },
    records: [{id: 'first', name: '订单一'}],
    workbench: {
      id: 'main', name: '业务工作台', layout: {
        schemaVersion: 1, components: [{
          id: 'links', title: '原有快捷入口', placement: {x: 0, y: 0, w: 6, h: 3},
          config: {type: 'shortcuts', shortcuts: [], columnsPerRow: 3},
        }]
      },
    },
  }
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'test-token')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({
      id: 'admin',
      name: '管理员',
      email: 'test@example.com'
    }))
    localStorage.setItem('flexmodel-apps.auth.permissions', '["*"]')
  })
  let reply: (body: string) => void = () => {
    throw new Error('AI 请求尚未开始')
  }
  let ready!: () => void
  const requestReady = new Promise<void>(resolve => {
    ready = resolve
  })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (/\/ai\/conversations\/chat\/messages$/.test(path)) {
      const body = await new Promise<string>(resolve => {
        reply = resolve;
        ready()
      })
      return route.fulfill({contentType: 'text/event-stream', body})
    }
    if (path === '/api/ai/conversations') return route.fulfill({
      json: method === 'POST'
        ? {id: 'chat', robotId: 'assistant', title: '对话', messages: []} : []
    })
    if (path === '/api/apps') return route.fulfill({json: state.apps})
    if (path === '/api/apps/templates') return route.fulfill({json: []})
    if (path === '/api/apps/refreshapp') return route.fulfill({json: app})
    if (path.endsWith('/navigation')) return route.fulfill({json: state.navs})
    if (path.endsWith('/navigation/destinations')) return route.fulfill({json: {builtIn: [], forms: []}})
    if (path.endsWith('/forms/orders/views/all/query')) return route.fulfill({
      json: {
        viewId: 'all', type: 'TABLE', list: state.records, total: state.records.length,
        groups: null, childFlags: null, hasMore: false, movable: false,
      }
    })
    if (path.endsWith('/forms/orders')) return route.fulfill({json: state.form})
    if (path.endsWith('/forms')) return route.fulfill({json: [state.form]})
    if (path.endsWith('/workbenches/main')) return route.fulfill({json: state.workbench})
    if (path.endsWith('/workbenches')) return route.fulfill({json: [state.workbench]})
    if (path === '/api/notifications/summary') return route.fulfill({
      json: {
        version: '0',
        unread: 0,
        byCategory: {},
        apps: []
      }
    })
    if (path === '/api/notifications/stream') return route.fulfill({
      contentType: 'text/event-stream',
      body: 'event: ready\ndata: {"version":"0"}\n\n'
    })
    if (path === '/api/notifications') return route.fulfill({json: {list: [], total: 0}})
    return route.fulfill({json: []})
  })
  return {
    state, failures,
    async finish(changes: AppDataChange[], error = false) {
      await requestReady
      const events: object[] = changes.map(change => ({type: 'change', change}))
      events.push(error ? {type: 'error', content: '模型后续失败'} : {
        type: 'done', conversation: {
          id: 'chat', robotId: 'assistant', title: '对话', messages: [
            {id: 'answer', role: 'assistant', content: '创建完成', createdAt: '2026-11-04T10:00:00'},
          ]
        },
      })
      reply(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''))
    },
  }
}

async function send(page: Page) {
  await page.getByRole('button', {name: 'AI 助手', exact: true}).click()
  const composer = page.getByRole('textbox', {name: '消息内容'})
  await composer.fill('请帮我完善应用')
  await expect(page.getByRole('button', {name: '发送消息', exact: true})).toBeEnabled()
  await Promise.all([
    page.waitForRequest(request => request.url().endsWith('/ai/conversations/chat/messages')),
    page.getByRole('button', {name: '发送消息', exact: true}).click(),
  ])
}

test('AI 创建后应用管理和启动器同步，助手及下一条输入保持不变', async ({page}) => {
  const {state, finish, failures} = await setup(page)
  await page.goto('/#/admin/apps')
  await expect(page.getByRole('link', {name: /刷新测试应用/})).toBeVisible()
  await send(page)
  await page.getByRole('textbox', {name: '消息内容'}).fill('下一步的草稿')
  state.apps.push({...state.apps[0], id: 'newapp', name: 'AI 新建应用'})
  await finish([{appId: 'newapp', resource: 'app'}])
  await expect(page.getByRole('link', {name: /AI 新建应用/})).toBeVisible()
  await expect(page.getByRole('textbox', {name: '消息内容'})).toHaveValue('下一步的草稿')
  await expect(page.getByRole('button', {name: 'AI 助手', exact: true})).toHaveAttribute('aria-expanded', 'true')
  // 切换页面也应读取已失效后的数据，助手仍保留当前会话。
  await page.getByRole('link', {name: /刷新测试应用/}).click()
  await expect(page.getByText('创建完成', {exact: true})).toBeVisible()
  await page.getByRole('button', {name: '应用启动器', exact: true}).click()
  await expect(page.getByRole('menuitem', {name: /AI 新建应用/})).toBeVisible()
  expect(failures).toEqual([])
})

test('导航、表单和记录跟随 AI 更新，保留当前筛选', async ({page}) => {
  const {state, finish, failures} = await setup(page)
  await page.goto('/#/apps/refreshapp/orders')
  await expect(page.getByText('订单一', {exact: true}).first()).toBeVisible()
  await page.getByPlaceholder('搜索订单', {exact: true}).fill('订单')
  await send(page)
  state.navs.push({...state.navs[0], id: 'customers', name: '客户'})
  state.form.fields[0].label = 'AI 订单名称'
  state.records.push({id: 'second', name: '订单二'})
  await finish([
    {appId: 'refreshapp', resource: 'navigation'},
    {appId: 'refreshapp', resource: 'form', formName: 'orders'},
    {appId: 'refreshapp', resource: 'record', formName: 'orders'},
  ], true)
  await expect(page.getByText('订单二', {exact: true}).first()).toBeVisible()
  await expect(page.getByRole('columnheader', {name: /AI 订单名称/})).toBeVisible()
  await expect(page.getByRole('link', {name: '客户', exact: true})).toBeVisible()
  await expect(page.getByPlaceholder('搜索订单', {exact: true})).toHaveValue('订单')
  await expect(page.getByText('模型后续失败', {exact: true})).toBeVisible()
  expect(failures).toEqual([])
})

test('记录草稿不被表单配置刷新覆盖，关闭后应用新配置', async ({page}) => {
  const {state, finish, failures} = await setup(page)
  await page.goto('/#/apps/refreshapp/orders')
  await expect(page.getByText('订单一', {exact: true}).first()).toBeVisible()
  await send(page)
  await page.getByRole('button', {name: '新建', exact: true}).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('input').first().fill('尚未保存的订单')
  state.form.fields[0].label = 'AI 订单名称'
  await finish([{appId: 'refreshapp', resource: 'form', formName: 'orders'}])
  await expect(page.getByText('创建完成', {exact: true})).toBeVisible()
  await expect(dialog.locator('input').first()).toHaveValue('尚未保存的订单')
  await dialog.getByRole('button', {name: '取消', exact: true}).click()
  await page.getByRole('button', {name: '放弃修改', exact: true}).click()
  await expect(page.getByRole('columnheader', {name: /AI 订单名称/})).toBeVisible()
  expect(failures).toEqual([])
})

test('工作台布局跟随 AI 更新', async ({page}) => {
  const {state, finish, failures} = await setup(page)
  state.navs = [{...state.navs[0], id: 'home', name: '工作台', destination: {type: 'BUILTIN', id: 'workbench'}}]
  await page.goto('/#/apps/refreshapp/home')
  await expect(page.getByText('原有快捷入口', {exact: true})).toBeVisible()
  await send(page)
  state.workbench.layout.components[0].title = 'AI 更新的快捷入口'
  await finish([{appId: 'refreshapp', resource: 'workbench', entityId: 'main'}])
  await expect(page.getByText('AI 更新的快捷入口', {exact: true})).toBeVisible()
  await expect(page.getByText('创建完成', {exact: true})).toBeVisible()
  expect(failures).toEqual([])
})

test('表单设计有未保存布局时保留草稿并提示待同步', async ({page}) => {
  const {state, finish, failures} = await setup(page)
  await page.goto('/#/admin/apps/refreshapp/forms/orders/form-design')
  await expect(page.locator('[data-form-designer-canvas]')).toBeVisible()
  await send(page)
  await page.getByRole('button', {name: '添加', exact: true}).click()
  await page.getByRole('menuitem', {name: '分栏', exact: true}).click()
  await expect(page.locator('[data-form-designer-canvas]').getByText('分栏', {exact: true})).toBeVisible()
  state.form.fields[0].label = 'AI 订单名称'
  await finish([{appId: 'refreshapp', resource: 'form', formName: 'orders'}])
  await expect(page.getByText('应用有新的配置，当前草稿已保留，结束编辑后自动同步。', {exact: true})).toBeVisible()
  await expect(page.locator('[data-form-designer-canvas]').getByText('分栏', {exact: true})).toBeVisible()
  await expect(page.locator('[data-form-designer-canvas]').getByText('订单名称', {exact: true})).toBeVisible()
  expect(failures).toEqual([])
})

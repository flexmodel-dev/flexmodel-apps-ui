import {test, expect, type Page} from '@playwright/test'

const root = '/api/apps/quick-create'
const form = {
  name: 'expense', label: '报销单', builtin: false, displayField: 'title',
  fields: [{name: 'title', label: '报销事由', type: 'TEXT', required: true}],
  layout: {items: []}, viewTabs: [],
}

async function setup(page: Page, {many = false, failLoad = false, failStart = false, unpublishedOnly = false} = {}) {
  const publishedTrigger = {type: 'MANUAL', formName: 'expense', lockRecord: true}
  const flow = (id: string, name: string, extra = {}) => ({
    id, name, flowKey: id, description: '', status: 'enabled', publishedTrigger,
    // 草稿绑定其他表单，入口必须读取发布快照。
    model: {
      flowElementList: [{
        key: 'start', type: 2, incoming: [], outgoing: [], properties: {
          config: {kind: 'start', trigger: {...publishedTrigger, formName: 'draft-form'}},
          designer: {parent: '', order: 0},
        },
      }]
    }, ...extra,
  })
  const flows = [flow('expense-a', '普通报销'), flow('expense-b', '差旅报销'),
    flow('disabled', '停用流程', {status: 'disabled'}), flow('draft', '草稿流程', {status: 'draft'}),
    flow('event', '事件流程', {publishedTrigger: {type: 'DATA_EVENT', formName: 'expense', operations: ['CREATE']}}),
    flow('schedule', '定时流程', {publishedTrigger: {type: 'SCHEDULE', cron: '* * * * *'}}),
    flow('unpublished', '未发布流程', {publishedTrigger: undefined}),
    flow('invisible', '不可见表单流程', {publishedTrigger: {...publishedTrigger, formName: 'hidden'}}),
    ...(many ? Array.from({length: 60}, (_, i) => flow(`extra-${i}`, `测试流程 ${i + 1}`)) : []),
  ]
  const forms = [form, ...(many ? Array.from({length: 60}, (_, i) => ({
    ...form,
    name: `form-${i}`,
    label: `业务表单 ${i + 1}`
  })) : [])]
  const navs = [{
    id: 'top', type: 'GROUP', name: '首页', children: [
      {
        id: 'start', type: 'ENTRY', name: '应用说明', destination: {type: 'LINK', id: 'https://example.com'},
        pageRoute: '/apps/quick-create/start', children: []
      },
      ...forms.map(item => ({
        id: `nav-${item.name}`, type: 'ENTRY', name: item.label,
        destination: {type: 'FORM', id: item.name, label: item.label}, children: []
      })),
    ]
  }]
  const state = {
    failLoad,
    failStart,
    creates: 0,
    updates: 0,
    flowLoads: 0,
    starts: [] as Array<{ id: string; recordId: string; requestKey: string }>
  }
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'quick-create-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
  })
  await page.route('https://example.com/**', route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: '应用说明'
  }))
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path === root) return route.fulfill({json: {id: 'quick-create', name: '快捷新建测试', primaryColor: 'blue'}})
    if (path === `${root}/navigation`) return route.fulfill({json: navs})
    if (path === `${root}/flows`) {
      state.flowLoads++
      return route.fulfill(state.failLoad ? {status: 500, json: {message: '流程加载失败'}} : {
        json: unpublishedOnly ? [flow('draft-only', '采购申请审批流', {
          status: 'draft',
          publishedTrigger: undefined
        })] : flows,
      })
    }
    if (path === `${root}/forms/expense/records` && method === 'POST') {
      state.creates++
      return route.fulfill({status: 201, json: {...route.request().postDataJSON(), id: 'saved-record'}})
    }
    if (path === `${root}/forms/expense/records/saved-record` && method === 'PUT') {
      state.updates++
      return route.fulfill({status: 409, json: {message: '记录已锁定'}})
    }
    if (path.endsWith('/instances') && method === 'POST') {
      state.starts.push({id: path.split('/').at(-2)!, ...route.request().postDataJSON()})
      return route.fulfill(state.failStart ? {
        status: 500,
        json: {message: '发起暂时失败，请重试'}
      } : {json: {id: 'instance'}})
    }
    if (path === `${root}/forms/expense`) return route.fulfill({json: form})
    if (path === '/api/notifications/summary') return route.fulfill({
      json: {
        version: '0',
        unread: 0,
        byCategory: {},
        apps: []
      }
    })
    if (path === '/api/notifications') return route.fulfill({json: {list: [], total: 0}})
    return route.fulfill({json: []})
  })
  await page.goto('/#/apps/quick-create/start')
  await expect(page).toHaveTitle('应用说明 - 快捷新建测试')
  return state
}

async function openPanel(page: Page) {
  await page.getByRole('button', {name: '快捷新建', exact: true}).click()
  const panel = page.getByRole('dialog', {name: '快捷新建', exact: true})
  await expect(panel).toBeVisible()
  return panel
}

test('已配置但未发布的流程显示发起条件与工作流设置入口', async ({page}) => {
  const state = await setup(page, {unpublishedOnly: true})
  const panel = await openPanel(page)
  await expect(panel.getByText('已配置流程，暂无可发起的流程', {exact: true})).toBeVisible()
  await expect(panel.getByText('这里只显示已发布并启用、绑定可见表单的手动流程。')).toBeVisible()
  await expect(panel.getByRole('button', {name: /采购申请审批流/})).toHaveCount(0)
  const settings = panel.getByRole('link', {name: '工作流设置', exact: true})
  await panel.getByRole('textbox').fill('采购')
  await expect(panel.getByText('没有匹配的流程')).toBeVisible()
  await expect(settings).toHaveCount(0)
  expect(state.creates).toBe(0)
  expect(state.starts).toHaveLength(0)
  await panel.getByRole('textbox').clear()
  await settings.click()
  await expect(page).toHaveURL(/#\/admin\/apps\/quick-create\/settings\/workflows$/)
  await expect(page.getByRole('heading', {name: '工作流', exact: true})).toBeVisible()
  await expect(page.getByRole('row').filter({hasText: '采购申请审批流'})).toBeVisible()
})

for (const dark of [false, true]) test(`快捷面板双页签、搜索、限高滚动（${dark ? '夜间' : '浅色'}）`, async ({page}) => {
  await setup(page, {many: true})
  if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))
  const panel = await openPanel(page)
  await expect(panel.getByRole('button', {name: '差旅报销 关联表单：报销单'})).toBeVisible()
  await expect(panel.getByRole('textbox')).toBeFocused()
  const list = panel.getByRole('tabpanel')
  await expect(list.getByRole('button')).toHaveCount(62)
  const panelBox = (await panel.boundingBox())!
  expect(panelBox.height).toBeLessThanOrEqual(900 * 0.6 + 1)
  const searchTop = (await panel.getByRole('textbox').boundingBox())!.y
  await list.evaluate(el => {
    el.scrollTop = el.scrollHeight
  })
  expect(await list.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  expect((await panel.getByRole('textbox').boundingBox())!.y).toBe(searchTop)
  await panel.getByRole('textbox').fill('报销单')
  await expect(list.getByRole('button')).toHaveCount(62)
  await panel.getByRole('textbox').fill('差旅')
  await expect(list.getByRole('button')).toHaveCount(1)
  await panel.getByRole('textbox').fill('无匹配项')
  await expect(panel.getByText('没有匹配的流程')).toBeVisible()
  await panel.getByRole('tab', {name: '新增数据'}).click()
  await expect(panel.getByRole('textbox', {name: '搜索表单'})).toHaveValue('')
  await expect(list.getByRole('button')).toHaveCount(61)
  await list.evaluate(el => {
    el.scrollTop = el.scrollHeight
  })
  expect(await list.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  await panel.getByRole('textbox').fill('业务表单 60')
  await expect(list.getByRole('button')).toHaveCount(1)
  await panel.getByRole('tab', {name: '发起流程'}).click()
  await expect(panel.getByRole('textbox')).toHaveValue('')
  await page.screenshot({path: `test-results/quick-create-${dark ? 'dark' : 'light'}.png`})
  await page.keyboard.press('Escape')
  await expect(panel).not.toBeVisible()
  await expect(page.getByRole('button', {name: '快捷新建', exact: true})).toBeFocused()
})

test('选定发布流程直接填表并发起，失败重试复用记录与幂等键', async ({page}) => {
  const state = await setup(page, {failStart: true})
  const panel = await openPanel(page)
  await expect(panel.getByRole('tabpanel').getByRole('button')).toHaveCount(2)
  await panel.getByRole('button', {name: '差旅报销 关联表单：报销单'}).click()
  await expect(panel).not.toBeVisible()
  const drawer = page.getByRole('dialog', {name: '发起流程：差旅报销', exact: true})
  await expect(drawer.getByPlaceholder('请输入报销事由')).toBeVisible()
  const submit = drawer.getByRole('button', {name: '提交并发起'})
  await submit.click()
  expect(state.creates).toBe(0)
  await drawer.getByPlaceholder('请输入报销事由').fill('出差机票')
  await submit.click()
  await expect(drawer.getByText('发起暂时失败，请重试')).toBeVisible()
  expect(state.creates).toBe(1)
  state.failStart = false
  await submit.click()
  await expect(drawer).not.toBeVisible()
  expect(state.creates).toBe(1)
  expect(state.updates).toBe(0)
  expect(state.starts).toHaveLength(2)
  expect(state.starts[0]).toEqual(state.starts[1])
  expect(state.starts[0]).toMatchObject({id: 'expense-b', recordId: 'saved-record'})
  // 再走普通新增入口，不应残留上次选择的流程。
  const reopened = await openPanel(page)
  await reopened.getByRole('tab', {name: '新增数据'}).click()
  await reopened.getByRole('button', {name: '报销单', exact: true}).click()
  const create = page.getByRole('dialog', {name: '新建报销单', exact: true})
  await create.getByPlaceholder('请输入报销事由').fill('普通记录')
  await create.getByRole('button', {name: '保存', exact: true}).click()
  await expect(create).not.toBeVisible()
  expect(state.creates).toBe(2)
  expect(state.starts).toHaveLength(2)
})

test('流程加载失败可重试，新增数据入口独立可用，重新打开刷新流程', async ({page}) => {
  const state = await setup(page, {failLoad: true})
  const panel = await openPanel(page)
  await expect(panel.getByRole('alert')).toHaveText('流程加载失败')
  await panel.getByRole('tab', {name: '新增数据'}).click()
  await expect(panel.getByRole('button', {name: '报销单', exact: true})).toBeVisible()
  await panel.getByRole('tab', {name: '发起流程'}).click()
  state.failLoad = false
  await panel.getByRole('button', {name: '重试', exact: true}).click()
  await expect(panel.getByRole('tabpanel').getByRole('button')).toHaveCount(2)
  const loads = state.flowLoads
  await page.keyboard.press('Escape')
  await openPanel(page)
  await expect.poll(() => state.flowLoads).toBeGreaterThan(loads)
})

test('窄屏快捷面板不溢出，键盘可切换页签并选择表单', async ({page}) => {
  await page.setViewportSize({width: 390, height: 700})
  await setup(page, {many: true})
  const panel = await openPanel(page)
  await expect(panel.getByRole('tabpanel').getByRole('button')).toHaveCount(62)
  const box = (await panel.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  expect(box.y + box.height).toBeLessThanOrEqual(700)
  expect(box.height).toBeLessThanOrEqual(420)
  await page.screenshot({path: 'test-results/quick-create-mobile.png'})
  await panel.getByRole('tab', {name: '发起流程'}).focus()
  await page.keyboard.press('ArrowRight')
  await expect(panel.getByRole('tab', {name: '新增数据'})).toHaveAttribute('data-state', 'active')
  await page.keyboard.press('Tab')
  await page.keyboard.type('报销单')
  await expect(panel.getByRole('textbox')).toHaveValue('报销单')
  await page.keyboard.press('Tab')
  // TabsContent 本身也是键盘焦点。
  if (await panel.getByRole('tabpanel').evaluate(el => el === document.activeElement)) await page.keyboard.press('Tab')
  await expect(panel.getByRole('button', {name: '报销单', exact: true})).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', {name: '新建报销单', exact: true})).toBeVisible()
})

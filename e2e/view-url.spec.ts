import {expect, type Page, test} from '@playwright/test'

const root = '/api/apps/view-url'
const listUrl = '/#/apps/view-url/orders'
const specialId = 'special view+测试'

async function setup(page: Page, {loggedIn = true} = {}) {
  const view = (id: string, label: string) => ({
    id, label, type: 'TABLE', filter: null, sort: null, displayFields: [], config: {},
  })
  const form = {
    name: 'orders', label: '订单', displayField: 'title', builtin: false,
    fields: [{name: 'title', label: '名称', type: 'TEXT'}], layout: {items: []},
    viewTabs: [view('all', '全部'), view('pending', '待处理'), view(specialId, '特殊视图')],
  }
  const tasks = {...form, name: 'tasks', label: '任务', viewTabs: [view('tasks-all', '全部任务')]}
  const navs = [{
    id: 'business', name: '业务', type: 'GROUP', children: ['orders', 'tasks'].map(id => ({
      id, parentId: 'business', type: 'ENTRY', name: id === 'orders' ? '订单' : '任务',
      pageRoute: `/apps/view-url/${id}`, destination: {type: 'FORM', id}, children: [],
    })),
  }]
  const queries: string[] = []
  await page.addInitScript((authenticated) => {
    if (!authenticated) return
    localStorage.setItem('flexmodel-apps.auth.token', 'view-url-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: '管理员'}))
  }, loggedIn)
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    const app = {id: 'view-url', name: '视图地址测试', enabled: true, owner: 'admin'}
    if (path === '/api/auth/login') return route.fulfill({json: {token: 'test', user: {id: 'admin', name: '管理员'}}})
    if (path === root || path === '/api/apps') return route.fulfill({json: path === root ? app : [app]})
    if (path === `${root}/navigation`) return route.fulfill({json: navs})
    if (path === `${root}/forms/orders`) {
      if (route.request().method() === 'PATCH') form.viewTabs = route.request().postDataJSON().viewTabs
      return route.fulfill({json: form})
    }
    if (path === `${root}/forms/tasks`) return route.fulfill({json: tasks})
    if (path === `${root}/forms`) return route.fulfill({json: [form, tasks]})
    const id = path.match(/\/views\/([^/]+)\/query$/)?.[1]
    if (id) {
      const viewId = decodeURIComponent(id)
      queries.push(viewId)
      return route.fulfill({
        json: {
          viewId, type: 'TABLE', list: [{id: 'first', title: `当前记录：${viewId}`}], total: 1,
        }
      })
    }
    if (path === '/api/notifications/summary') return route.fulfill({
      json: {
        version: '0', unread: 0, byCategory: {}, apps: [],
      }
    })
    if (path === '/api/notifications') return route.fulfill({json: {list: [], total: 0}})
    return route.fulfill({json: []})
  })
  return {form, queries, navs}
}

async function expectView(page: Page, id: string, label: string) {
  await expect(page.getByRole('tab', {name: label, exact: true})).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('row').filter({hasText: `当前记录：${id}`})).toBeVisible()
}

const currentViewId = (page: Page) => page.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('viewId'))

test('切换写入 viewId，保留其他参数，刷新与前进后退恢复视图', async ({page}) => {
  await setup(page)
  await page.goto(`${listUrl}?source=shared`)
  await expectView(page, 'all', '全部')
  await page.getByRole('tab', {name: '待处理', exact: true}).click()
  await expect.poll(() => currentViewId(page)).toBe('pending')
  expect(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('source')).toBe('shared')
  await expectView(page, 'pending', '待处理')
  await page.getByRole('tab', {name: '特殊视图', exact: true}).click()
  await expect.poll(() => currentViewId(page)).toBe(specialId)
  await page.reload()
  await expectView(page, specialId, '特殊视图')
  await page.getByRole('row').filter({hasText: `当前记录：${specialId}`}).getByRole('checkbox').check()
  await page.goBack()
  await expectView(page, 'pending', '待处理')
  await expect(page.getByRole('row').filter({hasText: '当前记录：pending'}).getByRole('checkbox')).not.toBeChecked()
  await page.goBack()
  await expectView(page, 'all', '全部')
  expect(await currentViewId(page)).toBeNull()
  await page.goForward()
  await expectView(page, 'pending', '待处理')
})

test('直接打开指定视图，不先查询默认视图', async ({page}) => {
  const {queries} = await setup(page)
  await page.goto(`${listUrl}?viewId=pending`)
  await expectView(page, 'pending', '待处理')
  expect(queries.length).toBeGreaterThan(0)
  expect(queries.every(id => id === 'pending')).toBe(true)
})

test('缺失或失效的 viewId 回退首个视图，空表单保持空态', async ({page}) => {
  const {form, queries} = await setup(page)
  await page.goto(`${listUrl}?viewId=deleted-view`)
  await expectView(page, 'all', '全部')
  expect(queries).not.toContain('deleted-view')
  await page.getByRole('tab', {name: '待处理', exact: true}).click()
  await expect.poll(() => currentViewId(page)).toBe('pending')
  form.viewTabs = []
  await page.reload()
  await expect(page.getByText('当前表单还没有视图，请先创建一个视图再查看记录。')).toBeVisible()
})

test('复制、新建和删除当前视图同步 URL，保存设置保留当前视图', async ({page}) => {
  const {form} = await setup(page)
  await page.goto(`${listUrl}?viewId=pending`)
  await expectView(page, 'pending', '待处理')
  await page.getByRole('button', {name: '视图「待处理」更多操作'}).click()
  await page.getByRole('menuitem', {name: '复制视图'}).click()
  await expect(page.getByRole('tab', {name: '待处理副本', exact: true})).toHaveAttribute('aria-selected', 'true')
  const copyId = form.viewTabs.find(view => view.label === '待处理副本')!.id
  expect(await currentViewId(page)).toBe(copyId)
  await page.getByRole('button', {name: '视图「待处理副本」更多操作'}).click()
  await page.getByRole('menuitem', {name: '删除视图'}).click()
  await page.getByRole('dialog', {name: '删除视图'}).getByRole('button', {name: '删除', exact: true}).click()
  await expectView(page, 'pending', '待处理')
  expect(await currentViewId(page)).toBe('pending')
  await page.getByRole('button', {name: '新增视图', exact: true}).click()
  await page.getByRole('menuitem').filter({hasText: '表格'}).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByPlaceholder('视图名称').fill('新建视图')
  await drawer.getByRole('button', {name: '保存', exact: true}).click()
  await expect(page.getByRole('tab', {name: '新建视图', exact: true})).toHaveAttribute('aria-selected', 'true')
  const createdId = form.viewTabs.find(view => view.label === '新建视图')!.id
  expect(await currentViewId(page)).toBe(createdId)
  await page.getByRole('button', {name: '设置当前视图', exact: true}).click()
  await drawer.getByPlaceholder('视图名称').fill('修改后的视图')
  await drawer.getByRole('button', {name: '保存', exact: true}).click()
  await expectView(page, createdId, '修改后的视图')
  expect(await currentViewId(page)).toBe(createdId)
})

test('切换其他表单后不沿用上一个表单视图，返回恢复 URL 指定视图', async ({page}) => {
  await setup(page)
  await page.goto(`${listUrl}?viewId=pending`)
  await expectView(page, 'pending', '待处理')
  await page.getByRole('link', {name: '任务', exact: true}).click()
  await expectView(page, 'tasks-all', '全部任务')
  expect(await currentViewId(page)).toBeNull()
  await page.goBack()
  await expectView(page, 'pending', '待处理')
})

test('未登录打开视图链接，登录后仍进入指定视图', async ({page}) => {
  await setup(page, {loggedIn: false})
  await page.goto(`${listUrl}?viewId=pending`)
  await expect(page.getByRole('heading', {name: '欢迎回来'})).toBeVisible()
  await page.getByLabel('用户名或邮箱', {exact: true}).fill('admin')
  await page.getByLabel('密码', {exact: true}).fill('test-password')
  await page.getByRole('button', {name: '登录', exact: true}).click()
  await expectView(page, 'pending', '待处理')
  expect(await currentViewId(page)).toBe('pending')
})

test('重新进入应用恢复上次表单与视图，同表单切换视图更新记忆', async ({page}) => {
  await setup(page)
  await page.goto(`${listUrl}?source=shared`)
  await expectView(page, 'all', '全部')
  await page.getByRole('tab', {name: '特殊视图', exact: true}).click()
  await expectView(page, specialId, '特殊视图')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('flexmodel-apps.last-location.view-url')))
    .toBe(`/apps/view-url/orders?${new URLSearchParams({viewId: specialId})}`)
  await page.goto('/#/apps/view-url')
  await expectView(page, specialId, '特殊视图')
  expect(await currentViewId(page)).toBe(specialId)
  await page.getByRole('tab', {name: '待处理', exact: true}).click()
  await expectView(page, 'pending', '待处理')
  await page.goto('/#/apps/view-url')
  await expectView(page, 'pending', '待处理')
  expect(await currentViewId(page)).toBe('pending')
  await page.getByRole('link', {name: '任务', exact: true}).click()
  await expectView(page, 'tasks-all', '全部任务')
  await page.goto('/#/apps/view-url')
  await expectView(page, 'tasks-all', '全部任务')
})

test('记忆的视图或菜单被删除后回退有效入口', async ({page}) => {
  const {form, navs} = await setup(page)
  await page.goto(`${listUrl}?viewId=pending`)
  await expectView(page, 'pending', '待处理')
  form.viewTabs = form.viewTabs.filter(view => view.id !== 'pending')
  await page.reload()
  await page.goto('/#/apps/view-url')
  await expectView(page, 'all', '全部')
  navs[0].children = navs[0].children.filter(nav => nav.id !== 'orders')
  await page.reload()
  await page.goto('/#/apps/view-url')
  await expectView(page, 'tasks-all', '全部任务')
})

test('明确选择顶部分组时仍进入该分组首个入口', async ({page}) => {
  await setup(page)
  await page.goto('/#/apps/view-url/tasks')
  await expectView(page, 'tasks-all', '全部任务')
  await page.goto('/#/apps/view-url?top=business')
  await expectView(page, 'all', '全部')
  expect(await currentViewId(page)).toBeNull()
})

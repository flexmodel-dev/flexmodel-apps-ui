import {expect, type Page, test} from '@playwright/test'

const ALL_APP_IDS = ['crm', 'oa', 'erp', 'expense', 'project', 'hr', 'asset', 'purchase']

/** 需要完整收藏列表的用例显式预置收藏；默认收藏行为由专门用例覆盖。 */
async function seedAllFavorites(page: Page) {
  await page.evaluate(ids => localStorage.setItem('flexmodel-apps.workbench-favorites', JSON.stringify(ids)), ALL_APP_IDS)
  await page.reload()
}

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'workbench-preview-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
    localStorage.setItem('night', 'false')
    localStorage.setItem('flexmodel-apps.recent-uses', JSON.stringify([
      {appId: 'crm', navId: 'menu-customers', name: '客户档案', kind: 'form', at: Date.now() - 5 * 60000},
      {appId: 'oa', name: '协同办公', kind: 'app', at: Date.now() - 60 * 60000},
    ]))
  })
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname
    if (path === '/api/apps') return route.fulfill({
      json: [
        {id: 'crm', name: '客户关系管理', enabled: true, iconName: 'Handshake', primaryColor: 'blue'},
        {id: 'oa', name: '协同办公', enabled: true, iconName: 'Briefcase', primaryColor: 'orange'},
        {id: 'erp', name: '进销存管理', enabled: true, iconName: 'Boxes', primaryColor: 'violet'},
        {id: 'expense', name: '费用报销', enabled: true, iconName: 'Wallet', primaryColor: 'green'},
        {id: 'project', name: '项目管理', enabled: true, iconName: 'FolderKanban', primaryColor: 'cyan'},
        {id: 'hr', name: '人事管理', enabled: true, iconName: 'Users', primaryColor: 'rose'},
        {id: 'asset', name: '资产管理', enabled: true, iconName: 'Monitor', primaryColor: 'indigo'},
        {id: 'purchase', name: '采购管理', enabled: true, iconName: 'ShoppingCart', primaryColor: 'amber'},
      ]
    })
    if (/^\/api\/apps\/[^/]+$/.test(path)) return route.fulfill({
      json: {
        id: path.split('/')[2],
        name: '客户关系管理',
        iconName: 'Handshake',
        primaryColor: 'blue'
      }
    })
    if (path === '/api/flows/mine/counts') return route.fulfill({json: {pending: 12, handled: 128, initiated: 36}})
    if (path.startsWith('/api/flows/mine/')) {
      const view = path.endsWith('/instances') ? 'initiated' : url.searchParams.get('view') ?? 'pending'
      const label = {pending: '待处理', handled: '已处理', initiated: '已发起'}[view] ?? ''
      const title = `${label}测试流程${url.searchParams.get('page') === '2' ? '第二页' : ''}`
      const list = title.includes(url.searchParams.get('search') ?? '') ? [{
        id: `instance-${view}`, title, appId: 'crm', appName: '客户关系管理', formName: 'orders', recordId: '',
        initiator: 'admin', status: view === 'pending' ? 'WAITING' : 'SUCCEEDED', createdAt: '2026-11-17T09:00:00',
      }] : []
      return route.fulfill({json: {list, total: list.length ? 31 : 0}})
    }
    if (path === '/api/notifications/summary') return route.fulfill({
      json: {
        version: '0',
        unread: 0,
        byCategory: {},
        apps: []
      }
    })
    const notification = {
      id: 'copy-note',
      category: 'workflow',
      title: '华星科技服务合同已签署',
      content: '合同已完成归档，请知悉。',
      appId: 'crm',
      appName: '客户关系管理',
      readAt: null,
      receivedAt: '2026-11-17T10:00:00',
      occurredAt: '2026-11-17T10:00:00'
    }
    if (path === '/api/notifications' && url.searchParams.get('category') === 'workflow') return route.fulfill({
      json: {
        list: [notification],
        total: 1
      }
    })
    if (path === '/api/notifications/copy-note') return route.fulfill({json: notification})
    if (path === '/api/notifications/copy-note/read') return route.fulfill({json: {}})
    if (path === '/api/notifications') return route.fulfill({json: {list: [], total: 0}})
    if (path.endsWith('/stream')) return route.fulfill({
      contentType: 'text/event-stream',
      body: 'event: ready\ndata: {"version":"0"}\n\n'
    })
    return route.fulfill({json: []})
  })
  await page.goto('/#/admin/workbench')
  await expect(page.getByRole('heading', {level: 1})).toHaveText(/^(上午好|下午好|晚上好)，Admin！$/)
})

test('指标来自真实接口并深链待办中心，知会打开已有通知详情', async ({page}) => {
  for (const [id, label, count] of [['pending', '待处理', '12'], ['handled', '已处理', '128'], ['initiated', '已发起', '36']]) {
    await expect(page.getByRole('link', {name: `${label} ${count}`})).toBeVisible()
    await page.getByRole('link', {name: `${label} ${count}`}).click()
    await expect(page).toHaveURL(new RegExp(`#/approval/home\\?view=${id}$`))
    await expect(page.getByRole('heading', {name: '待办中心', exact: true})).toBeVisible()
    await expect(page.getByRole('tab', {name: label, exact: true})).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('button', {name: new RegExp(`${label}测试流程`)})).toBeVisible()
    await page.getByRole('link', {name: '返回工作台'}).click()
  }
  await page.getByRole('link', {name: '已知会 1'}).click()
  await expect(page).toHaveURL(/#\/approval\/home\?view=copied$/)
  await expect(page.getByRole('tab', {name: /已知会/})).toBeVisible()
  await page.getByRole('link', {name: '返回工作台'}).click()
  const inbox = page.waitForRequest(request => request.url().includes('/api/notifications?') && request.url().includes('category=workflow'))
  await page.goto('/#/approval/home?view=copied')
  expect(new URL((await inbox).url()).searchParams.get('status')).toBe('all')
  await expect(page.getByRole('textbox', {name: '搜索审批'})).toHaveCount(0)
  const markedRead = page.waitForRequest(request => request.method() === 'PUT' && request.url().endsWith('/api/notifications/copy-note/read'))
  await page.getByRole('button', {name: /华星科技服务合同已签署/}).click()
  await expect(page.getByRole('dialog', {name: '华星科技服务合同已签署'})).toBeVisible()
  await expect(page.getByText('合同已完成归档，请知悉。', {exact: true})).toBeVisible()
  await markedRead
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('应用点击直达应用内部，收藏可增减并支持键盘与拖动排序', async ({page}) => {
  await seedAllFavorites(page)
  const apps = page.getByRole('region', {name: '我的应用', exact: true})
  const order = () => apps.locator('[data-app-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-app-id')))
  await expect.poll(order).toEqual(['crm', 'oa', 'erp', 'expense', 'project', 'hr', 'asset', 'purchase'])
  await page.getByRole('button', {name: '收藏应用', exact: true}).click()
  await page.getByRole('button', {name: '取消收藏：人事管理'}).click()
  await page.getByRole('dialog').getByRole('button', {name: '完成', exact: true}).click()
  expect(await order()).toEqual(['crm', 'oa', 'erp', 'expense', 'project', 'asset', 'purchase'])
  await page.reload()
  await expect.poll(order).toEqual(['crm', 'oa', 'erp', 'expense', 'project', 'asset', 'purchase'])
  await apps.getByRole('link', {name: '客户关系管理', exact: true}).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/apps\/crm$/)
  await page.goBack()
  const card = apps.locator('[data-app-id="crm"]')
  await card.focus()
  await page.keyboard.press('Space')
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status')).toContainText('over droppable area crm')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('status')).toContainText('over droppable area oa')
  await page.keyboard.press('Space')
  await expect.poll(order).toEqual(['oa', 'crm', 'erp', 'expense', 'project', 'asset', 'purchase'])
  const first = (await apps.getByRole('link', {name: '协同办公', exact: true}).boundingBox())!
  const second = (await apps.getByRole('link', {name: '客户关系管理', exact: true}).boundingBox())!
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
  await page.mouse.down()
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, {steps: 12})
  await page.mouse.up()
  await expect.poll(order).toEqual(['crm', 'oa', 'erp', 'expense', 'project', 'asset', 'purchase'])
  // 拖动后 200ms 内的点击会被防误触保护拦截，等待保护窗口过后再点击。
  await page.waitForTimeout(300)
  await apps.getByRole('link', {name: '客户关系管理', exact: true}).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/apps\/crm$/)
})

test('我的应用默认收藏视图，可切换所有视图', async ({page}) => {
  await seedAllFavorites(page)
  const apps = page.getByRole('region', {name: '我的应用', exact: true})
  const favoriteTab = apps.getByRole('button', {name: '收藏', exact: true})
  const allTab = apps.getByRole('button', {name: '所有', exact: true})
  await expect(favoriteTab).toHaveAttribute('aria-pressed', 'true')
  await expect(allTab).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', {name: '收藏应用', exact: true}).click()
  await page.getByRole('button', {name: '取消收藏：人事管理'}).click()
  await page.getByRole('dialog').getByRole('button', {name: '完成', exact: true}).click()
  await expect(apps.locator('[data-app-id="hr"]')).toHaveCount(0)
  await allTab.click()
  await expect(allTab).toHaveAttribute('aria-pressed', 'true')
  await expect(apps.locator('[data-app-id="hr"]')).toBeVisible()
  await favoriteTab.click()
  await expect(apps.locator('[data-app-id="hr"]')).toHaveCount(0)
})

test('最近使用来自本地记录并直达应用或菜单，明暗主题和手机布局', async ({page}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const recent = page.getByRole('region', {name: '最近使用', exact: true})
  await expect(recent.getByRole('link', {name: /协同办公/})).toBeVisible()
  await expect(recent.getByRole('link', {name: /客户档案/})).toHaveCount(0)
  await recent.getByRole('button', {name: '应用项', exact: true}).click()
  await expect(recent.getByRole('link', {name: /客户档案/})).toBeVisible()
  await expect(recent.getByRole('link', {name: /协同办公/})).toHaveCount(0)
  await recent.getByRole('button', {name: '应用', exact: true}).click()
  await expect(recent.getByRole('link', {name: /协同办公/})).toBeVisible()
  await expect(recent.getByRole('link', {name: /客户档案/})).toHaveCount(0)
  await recent.getByRole('link', {name: /协同办公/}).click()
  await expect(page).toHaveURL(/#\/apps\/oa$/)
  await page.goBack()
  await recent.getByRole('button', {name: '应用项', exact: true}).click()
  await expect(recent.getByRole('button', {name: '应用项', exact: true})).toHaveAttribute('aria-pressed', 'true')
  await recent.getByRole('link', {name: /客户档案/}).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/apps\/crm\/menu-customers$/)
  await page.goBack()
  await page.setViewportSize({width: 1440, height: 1120})
  await page.getByRole('heading', {level: 1}).scrollIntoViewIfNeeded()
  await page.mouse.move(0, 0)
  await page.screenshot({animations: 'disabled', path: 'artifacts/workbench-light.png'})
  await page.getByRole('button', {name: '切换到夜间模式'}).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.screenshot({animations: 'disabled', path: 'artifacts/workbench-dark.png'})
  await page.setViewportSize({width: 390, height: 844})
  await page.screenshot({animations: 'disabled', path: 'artifacts/workbench-mobile.png'})
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await page.locator('main').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.getByRole('link', {name: '已发起 36'}).click()
  await expect(page.getByRole('tab', {name: /已发起/})).toBeVisible()
  await expect(page.getByRole('button', {name: /已发起测试流程/})).toBeVisible()
  await page.screenshot({animations: 'disabled', path: 'artifacts/approval-center-mobile.png'})
  expect(await page.locator('main').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('待办中心 URL 支持刷新和历史导航，搜索及应用筛选复位分页', async ({page}) => {
  await page.goto('/#/approval/home?view=handled&source=test')
  await expect(page.getByRole('button', {name: /已处理测试流程/})).toBeVisible()
  await page.reload()
  await expect(page.getByRole('tab', {name: '已处理', exact: true})).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', {name: '已发起', exact: true}).click()
  await expect(page).toHaveURL(/view=initiated&source=test/)
  await page.goBack()
  await expect(page.getByRole('tab', {name: '已处理', exact: true})).toHaveAttribute('aria-selected', 'true')
  await page.goForward()
  await expect(page.getByRole('tab', {name: '已发起', exact: true})).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', {name: '待处理', exact: true}).click()
  await expect(page.getByRole('button', {name: /待处理测试流程/})).toBeVisible()
  await page.getByRole('button', {name: '第 2 页', exact: true}).click()
  await expect(page.getByRole('button', {name: /待处理测试流程第二页/})).toBeVisible()
  const filtered = page.waitForRequest(request => request.url().includes('/api/flows/mine/tasks?') && request.url().includes('appId=crm'))
  await page.getByRole('combobox', {name: '所属应用'}).selectOption('crm')
  expect(new URL((await filtered).url()).searchParams.get('page')).toBe('1')
  await page.getByRole('textbox', {name: '搜索审批'}).fill('不存在的流程')
  await expect(page.getByText('暂无审批记录')).toBeVisible()
  await page.getByRole('textbox', {name: '搜索审批'}).fill('待处理')
  await expect(page.getByRole('button', {name: /待处理测试流程/})).toBeVisible()
  await page.screenshot({animations: 'disabled', path: 'artifacts/approval-center-light.png'})
  await page.getByRole('button', {name: '切换到夜间模式'}).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.screenshot({animations: 'disabled', path: 'artifacts/approval-center-dark.png'})
  await page.goto('/#/approval/home?view=invalid')
  await expect(page.getByRole('tab', {name: '待处理', exact: true})).toHaveAttribute('aria-selected', 'true')
})

test('待办中心接口失败可重试，不显示工作台示例流程', async ({page}) => {
  let failed = true
  await page.route('**/api/flows/mine/tasks?**', route => failed ? route.fulfill({
    status: 500,
    json: {message: '待办暂时不可用'}
  }) : route.fulfill({json: {list: [], total: 0}}))
  await page.goto('/#/approval/home')
  await expect(page.getByRole('alert')).toContainText('待办暂时不可用')
  failed = false
  await page.getByRole('button', {name: '重试', exact: true}).click()
  await expect(page.getByText('暂无审批记录')).toBeVisible()
})

test('问候语按上海时段显示，卡片标题统一带左侧图标', async ({page}) => {
  for (const [time, greeting] of [
    ['2026-11-16T21:59:00Z', '晚上好'],
    ['2026-11-16T22:00:00Z', '上午好'],
    ['2026-11-17T04:00:00Z', '下午好'],
    ['2026-11-17T10:00:00Z', '晚上好'],
  ]) {
    await page.clock.setFixedTime(new Date(time))
    await page.reload()
    await expect(page.getByRole('heading', {level: 1})).toHaveText(`${greeting}，Admin！`)
  }
  for (const title of ['流程待办', '我的应用', '最近使用']) {
    await expect(page.getByRole('heading', {name: title, exact: true}).locator('svg')).toBeVisible()
  }
})

test('更多菜单仅取消收藏，点击菜单不会误进应用', async ({page}) => {
  await seedAllFavorites(page)
  const app = page.locator('[data-app-id="crm"]')
  const more = page.getByRole('button', {name: '更多操作：客户关系管理', exact: true})
  await app.hover()
  await expect(more).toHaveCSS('opacity', '1')
  await more.click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expect(page.getByRole('menuitem', {name: '打开应用'})).toHaveCount(0)
  await page.getByRole('menuitem', {name: '取消收藏'}).click()
  await expect(app).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/admin\/workbench$/)
  await page.setViewportSize({width: 390, height: 844})
  await expect(page.getByRole('button', {name: '更多操作：协同办公', exact: true})).toHaveCSS('opacity', '1')
})

test('卡片左上角星标图标可直接切换收藏且不误进应用', async ({page}) => {
  await seedAllFavorites(page)
  const apps = page.getByRole('region', {name: '我的应用', exact: true})
  const star = apps.getByRole('button', {name: '收藏星标：人事管理', exact: true})
  await expect(star).toHaveCSS('opacity', '0')
  await apps.locator('[data-app-id="hr"]').hover()
  await expect(star).toHaveCSS('opacity', '1')
  await expect(star).toHaveAttribute('aria-pressed', 'true')
  await expect(star.locator('svg')).toHaveClass(/fill-amber-400/)
  await star.click()
  await expect(apps.locator('[data-app-id="hr"]')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/admin\/workbench$/)
  await page.getByRole('button', {name: '所有', exact: true}).click()
  await expect(star).toHaveAttribute('aria-pressed', 'false')
  await expect(star.locator('svg')).not.toHaveClass(/fill-amber-400/)
  await star.click()
  await expect(star).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.move(0, 0)
  await expect(star).toHaveCSS('opacity', '0')
  await page.reload()
  await expect(apps.locator('[data-app-id="hr"]')).toBeVisible()
})

test('首次进入默认收藏最近使用的应用，收藏视图与所有视图不再相同', async ({page}) => {
  const apps = page.getByRole('region', {name: '我的应用', exact: true})
  const order = () => apps.locator('[data-app-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-app-id')))
  await expect.poll(order).toEqual(['crm', 'oa'])
  await apps.getByRole('button', {name: '所有', exact: true}).click()
  await expect.poll(order).toEqual(ALL_APP_IDS)
})

test('待办预览直接打开审批抽屉，同意后刷新待办数字', async ({page}) => {
  const pending = page.getByRole('region', {name: '流程待办', exact: true})
  await expect(pending.getByRole('heading', {name: '待我审批', exact: true})).toBeVisible()
  await page.route('**/api/apps/crm/flow-instances/instance-pending', route => route.fulfill({
    json: {
      id: 'instance-pending', appId: 'crm', appName: '客户关系管理', title: '待处理测试流程',
      formName: 'orders', recordId: '', initiator: 'admin', status: 'WAITING',
      createdAt: '2026-11-17T09:00:00', canManage: false, snapshot: {}, variables: {amount: 100}, error: '',
      tasks: [{id: 'task-1', userId: 'admin', status: 'PENDING', position: 0, waitId: 'wait-1'}],
      waits: [], upcoming: [], logs: [], children: [], notificationDelivery: [], delivery: []
    }
  }))
  const decided = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/api/apps/crm/flow-tasks/task-1/decisions'))
  const refreshed = page.waitForRequest(request => request.url().includes('/api/flows/mine/counts'))
  await pending.getByRole('button', {name: /待处理测试流程/}).click()
  await expect(page.getByRole('dialog', {name: /待处理测试流程/})).toBeVisible()
  await page.getByRole('button', {name: '同意', exact: true}).click()
  await decided
  await refreshed
})

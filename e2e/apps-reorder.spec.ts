import {test, expect, type Page} from '@playwright/test'

// 应用管理拖动排序验收：mock API + 无头 Chromium，覆盖
// 1) 拖动换位后不误入应用（dnd-kit 在 document 捕获阶段截停合成 click，
//    <a> 默认导航只能靠原生 preventDefault 阻止——此前两轮修复均栽在这里）；
// 2) 顺序乐观更新并 PATCH /api/apps/order 落库；
// 3) 普通点击仍能进入应用。

interface AppPayload {
  id: string
  projectId: string
  name: string
  description: string
  iconName: string
  primaryColor: string
  enabled: boolean
  owner: string
  createdAt: string
  updatedAt: string
}

export const apps: AppPayload[] = [
  {
    id: 'app-a',
    projectId: 'app-a',
    name: '应用甲',
    description: '',
    iconName: 'Boxes',
    primaryColor: 'blue',
    enabled: true,
    owner: 'admin',
    createdAt: '2026-11-01 10:00:00',
    updatedAt: '2026-11-01 10:00:00'
  },
  {
    id: 'app-b',
    projectId: 'app-b',
    name: '应用乙',
    description: '',
    iconName: 'Boxes',
    primaryColor: 'blue',
    enabled: true,
    owner: 'admin',
    createdAt: '2026-11-02 10:00:00',
    updatedAt: '2026-11-02 10:00:00'
  },
  {
    id: 'app-c',
    projectId: 'app-c',
    name: '应用丙',
    description: '',
    iconName: 'Boxes',
    primaryColor: 'blue',
    enabled: true,
    owner: 'admin',
    createdAt: '2026-11-03 10:00:00',
    updatedAt: '2026-11-03 10:00:00'
  },
]

/** 卡片网格中的应用顺序（取每个卡片 Link 的 href） */
const cardOrder = (page: Page) =>
  page.locator('[data-primary] > a').evaluateAll(els =>
    els.map(el => (el.getAttribute('href') ?? '').replace('#/apps/', '')))

async function setup(page: Page) {
  const reorderRequests: string[][] = []
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'apps-reorder-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
  })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    const app = apps.find(app => path === `/api/apps/${app.id}`)
    if (app) return route.fulfill({json: app})
    if (path === '/api/apps') return route.fulfill({json: apps})
    if (path === '/api/apps/order') {
      const body = route.request().postDataJSON() as { ids: string[] }
      reorderRequests.push(body.ids)
      const byId = new Map(apps.map(app => [app.id, app]))
      return route.fulfill({json: body.ids.map(id => byId.get(id))})
    }
    if (path === '/api/notifications/summary') {
      return route.fulfill({json: {version: '0', unread: 0, byCategory: {}, apps: []}})
    }
    if (path === '/api/notifications') {
      return route.fulfill({json: {list: [], total: 0}})
    }
    return route.fulfill({json: []})
  })
  await page.goto('/#/admin/apps')
  await expect(page.getByRole('heading', {name: '应用管理'})).toBeVisible()
  await expect(page.getByText('应用甲')).toBeVisible()
  return {reorderRequests}
}

test('拖动换位不进入应用并保存顺序', async ({page}) => {
  const {reorderRequests} = await setup(page)
  expect(await cardOrder(page)).toEqual(['app-a', 'app-b', 'app-c'])

  const aBox = (await page.locator('a:has-text("应用甲")').boundingBox())!
  const cBox = (await page.locator('a:has-text("应用丙")').boundingBox())!
  await page.mouse.move(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2, {steps: 12})
  await page.mouse.up()
  // 真实浏览器在拖放后会派发合成 click 落在卡片 Link 上触发 <a> 默认导航（用户实测的误入应用）；
  // Playwright 注入的输入序列不产生该合成事件，手动在落点补发等价点击还原该场景
  await page.mouse.click(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2)

  // 核心断言：放下后停留在应用管理页，不发生 <a> 默认导航
  await expect(page).toHaveURL(/#\/admin\/apps$/)
  await expect.poll(() => reorderRequests).toEqual([['app-b', 'app-c', 'app-a']])
  await expect.poll(() => cardOrder(page)).toEqual(['app-b', 'app-c', 'app-a'])
})

test('普通点击仍进入应用', async ({page}) => {
  await setup(page)
  await page.locator('a:has-text("应用乙")').click()
  await expect(page).toHaveURL(/#\/apps\/app-b/)
})

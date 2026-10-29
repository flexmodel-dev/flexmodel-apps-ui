import {test, expect, type Page} from '@playwright/test'
import {getAppPrimaryColor} from '../src/theme/appPrimaryColors'

const apps = [
  {id: 'theme-green', name: '绿色应用', primaryColor: 'green', iconName: 'Boxes'},
  {id: 'theme-rose', name: '玫红应用', primaryColor: 'rose', iconName: 'Boxes'},
]

async function setup(page: Page, dark = false) {
  const controls = {gate: Promise.resolve(), fail: false}
  await page.addInitScript(({dark}) => {
    localStorage.setItem('flexmodel-apps.auth.token', 'theme-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
    localStorage.setItem('night', String(dark))
    // 按实际绘制帧记录顶部栏主色，捕获短暂回落到蓝色的回归。
    const frames: {path: string; color: string; primary: string; dark: boolean}[] = []
    Object.assign(window, {themeFrames: frames})
    const sample = () => {
      if (document.querySelector('header')) {
        const root = document.documentElement
        frames.push({path: location.hash, color: root.dataset.primary ?? '',
          primary: getComputedStyle(root).getPropertyValue('--primary').trim(),
          dark: root.classList.contains('dark')})
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }, {dark})
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    const app = apps.find(app => path === `/api/apps/${app.id}`)
    if (app) {
      await controls.gate
      return route.fulfill(controls.fail ? {status: 500, json: {message: '应用加载失败'}} : {json: app})
    }
    if (path === '/api/apps') return route.fulfill({json: apps})
    if (path === '/api/notifications/summary') {
      return route.fulfill({json: {version: '0', unread: 0, byCategory: {}, apps: []}})
    }
    if (path === '/api/notifications') return route.fulfill({json: {list: [], total: 0}})
    return route.fulfill({json: []})
  })
  return controls
}

async function expectPaintedTheme(page: Page, color: string, dark: boolean) {
  await expect(page.locator('header')).toBeVisible()
  // 等待若干实际绘制帧，而非仅检查最终 DOM 属性。
  const frames = await page.evaluate(async () => {
    for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame)
    return (window as unknown as {themeFrames: {color: string; primary: string; dark: boolean}[]}).themeFrames
  })
  expect(frames.length).toBeGreaterThan(0)
  const definition = getAppPrimaryColor(color)
  expect(frames.every(frame => frame.color === color && frame.dark === dark
    && frame.primary === (dark ? definition.primaryDark : definition.primary))).toBe(true)
}

for (const dark of [false, true]) {
  test(`${dark ? '夜间' : '浅色'}模式首次进入与延迟接口刷新均无默认色绘制帧`, async ({page}) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const controls = await setup(page, dark)
    let release!: () => void
    controls.gate = new Promise<void>(resolve => { release = resolve })
    const request = page.waitForRequest('**/api/apps/theme-green')
    await page.goto('/#/apps/theme-green', {waitUntil: 'domcontentloaded'})
    await request
    await expect(page.getByRole('status', {name: '应用加载中'})).toBeVisible()
    await expect(page.locator('header')).toHaveCount(0)
    expect(await page.locator('html').evaluate(root => root.classList.contains('dark'))).toBe(dark)
    release()
    await expect(page.getByRole('link', {name: '绿色应用', exact: true})).toBeVisible()
    await expectPaintedTheme(page, 'green', dark)

    // 配色由上次实际接口响应持久化；本次刷新接口继续等待。
    controls.gate = new Promise<void>(resolve => { release = resolve })
    const reloadRequest = page.waitForRequest('**/api/apps/theme-green')
    await page.reload({waitUntil: 'domcontentloaded'})
    await reloadRequest
    await expectPaintedTheme(page, 'green', dark)
    release()
    await expect(page.getByRole('link', {name: '绿色应用', exact: true})).toBeVisible()
    await expectPaintedTheme(page, 'green', dark)
    expect(errors).toEqual([])
  })
}

test('应用列表预热配色，跨应用切换与返回管理页主色互不污染', async ({page}) => {
  await setup(page)
  await page.goto('/#/admin/apps')
  await page.getByRole('link', {name: /绿色应用/}).click()
  await expect(page.getByRole('link', {name: '绿色应用', exact: true})).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-primary', 'green')
  await page.evaluate(() => { location.hash = '/apps/theme-rose' })
  await expect(page.getByRole('link', {name: '玫红应用', exact: true})).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-primary', 'rose')
  await page.evaluate(() => { location.hash = '/admin/apps' })
  await expect(page.locator('html')).toHaveAttribute('data-primary', 'blue')
  const frames = await page.evaluate(async () => {
    for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame)
    return (window as unknown as {themeFrames: {path: string; color: string}[]}).themeFrames
  })
  for (const app of apps) {
    const appFrames = frames.filter(frame => frame.path === `#/apps/${app.id}`)
    expect(appFrames.length).toBeGreaterThan(0)
    expect(appFrames.every(frame => frame.color === app.primaryColor)).toBe(true)
  }
})

test('配色持久化写入失败仍能正常进入应用', async ({page}) => {
  await setup(page)
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('flexmodel-apps.primary-color.')) throw new DOMException('存储已满', 'QuotaExceededError')
      return setItem.call(this, key, value)
    }
  })
  await page.goto('/#/apps/theme-green')
  await expect(page.getByRole('link', {name: '绿色应用', exact: true})).toBeVisible()
  await expectPaintedTheme(page, 'green', false)
})

test('首次应用接口失败后退出主题加载态', async ({page}) => {
  const controls = await setup(page)
  controls.fail = true
  await page.goto('/#/apps/theme-green')
  await expect(page.getByRole('status', {name: '应用加载中'})).toHaveCount(0)
  await expect(page.locator('header')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-primary', 'blue')
})

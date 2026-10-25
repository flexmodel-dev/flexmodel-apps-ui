import {test, expect, type Page} from '@playwright/test'

const appId = 'settings-ui'
const root = `/api/apps/${appId}`
const listUrl = `/admin/apps/${appId}/settings/forms`
const detailUrl = (section: string) => `/admin/apps/${appId}/forms/orders/${section}`
const app = {id: appId, projectId: appId, name: '业务协作', description: '管理业务数据与团队流程', iconName: 'Boxes', primaryColor: 'blue', enabled: true}

async function setup(page: Page, {failForm = false, pendingForm}: {failForm?: boolean; pendingForm?: Promise<void>} = {}) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const fields = [
    {name: 'title', label: '订单名称', type: 'TEXT', required: true, builtin: false},
    {name: 'amount', label: '金额', type: 'DECIMAL', required: true, builtin: false, config: {decimalPlaces: 2}},
    {name: 'status', label: '订单状态', type: 'SELECT', required: false, builtin: false,
      options: [{id: 'new', text: '待处理'}, {id: 'done', text: '已完成'}]},
    {name: 'created_at', label: '创建时间', type: 'DATETIME', builtin: true},
    {name: 'updated_at', label: '更新时间', type: 'DATETIME', builtin: true},
  ]
  const form = {name: 'orders', label: '订单', description: '统一维护订单信息、金额与处理状态。', displayField: 'title', builtin: false, managed: true,
    fields, layout: {items: fields.map(field => ({type: 'FIELD', name: field.name, width: 'HALF'}))}, viewTabs: []}
  const forms = [form,
    {...form, name: 'customers', label: '客户', description: '集中管理客户资料与联系方式。'},
    {...form, name: 'f_user', label: '用户', description: '维护应用用户及人员信息。', builtin: true},
  ]
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'settings-ui-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
  })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path === `${root}/forms` && method === 'POST') {
      const input = route.request().postDataJSON()
      const created = {...form, name: input.name, label: input.label, description: input.description}
      forms.push(created)
      return route.fulfill({status: 201, json: created})
    }
    if (path === `${root}/forms/orders`) {
      await pendingForm
      if (failForm) return route.fulfill({status: 500, json: {message: '表单加载失败，请重试。'}})
      return route.fulfill({json: form})
    }
    const selected = forms.find(form => path === `${root}/forms/${form.name}`)
    if (selected) return route.fulfill({json: selected})
    if (path === '/api/apps/system/forms/f_role') return route.fulfill({json: {...form, name: 'f_role', label: '角色', builtin: true}})
    if (path === '/api/system/forms/f_role') return route.fulfill({json: {...form, name: 'f_role', label: '角色', listColumns: [], resources: []}})
    if (path.endsWith('/records') || path === '/api/notifications') return route.fulfill({json: {list: [], total: 0}})
    const json = path === root ? app : path === '/api/apps' ? [app]
      : path === `${root}/forms` ? forms
        : path === '/api/notifications/summary' ? {version: '0', unread: 0, byCategory: {}, apps: []} : []
    return route.fulfill({json})
  })
  return {errors, form, forms}
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth, width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight, viewportHeight: window.innerHeight,
  }))
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport)
  expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewportHeight)
  await expect(page.getByRole('button', {name: '返回表单列表'})).toBeVisible()
}

test('表单列表、信息、字段和设计器页头一致，返回沿设置层级导航', async ({page}) => {
  const {errors} = await setup(page)
  await page.goto(`#${listUrl}`)
  await expect(page.getByRole('heading', {level: 1})).toHaveText('业务协作 · 表单管理')
  await expect(page.getByRole('button', {name: '新建表单', exact: true})).toHaveCount(1)
  await page.screenshot({path: 'artifacts/forms-settings-list.png', animations: 'disabled'})
  await page.getByRole('link', {name: '订单', exact: true}).click()
  const baseHeader = await page.locator('[data-settings-header]').boundingBox()
  await expect(page.getByRole('heading', {level: 1})).toHaveText('订单 · 基本信息')
  await page.screenshot({path: 'artifacts/forms-settings-base.png', animations: 'disabled'})
  await page.getByRole('navigation', {name: '表单设置'}).getByRole('link', {name: '字段管理'}).click()
  await expect(page.getByRole('heading', {level: 1})).toHaveText('订单 · 字段管理')
  await expect(page.getByRole('link', {name: '字段管理', exact: true})).toHaveAttribute('aria-current', 'page')
  const fieldHeader = await page.locator('[data-settings-header]').boundingBox()
  expect(fieldHeader?.x).toBe(baseHeader?.x)
  expect(fieldHeader?.width).toBe(baseHeader?.width)
  await page.screenshot({path: 'artifacts/forms-settings-fields.png', animations: 'disabled'})
  await page.getByRole('navigation', {name: '表单设置'}).getByRole('link', {name: '表单设计'}).click()
  await expect(page.getByRole('heading', {level: 1})).toHaveText('订单 · 表单设计')
  const designHeader = await page.locator('[data-settings-header]').boundingBox()
  expect(designHeader?.x).toBe(baseHeader?.x)
  expect(designHeader?.width).toBe(baseHeader?.width)
  await page.screenshot({path: 'artifacts/forms-settings-designer.png', animations: 'disabled'})
  await page.getByRole('button', {name: '返回表单列表'}).click()
  await expect(page).toHaveURL(new RegExp(`#${listUrl}$`))
  await page.getByRole('button', {name: '返回应用管理'}).click()
  await expect(page).toHaveURL(/#\/admin\/apps$/)
  expect(errors).toEqual([])
})

test('直接进入任一表单页面都能返回列表，不依赖浏览器历史', async ({page}) => {
  const {errors} = await setup(page)
  for (const section of ['base', 'fields', 'form-design']) {
    await page.goto(`#${detailUrl(section)}`)
    await expect(page.getByRole('heading', {level: 1})).toContainText('订单')
    await page.getByRole('button', {name: '返回表单列表'}).click()
    await expect(page).toHaveURL(new RegExp(`#${listUrl}$`))
    await expect(page.getByRole('link', {name: '订单', exact: true})).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('手机与平板保留返回、导航和操作，不产生页面横向或外层滚动', async ({page}) => {
  const {errors} = await setup(page)
  for (const width of [960, 768, 375]) {
    await page.setViewportSize({width, height: 900})
    for (const section of ['base', 'fields', 'form-design']) {
      await page.goto(`#${detailUrl(section)}`)
      await expect(page.getByRole('heading', {level: 1})).toContainText('订单')
      await expectNoOverflow(page)
      await expect(page.getByRole('navigation', {name: '表单设置'})).toBeVisible()
      if (width === 375) await page.screenshot({path: `artifacts/forms-settings-mobile-${section}.png`, animations: 'disabled'})
    }
  }
  await page.setViewportSize({width: 1440, height: 900})
  await page.goto(`#${detailUrl('fields')}`)
  await expect(page.getByRole('heading', {level: 1})).toHaveText('订单 · 字段管理')
  await page.getByTitle('切换到夜间模式').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.screenshot({path: 'artifacts/forms-settings-fields-dark.png', animations: 'disabled'})
  expect(errors).toEqual([])
})

test('加载失败时仍可返回列表', async ({page}) => {
  const {errors} = await setup(page, {failForm: true})
  for (const section of ['base', 'fields', 'form-design']) {
    await page.goto(`#${detailUrl(section)}`)
    await expect(page.getByText('表单加载失败，请重试。', {exact: true})).toBeVisible()
    await page.getByRole('button', {name: '返回表单列表'}).click()
    await expect(page).toHaveURL(new RegExp(`#${listUrl}$`))
  }
  expect(errors).toEqual([])
})

test('加载中也可返回，不被接口请求阻塞', async ({page}) => {
  let release!: () => void
  const pendingForm = new Promise<void>(resolve => { release = resolve })
  const {errors} = await setup(page, {pendingForm})
  try {
    await page.goto(`#${detailUrl('form-design')}`)
    await page.getByRole('button', {name: '返回表单列表'}).click()
    await expect(page).toHaveURL(new RegExp(`#${listUrl}$`))
  } finally { release() }
  expect(errors).toEqual([])
})

test('统一的新建表单入口仍可创建并进入基本信息', async ({page}) => {
  const {errors, forms} = await setup(page)
  await page.goto(`#${listUrl}`)
  await page.getByRole('button', {name: '新建表单', exact: true}).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('表单名称').fill('开票申请')
  await dialog.getByLabel('内部标识').fill('invoices')
  await dialog.getByRole('button', {name: '创建', exact: true}).click()
  await expect(dialog).not.toBeVisible()
  expect(forms).toHaveLength(4)
  await page.getByRole('link', {name: '开票申请', exact: true}).click()
  await expect(page.getByRole('heading', {level: 1})).toHaveText('开票申请 · 基本信息')
  expect(errors).toEqual([])
})

test('系统表单设计器返回对应的系统管理页面', async ({page}) => {
  await setup(page)
  await page.goto('#/admin/apps/system/forms/f_role/form-design')
  await expect(page.getByRole('heading', {level: 1})).toHaveText('角色 · 表单设计')
  await page.getByRole('button', {name: '返回系统管理'}).click()
  await expect(page).toHaveURL(/#\/admin\/role-privileges$/)
})

import {test, expect, type Page} from '@playwright/test'

const root = '/api/apps/field-config'
const recordsPath = `${root}/forms/orders/records`
const app = {id: 'field-config', name: '字段属性验证', enabled: true, primaryColor: 'blue'}

async function setup(page: Page) {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const fields = [
    {name: 'title', label: '名称', type: 'TEXT', required: true, builtin: false, config: {defaultValue: '默认订单', maxLength: 10, updatable: false}},
    {name: 'amount', label: '金额', type: 'DECIMAL', required: true, builtin: false,
      config: {defaultValue: 0, allowNegative: false, decimalPlaces: 2, prefix: '¥', suffix: '元'}},
    {name: 'tags', label: '标记', type: 'MULTISELECT', required: true, builtin: false,
      options: [{id: 'a', text: '甲', defaultSelected: true}, {id: 'b', text: '乙', defaultSelected: true}], config: {displayStyle: 'DROPDOWN'}},
    {name: 'day', label: '日期', type: 'DATE', builtin: false, config: {defaultValue: '2026-10-24', dateFormat: 'yyyy/MM/dd'}},
    {name: 'approved', label: '已确认', type: 'BOOL', builtin: false, config: {defaultValue: false}},
  ]
  const form = {name: 'orders', label: '订单', displayField: 'title', builtin: false, managed: true,
    fields, layout: {items: fields.map(field => ({type: 'FIELD', name: field.name, width: 'HALF'}))}, viewTabs: []}
  const writes: Record<string, unknown>[] = []
  let record: Record<string, unknown> = {id: 'order1', title: '已有订单', amount: 1234.5, tags: ['a'], day: '2026-10-24', approved: false}
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'field-config-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
  })
  await page.route('**/api/**', async route => {
    const {pathname} = new URL(route.request().url())
    const method = route.request().method()
    if (pathname.endsWith('/approvals')) return route.fulfill({json: []})
    if (pathname.startsWith(`${root}/forms/orders/fields/`) && method === 'PUT') {
      const name = pathname.split('/').pop()
      const field = fields.find(field => field.name === name)!
      const input = route.request().postDataJSON()
      Object.assign(field, input)
      return route.fulfill({json: field})
    }
    if (pathname.startsWith(recordsPath)) {
      if (method === 'POST' || method === 'PUT') {
        const input = route.request().postDataJSON()
        writes.push(input)
        record = method === 'POST' ? {...input, id: 'order1'} : {...record, ...input}
        return route.fulfill({status: method === 'POST' ? 201 : 200, json: record})
      }
      return route.fulfill({json: pathname === recordsPath ? {list: [record], total: 1} : record})
    }
    const json = pathname === root ? app
      : pathname === '/api/apps' ? [app]
        : pathname === `${root}/forms/orders` ? form
          : pathname === `${root}/forms` ? [form]
            : pathname === `${root}/menus` ? [{id: 'orders', type: 'ITEM', name: '订单', target: {type: 'FORM', id: 'orders'}, children: []}]
              : pathname === '/api/notifications/summary' ? {version: '0', unread: 0, byCategory: {}, apps: []}
                : pathname === '/api/notifications' ? {list: [], total: 0} : []
    return route.fulfill({json})
  })
  return {form, writes, pageErrors}
}

test('字段管理保存并重新回填数值属性', async ({page}) => {
  const {form, pageErrors} = await setup(page)
  await page.goto('/#/admin/apps/field-config/forms/orders/fields')
  await page.getByText('amount · 小数').locator('..').locator('..').getByRole('button', {name: '编辑', exact: true}).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('默认值', {exact: true})).toHaveValue('0')
  await dialog.getByLabel('小数位数（0–6，留空不限制）').fill('4')
  await dialog.getByLabel('显示前缀').fill('$')
  await dialog.getByLabel('显示后缀').fill('USD')
  await page.screenshot({path: 'artifacts/field-config-editor.png', animations: 'disabled'})
  await dialog.getByRole('button', {name: '保存', exact: true}).click()
  await expect(dialog).not.toBeVisible()
  expect(form.fields[1].config).toMatchObject({decimalPlaces: 4, allowNegative: false, prefix: '$', suffix: 'USD'})
  await page.getByText('amount · 小数').locator('..').locator('..').getByRole('button', {name: '编辑', exact: true}).click()
  await expect(dialog.getByLabel('小数位数（0–6，留空不限制）')).toHaveValue('4')
  await expect(dialog.getByLabel('显示后缀')).toHaveValue('USD')
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.screenshot({path: 'artifacts/field-config-editor-dark.png', animations: 'disabled'})
  expect(pageErrors).toEqual([])
})

test('记录应用默认值、多选与显示格式，编辑不提交禁止修改的字段', async ({page}) => {
  const {writes, pageErrors} = await setup(page)
  await page.goto('/#/apps/field-config/orders')
  await expect(page.getByText('¥1,234.50元', {exact: true})).toBeVisible()
  await expect(page.getByText('2026/10/24', {exact: true})).toBeVisible()
  await page.getByRole('button', {name: '新建', exact: true}).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByPlaceholder('请输入名称')).toHaveValue('默认订单')
  await expect(drawer.getByPlaceholder('请输入金额')).toHaveValue('0')
  await expect(drawer.getByRole('button', {name: '甲、乙', exact: true})).toBeVisible()
  await drawer.getByRole('button', {name: '甲、乙', exact: true}).click()
  await expect(page.getByRole('checkbox').filter({visible: true}).first()).toBeVisible()
  const popover = page.locator('[data-radix-popper-content-wrapper]')
  await popover.getByText('乙', {exact: true}).click()
  await page.keyboard.press('Escape')
  await drawer.getByPlaceholder('请输入金额').fill('1.234')
  await drawer.getByRole('button', {name: '保存', exact: true}).click()
  await expect(drawer.getByText('金额最多允许2位小数', {exact: true})).toBeVisible()
  expect(writes).toHaveLength(0)
  await drawer.getByPlaceholder('请输入金额').fill('1234.5')
  await drawer.getByRole('button', {name: '保存', exact: true}).click()
  await expect(drawer.getByRole('heading', {name: '默认订单', exact: true})).toBeVisible()
  expect(writes[0]).toMatchObject({title: '默认订单', amount: 1234.5, tags: ['a'], approved: false})
  await expect(drawer.getByText('¥1,234.50元', {exact: true})).toBeVisible()
  await page.screenshot({path: 'artifacts/field-config-record.png', animations: 'disabled'})
  await drawer.getByRole('button', {name: '编辑', exact: true}).click()
  await expect(drawer.getByPlaceholder('请输入名称')).toBeDisabled()
  await drawer.getByPlaceholder('请输入金额').fill('20')
  await drawer.getByRole('button', {name: '保存', exact: true}).click()
  await expect(drawer.getByText('¥20.00元', {exact: true})).toBeVisible()
  expect(writes[1]).not.toHaveProperty('title')
  expect(pageErrors).toEqual([])
})

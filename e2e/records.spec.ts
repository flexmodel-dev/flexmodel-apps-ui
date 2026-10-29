import {test, expect, type Page} from '@playwright/test'

const root = '/api/apps/record-edit'
const recordsPath = `${root}/forms/purchase/records`
const listUrl = '/#/apps/record-edit/purchases'
const app = {id: 'record-edit', name: '记录编辑回归', enabled: true, primaryColor: 'blue'}
const menus = [{
  id: 'records', type: 'GROUP', name: '业务', children: [{
    id: 'purchases', type: 'ITEM', name: '采购申请',
    target: {type: 'FORM', id: 'purchase'}, children: [],
  }],
}]
const form = {
  name: 'purchase', label: '采购申请', displayField: 'title', builtin: false,
  fields: [
    {name: 'title', label: '申请事由', type: 'TEXT', required: true},
    {name: 'amount', label: '申请金额', type: 'DECIMAL', required: true},
    {name: 'approved', label: '已确认', type: 'BOOL'},
    {name: 'note', label: '备注', type: 'NTEXT'},
    {name: 'optional', label: '补充信息', type: 'TEXT'},
    {name: 'category', label: '分类', type: 'SELECT', options: [{id: 'office', text: '办公用品'}]},
    {name: 'supplier', label: '供应商', type: 'REFERENCE', referenceForm: 'supplier'},
  ],
  layout: {items: []}, viewTabs: [],
}

async function setupRecords(page: Page, {pending, failLoad = false}: {
  pending?: Promise<void>; failLoad?: boolean
} = {}) {
  const records: Record<string, Record<string, unknown>> = {
    first: {
      id: 'first', title: '原始申请', amount: 0, approved: false, note: null,
      category: 'office', supplier: {id: 'supplier-1', displayValue: '供应商甲'},
    },
    second: {id: 'second', title: '另一条申请', amount: 42, approved: true, note: '第二条备注'},
  }
  const writes: Record<string, unknown>[] = []
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'record-edit-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
  })
  await page.route('**/api/**', async (route) => {
    const {pathname} = new URL(route.request().url())
    const method = route.request().method()
    if (pathname === '/api/notifications') {
      return route.fulfill({json: {list: [], total: 0}})
    }
    if (pathname.endsWith('/approvals')) return route.fulfill({json: []})
    if (pathname.startsWith(`${recordsPath}/`)) {
      const id = pathname.slice(recordsPath.length + 1)
      if (method === 'PUT') {
        const payload = route.request().postDataJSON()
        writes.push(payload)
        records[id] = {
          ...records[id], ...payload, title: payload.title.trim(),
          supplier: payload.supplier ? {id: payload.supplier, displayValue: '供应商甲'} : null,
        }
      } else {
        await pending
        if (failLoad) return route.fulfill({status: 500, json: {message: '记录读取失败'}})
      }
      return route.fulfill({json: records[id]})
    }
    if (pathname === recordsPath) {
      if (method === 'POST') {
        const payload = route.request().postDataJSON()
        writes.push(payload)
        records.created = {...payload, id: 'created'}
        return route.fulfill({status: 201, json: records.created})
      }
      return route.fulfill({json: {list: Object.values(records), total: Object.keys(records).length}})
    }
    if (pathname === `${root}/forms/supplier/records`) {
      return route.fulfill({json: {list: [{id: 'supplier-1', title: '供应商甲'}], total: 1}})
    }
    if (pathname === `${root}/forms/supplier/records/supplier-1`) {
      return route.fulfill({json: {id: 'supplier-1', title: '供应商甲'}})
    }
    if (pathname === `${root}/forms/supplier`) {
      return route.fulfill({json: {...form, name: 'supplier', label: '供应商', fields: []}})
    }
    const json = pathname === root ? app
      : pathname === '/api/apps' ? [app]
        : pathname === `${root}/menus` ? menus
          : pathname === `${root}/forms/purchase` ? form
            : pathname === `${root}/forms` ? [form]
              : pathname === '/api/notifications/summary'
                ? {version: '0', unread: 0, byCategory: {}, apps: []}
                : []
    return route.fulfill({json})
  })
  await page.goto(listUrl)
  await expect(page.getByRole('row').filter({hasText: '原始申请'})).toBeVisible()
  return {records, writes}
}

test('列表直接编辑等待记录加载，回填全部字段并在重开时切换到正确记录', async ({page}) => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  await setupRecords(page, {pending})
  await page.getByRole('row').filter({hasText: '原始申请'}).getByTitle('编辑', {exact: true}).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByRole('heading', {name: '编辑采购申请'})).toBeVisible()
  try {
    await expect(drawer.getByRole('button', {name: '保存', exact: true})).toBeDisabled()
  } finally {
    release()
  }
  await expect(drawer.getByPlaceholder('请输入申请事由')).toHaveValue('原始申请')
  await expect(drawer.getByPlaceholder('请输入申请金额')).toHaveValue('0')
  await expect(drawer.getByRole('checkbox')).not.toBeChecked()
  await expect(drawer.locator('textarea')).toHaveValue('')
  await expect(drawer.getByPlaceholder('请输入补充信息')).toHaveValue('')
  await expect(drawer.getByRole('combobox').nth(0)).toHaveText('办公用品')
  await expect(drawer.getByRole('combobox', {name: '供应商', exact: true})).toHaveValue('供应商甲')
  await expect(drawer.locator('input[value="undefined"]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()
  await page.getByRole('row').filter({hasText: '另一条申请'}).getByTitle('编辑', {exact: true}).click()
  await expect(drawer.getByPlaceholder('请输入申请事由')).toHaveValue('另一条申请')
  await expect(drawer.getByPlaceholder('请输入申请金额')).toHaveValue('42')
  await expect(drawer.getByRole('checkbox')).toBeChecked()
  await expect(drawer.locator('textarea')).toHaveValue('第二条备注')
})

test('详情编辑保存后立即显示服务端返回值，再次编辑保留新值', async ({page}) => {
  const {writes} = await setupRecords(page)
  await page.getByRole('row').filter({hasText: '原始申请'}).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByRole('heading', {name: '原始申请', exact: true})).toBeVisible()
  await drawer.getByRole('button', {name: '编辑', exact: true}).click()
  await drawer.getByPlaceholder('请输入申请事由').fill('  更新后的申请  ')
  await drawer.getByPlaceholder('请输入申请金额').fill('18.5')
  await drawer.getByRole('checkbox').check()
  await drawer.locator('textarea').fill('更新后的备注')
  await drawer.getByRole('button', {name: '保存', exact: true}).click()
  await expect(drawer.getByRole('heading', {name: '更新后的申请', exact: true})).toBeVisible()
  await expect(drawer.getByText('18.5', {exact: true})).toBeVisible()
  await expect(drawer.getByText('更新后的备注', {exact: true})).toBeVisible()
  await expect(drawer.getByText('供应商甲', {exact: true})).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({amount: 18.5, approved: true, supplier: 'supplier-1', optional: null})
  await drawer.getByRole('button', {name: '编辑', exact: true}).click()
  await expect(drawer.getByPlaceholder('请输入申请事由')).toHaveValue('更新后的申请')
  await expect(drawer.getByPlaceholder('请输入申请金额')).toHaveValue('18.5')
})

test('记录加载失败时显示错误并禁止保存空表单', async ({page}) => {
  const {writes} = await setupRecords(page, {failLoad: true})
  await page.getByRole('row').filter({hasText: '原始申请'}).getByTitle('编辑', {exact: true}).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('记录读取失败', {exact: true})).toBeVisible()
  await expect(drawer.getByRole('button', {name: '保存', exact: true})).toBeDisabled()
  expect(writes).toHaveLength(0)
})

test('新建记录保存后详情显示新记录', async ({page}) => {
  const {writes} = await setupRecords(page)
  await page.getByRole('button', {name: '新建', exact: true}).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByPlaceholder('请输入申请事由').fill('新建申请')
  await drawer.getByPlaceholder('请输入申请金额').fill('12')
  await drawer.getByRole('button', {name: '保存', exact: true}).click()
  await expect(drawer.getByRole('heading', {name: '新建申请', exact: true})).toBeVisible()
  await expect(drawer.getByText('12', {exact: true})).toBeVisible()
  expect(writes).toHaveLength(1)
})

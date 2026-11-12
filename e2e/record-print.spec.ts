import {expect, type Page, test} from '@playwright/test'

const root = '/api/apps/print-test'
const longText = '采购说明需要完整打印，不能被省略号或抽屉滚动区域截断。'.repeat(100)
const form = {
  name: 'purchase', label: '采购申请', displayField: 'title', builtin: false,
  fields: [
    {name: 'title', label: '申请事由', type: 'TEXT'},
    {name: 'amount', label: '金额', type: 'DECIMAL'},
    {name: 'approved', label: '已确认', type: 'BOOL'},
    {name: 'supplier', label: '供应商', type: 'REFERENCE', referenceForm: 'supplier'},
    {name: 'note', label: '备注', type: 'NTEXT'},
  ],
  layout: {
    items: [
      {type: 'FIELD', name: 'title'},
      {type: 'FIELD', name: 'amount'},
      {type: 'FIELD', name: 'approved'},
      {type: 'FIELD', name: 'supplier'},
      {type: 'SECTION', label: '补充说明'},
      {type: 'FIELD', name: 'note', width: 'FULL'},
      {type: 'SUBFORM', formName: 'items', referenceField: 'purchase_id'},
    ]
  },
  viewTabs: [
    {id: 'table', label: '表格', type: 'TABLE', config: {}},
    {id: 'detail', label: '详情', type: 'DETAIL', config: {detailMode: 'SINGLE'}},
  ],
}

async function setup(page: Page, {fail = false, pending}: { fail?: boolean; pending?: Promise<void> } = {}) {
  page.on('pageerror', error => console.error(error.message))
  const records = [
    {
      id: 'first', title: '待打印申请', amount: 0, approved: false, note: longText,
      supplier: {id: 'supplier-1', displayValue: '供应商甲', referenceForm: 'supplier'}
    },
    {id: 'second', title: '其他记录不应打印', amount: 42, approved: true, note: '其他备注'},
  ]
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'print-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: '管理员'}))
    Object.assign(window, {printCalls: 0})
    window.print = () => {
      (window as Window & { printCalls: number }).printCalls++
    }
  })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === `${root}/navigation`) return route.fulfill({
      json: [{
        id: 'top', name: '业务', type: 'GROUP', children: [{
          id: 'purchases', parentId: 'top', type: 'ENTRY', name: '采购申请',
          destination: {type: 'FORM', id: 'purchase'}, children: [],
        }],
      }]
    })
    if (path === `${root}/forms/purchase/records/first`) {
      await pending
      if (fail) return route.fulfill({status: 500, json: {message: '记录读取失败'}})
      return route.fulfill({json: records[0]})
    }
    if (path.endsWith('/query')) return route.fulfill({json: {list: records, total: 2}})
    if (path === `${root}/forms/purchase`) return route.fulfill({json: form})
    if (path === `${root}/forms`) return route.fulfill({json: [form]})
    if (path === `${root}/forms/items`) return route.fulfill({
      json: {
        name: 'items', label: '采购明细', builtin: false, displayField: 'name',
        fields: [{name: 'name', label: '明细名称', type: 'TEXT'}], layout: {items: []}, viewTabs: [],
      }
    })
    if (path === `${root}/forms/items/records`) return route.fulfill({
      json: {
        list: [{id: 'item-1', name: '打印机耗材'}], total: 1,
      }
    })
    if (path === root || path === '/api/apps') {
      const app = {id: 'print-test', name: '打印测试应用', owner: 'admin', enabled: true}
      return route.fulfill({json: path === root ? app : [app]})
    }
    if (path === '/api/notifications/summary') return route.fulfill({
      json: {
        version: '0', unread: 0, byCategory: {}, apps: [],
      }
    })
    if (path.endsWith('/discussions') || path.endsWith('/flow-instances') || path === '/api/notifications') {
      return route.fulfill({json: {list: [], total: 0}})
    }
    return route.fulfill({json: []})
  })
  await page.goto('/#/apps/print-test/purchases')
  await expect(page.getByRole('row').filter({hasText: '待打印申请'})).toBeVisible()
}

for (const dark of [false, true]) test(`详情更多菜单打印当前记录（${dark ? '夜间' : '浅色'}）`, async ({page}) => {
  await setup(page)
  if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.getByRole('row').filter({hasText: '待打印申请'}).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('打印机耗材', {exact: true})).toBeVisible()
  await expect.poll(() => drawer.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0)
  await drawer.evaluate(el => {
    Object.assign(window, {drawerAnimations: 0})
    el.addEventListener('animationstart', event => {
      if (event.target === el) (window as Window & { drawerAnimations: number }).drawerAnimations++
    })
  })
  await drawer.getByRole('button', {name: '更多', exact: true}).click()
  await expect(page.getByRole('menuitem', {name: '表单设计'})).toBeVisible()
  await page.getByRole('menuitem', {name: '打印', exact: true}).click()
  await expect.poll(() => page.evaluate(() => (window as Window & { printCalls: number }).printCalls)).toBe(1)
  const snapshot = page.locator('body > .record-print')
  await expect(snapshot).toBeHidden()
  await page.emulateMedia({media: 'print'})
  await expect(snapshot.getByRole('heading', {name: '待打印申请'})).toBeVisible()
  await expect(snapshot).toContainText(longText)
  await expect(snapshot).toContainText('供应商甲')
  await expect(snapshot).toContainText('打印机耗材')
  await expect(snapshot.getByText('0', {exact: true})).toBeVisible()
  await expect(snapshot.getByText('否', {exact: true})).toBeVisible()
  await expect(snapshot).not.toContainText('其他记录不应打印')
  await expect(page.locator('#root')).toBeHidden()
  await expect(drawer).toBeHidden()
  await expect(snapshot.getByPlaceholder('搜索子表记录')).toBeHidden()
  await expect(snapshot.getByRole('button', {name: '下一页', exact: true})).toBeHidden()
  expect(await snapshot.evaluate(el => getComputedStyle(el).color)).toBe('rgb(0, 0, 0)')
  const note = snapshot.getByText(longText, {exact: true})
  expect(await note.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await snapshot.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(900)
  await snapshot.screenshot({path: `artifacts/record-print-${dark ? 'dark' : 'light'}.png`})
  await page.pdf({path: `artifacts/record-print-${dark ? 'dark' : 'light'}.pdf`, format: 'A4'})
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.emulateMedia({media: 'screen'})
  await expect(snapshot).toHaveCount(0)
  await expect(drawer).toBeVisible()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(await page.evaluate(() => (window as Window & { drawerAnimations: number }).drawerAnimations)).toBe(0)
  await drawer.getByRole('button', {name: '更多', exact: true}).click()
  await page.getByRole('menuitem', {name: '打印', exact: true}).click()
  await expect(snapshot).toHaveCount(1)
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await drawer.getByRole('button', {name: '编辑', exact: true}).click()
  await expect(drawer.getByPlaceholder('请输入申请事由')).toHaveValue('待打印申请')
  await drawer.getByRole('button', {name: '更多', exact: true}).click()
  await expect(page.getByRole('menuitem', {name: '打印', exact: true})).toHaveCount(0)
  await expect(page.getByRole('menuitem', {name: '表单设计'})).toBeVisible()
})

test('独立详情页打印包含折叠分栏，隐藏子表操作', async ({page}) => {
  await setup(page)
  await page.goto('/#/apps/print-test/purchases/view/first')
  await expect(page.getByText('打印机耗材', {exact: true})).toBeVisible()
  await page.getByRole('button', {name: '补充说明'}).click()
  await expect(page.getByText(longText, {exact: true})).toBeHidden()
  await page.getByRole('button', {name: '更多', exact: true}).click()
  await page.getByRole('menuitem', {name: '打印', exact: true}).click()
  await page.emulateMedia({media: 'print'})
  const snapshot = page.locator('.record-print')
  await expect(snapshot.getByText(longText, {exact: true})).toBeVisible()
  await expect(snapshot.getByRole('columnheader', {name: '操作'})).toBeHidden()
  await expect(snapshot.getByRole('button', {name: '新增', exact: true})).toBeHidden()
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.emulateMedia({media: 'screen'})
  await expect(page.getByText(longText, {exact: true})).toBeHidden()
  await expect(page.getByRole('button', {name: '新增', exact: true})).toBeVisible()
})

test('详情视图打印使用当前记录内容', async ({page}) => {
  await setup(page)
  await page.getByRole('tab', {name: '详情', exact: true}).click()
  await expect(page.getByText('打印机耗材', {exact: true})).toBeVisible()
  await page.getByRole('button', {name: '更多', exact: true}).click()
  await page.getByRole('menuitem', {name: '打印', exact: true}).click()
  await page.emulateMedia({media: 'print'})
  await expect(page.locator('.record-print').getByRole('heading', {name: '待打印申请'})).toBeVisible()
  await expect(page.locator('.record-print')).toContainText('打印机耗材')
  await expect(page.getByRole('button', {name: '编辑', exact: true})).toBeHidden()
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
})

test('记录加载失败或尚未加载时不提供打印', async ({page}) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => {
    release = resolve
  })
  await setup(page, {fail: true, pending})
  await page.getByRole('row').filter({hasText: '待打印申请'}).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByRole('button', {name: '更多', exact: true}).click()
  await expect(page.getByRole('menuitem', {name: '打印', exact: true})).toHaveCount(0)
  await page.keyboard.press('Escape')
  release()
  await expect(drawer.getByText('记录读取失败', {exact: true})).toBeVisible()
  await drawer.getByRole('button', {name: '更多', exact: true}).click()
  await expect(page.getByRole('menuitem', {name: '打印', exact: true})).toHaveCount(0)
})

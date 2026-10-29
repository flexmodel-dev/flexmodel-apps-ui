import {test, expect, type Page} from '@playwright/test'

const root = '/api/apps/transfer-test'
const path = `${root}/transfers`
const form = {name: 'orders', label: '订单', builtin: false, fields: [
  {name: 'name', label: '名称', type: 'TEXT', required: true},
], layout: {items: [{type: 'FIELD', name: 'name'}]}, viewTabs: []}
const child = {...form, name: 'items', label: '订单明细', fields: [...form.fields,
  {name: 'order_id', label: '所属订单', type: 'REFERENCE', referenceForm: 'orders', required: true},
], layout: {items: [{type: 'FIELD', name: 'name'}, {type: 'FIELD', name: 'order_id'}]}}
const cell = (value: string) => ({value, display: value, type: 'STRING'})
const suggestions = [
  {sheet: '订单', formName: 'orders', headerRow: 1, keyColumn: 0, columns: [{column: 1, field: 'name', kind: 'VALUE', targetSheet: null}]},
  {sheet: '明细', formName: 'items', headerRow: 1, keyColumn: 0, columns: [
    {column: 1, field: 'name', kind: 'VALUE', targetSheet: null}, {column: 2, field: 'order_id', kind: 'KEY', targetSheet: '订单'},
  ]},
]
const upload = {uploadId: 'upload', expiresAt: Date.now() + 1800000, platform: true, suggestions, sheets: [
  {name: '订单', rowCount: 2, sample: [['键', '名称'], ['O1', '测试订单']].map(row => row.map(cell))},
  {name: '明细', rowCount: 2, sample: [['键', '名称', '所属订单'], ['L1', '明细一', 'O1']].map(row => row.map(cell))},
]}
const tables = [{sheet: '订单', formName: 'orders', count: 1}, {sheet: '明细', formName: 'items', count: 1}]
const ready = {importId: 'import', planHash: 'hash', status: 'READY', errors: [], tables,
  sample: [{sheet: '订单', row: 2, key: 'O1', values: {name: '测试订单'}}]}

async function setup(page: Page, options: {invalid?: boolean; commitFailure?: boolean; ordinary?: boolean; dark?: boolean} = {}) {
  const writes: {kind: string; body: unknown}[] = []
  let previews = 0, commits = 0, loads = 0
  await page.addInitScript(({dark}) => {
    localStorage.setItem('flexmodel-apps.auth.token', 'test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'user', name: '普通用户'}))
    if (dark) localStorage.setItem('theme', 'dark')
  }, {dark: options.dark ?? false})
  await page.route('**/api/**', async route => {
    const {pathname} = new URL(route.request().url())
    if (pathname === `${path}/templates` || pathname === `${path}/exports`) {
      writes.push({kind: pathname.endsWith('/templates') ? 'template' : 'export', body: route.request().postDataJSON()})
      return route.fulfill({contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: Buffer.from('xlsx')})
    }
    if (pathname === `${path}/imports`) {
      expect(route.request().headers()['authorization']).toBe('Bearer test')
      expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary=')
      return route.fulfill({json: options.ordinary ? {...upload, platform: false, suggestions: []} : upload})
    }
    if (pathname.endsWith('/preview')) {
      writes.push({kind: 'preview', body: route.request().postDataJSON()})
      previews++
      return route.fulfill({json: options.invalid && previews === 1 ? {...ready, status: 'INVALID', errors: [
        {sheet: '明细', row: 2, field: 'order_id', value: 'O999', message: '包内引用记录不存在'},
      ]} : ready})
    }
    if (pathname.endsWith('/commit')) {
      commits++; writes.push({kind: 'commit', body: route.request().postDataJSON()})
      if (options.commitFailure && commits === 1) return route.fulfill({status: 503, json: {message: '网络暂时不可用，请重试'}})
      return route.fulfill({json: {importId: 'import', status: 'COMMITTED', total: 2, tables}})
    }
    if (pathname === `${root}/forms/orders/records`) {
      loads++
      return route.fulfill({json: {list: [{id: 'one', name: '原始订单'}], total: 1}})
    }
    const json = pathname === root ? {id: 'transfer-test', name: '导入导出回归', primaryColor: 'blue', enabled: true}
      : pathname === `${root}/menus` ? [{id: 'group', name: '业务', type: 'GROUP', children: [{id: 'orders', name: '订单', type: 'ITEM', target: {type: 'FORM', id: 'orders'}, children: []}]}]
        : pathname === `${root}/forms` || pathname === `${path}/forms` ? [form, child]
          : pathname === `${root}/forms/orders` ? form
            : pathname === '/api/notifications' ? {list: [], total: 0}
              : pathname === '/api/notifications/summary' ? {version: '0', unread: 0, byCategory: {}, apps: []} : []
    return route.fulfill({json})
  })
  await page.goto('/#/apps/transfer-test/orders')
  await expect(page.getByText('原始订单', {exact: true})).toBeVisible()
  return {writes, loads: () => loads}
}
async function uploadFile(page: Page) {
  await page.getByRole('button', {name: '导入', exact: true}).click()
  await page.getByLabel('上传 Excel 文件').setInputFiles({name: 'data.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('xlsx')})
}

test('模板下载、预览错误修正和提交失败重试保持相同计划', async ({page}) => {
  const state = await setup(page, {invalid: true, commitFailure: true})
  await page.getByRole('button', {name: '导入', exact: true}).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', {name: '下载多表模板'}).click()
  expect((await download).suggestedFilename()).toContain('模板.xlsx')
  await page.getByLabel('上传 Excel 文件').setInputFiles({name: 'data.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('xlsx')})
  await page.getByRole('button', {name: '配置字段'}).click()
  await page.getByRole('button', {name: '校验并预览'}).click()
  await expect(page.getByRole('button', {name: '确认导入'})).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('明细 第 2 行')
  await page.screenshot({path: 'test-results/transfers-light.png'})
  await page.getByRole('button', {name: '上一步'}).click()
  await page.getByRole('button', {name: '校验并预览'}).click()
  await page.getByRole('button', {name: '确认导入'}).click()
  await expect(page.getByRole('alert')).toContainText('网络暂时不可用')
  await page.getByRole('button', {name: '确认导入'}).click()
  await expect(page.getByRole('status')).toContainText('共新增 2 条记录')
  expect(state.writes.filter(item => item.kind === 'commit').map(item => item.body)).toEqual([{planHash: 'hash'}, {planHash: 'hash'}])
  expect(state.loads()).toBeGreaterThan(1)
})

test('普通 Excel 手动选择表单、键列、字段和包内引用', async ({page}) => {
  const state = await setup(page, {ordinary: true})
  await uploadFile(page)
  for (const [sheet, target] of [['订单', '订单'], ['明细', '订单明细']]) {
    await page.getByRole('combobox', {name: `${sheet} 目标表单`}).click()
    await page.getByRole('option', {name: target, exact: true}).click()
  }
  await page.getByRole('button', {name: '配置字段'}).click()
  for (const sheet of ['订单', '明细']) {
    await page.getByRole('combobox', {name: `${sheet} 包内键列`}).click()
    await page.getByRole('option', {name: '1. 键', exact: true}).click()
    await page.getByRole('combobox', {name: `${sheet} 第2列字段`}).click()
    await page.getByRole('option', {name: '名称 *', exact: true}).click()
  }
  await page.getByRole('combobox', {name: '明细 第3列字段'}).click()
  await page.getByRole('option', {name: '所属订单（包内键）', exact: true}).click()
  await page.getByRole('button', {name: '校验并预览'}).click()
  expect(state.writes.find(item => item.kind === 'preview')?.body).toEqual({sheets: suggestions})
})

test('筛选导出、勾选导出和多表选择传递正确范围', async ({page}) => {
  const state = await setup(page)
  await page.getByRole('button', {name: '导出', exact: true}).first().click()
  await page.getByLabel('订单明细', {exact: true}).check()
  await page.getByLabel('补齐引用的业务记录').check()
  let download = page.waitForEvent('download')
  await page.getByRole('button', {name: '导出 Excel'}).click(); await download
  expect(state.writes.find(item => item.kind === 'export')?.body).toMatchObject({includeSubforms: true, includeReferences: true,
    tables: [{formName: 'orders', scope: 'FILTERED'}, {formName: 'items', scope: 'ALL'}]})
  await page.getByRole('button', {name: '关闭', exact: true}).click()
  await page.getByRole('row').filter({hasText: '原始订单'}).getByRole('checkbox').check()
  await page.getByRole('button', {name: '导出', exact: true}).last().click()
  await expect(page.getByRole('combobox', {name: '导出范围'})).toContainText('勾选的 1 条记录')
  download = page.waitForEvent('download')
  await page.getByRole('button', {name: '导出 Excel'}).click(); await download
  expect(state.writes.filter(item => item.kind === 'export').at(-1)?.body).toMatchObject({tables: [{formName: 'orders', scope: 'IDS', recordIds: ['one']}]})
})

test('夜间和窄屏向导保持可操作且无页面异常', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await setup(page, {dark: true})
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await uploadFile(page)
  await page.getByRole('button', {name: '配置字段'}).click()
  await page.screenshot({path: 'test-results/transfers-dark.png'})
  await page.setViewportSize({width: 390, height: 844})
  await page.screenshot({path: 'test-results/transfers-mobile.png'})
  await expect(page.getByRole('button', {name: '校验并预览'})).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

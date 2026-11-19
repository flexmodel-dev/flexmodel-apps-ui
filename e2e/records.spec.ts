import {expect, type Page, test} from '@playwright/test'
import {readFileSync} from 'node:fs'
import type {AppFormViewSort} from '../src/services/appForms'
import type {RecordDiscussionItem} from '../src/services/recordDiscussions'

// 验证滚动条实际占位；Chromium 无头模式默认隐藏原生滚动条。
test.use({launchOptions: {ignoreDefaultArgs: ['--hide-scrollbars']}})

const root = '/api/apps/record-edit'
const recordsPath = `${root}/forms/purchase/records`
const viewPath = `${root}/forms/purchase/views/all/query`
const listUrl = '/#/apps/record-edit/purchases'
const app = {id: 'record-edit', name: '记录编辑回归', enabled: true, primaryColor: 'blue'}
const navigation = [{
  id: 'records', type: 'GROUP', name: '业务', children: [{
    id: 'purchases', parentId: 'records', type: 'ENTRY', name: '采购申请',
    destination: {type: 'FORM', id: 'purchase'}, children: [],
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
  layout: {items: []},
  viewTabs: [{
    id: 'all',
    label: '全部',
    type: 'TABLE',
    displayFields: [],
    config: {},
    sort: null as AppFormViewSort | null
  }],
}

async function setupRecords(page: Page, {
  pending,
  failLoad = false,
  failSave = false,
  locked = false,
  listForm = form
}: {
  pending?: Promise<void>; failLoad?: boolean; failSave?: boolean; locked?: boolean; listForm?: typeof form
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
    if (pathname === `${root}/flow-instances`) {
      const list = locked ? [{id: 'approval', status: 'RUNNING', createdAt: '2026-11-19'}] : []
      return route.fulfill({json: {list, total: list.length}})
    }
    if (pathname.endsWith('/approvals')) return route.fulfill({json: []})
    if (pathname.startsWith(`${recordsPath}/`)) {
      const id = pathname.slice(recordsPath.length + 1)
      if (method === 'PUT') {
        const payload = route.request().postDataJSON()
        writes.push(payload)
        if (failSave && writes.length === 1) {
          return route.fulfill({status: 500, json: {message: '记录保存失败'}})
        }
        records[id] = {...records[id], ...payload}
        if ('title' in payload) records[id].title = payload.title.trim()
        if ('supplier' in payload) {
          records[id].supplier = payload.supplier ? {id: payload.supplier, displayValue: '供应商甲'} : null
        }
      } else {
        await pending
        if (failLoad) return route.fulfill({status: 500, json: {message: '记录读取失败'}})
      }
      return route.fulfill({json: records[id]})
    }
    if (pathname === viewPath) {
      const list = Object.values(records)
      const sort = listForm.viewTabs[0].sort
      if (sort?.field === 'amount') {
        list.sort((a, b) => (Number(a.amount) - Number(b.amount)) * (sort.order === 'ASC' ? 1 : -1))
      }
      return route.fulfill({json: {list, total: list.length}})
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
      return route.fulfill({json: {...form, name: 'supplier', label: '供应商', fields: form.fields.slice(0, 1)}})
    }
    const json = pathname === root ? app
      : pathname === '/api/apps' ? [app]
        : pathname === `${root}/navigation` ? navigation
          : pathname === `${root}/forms/purchase` ? listForm
            : pathname === `${root}/forms` ? [listForm]
              : pathname === '/api/notifications/summary'
                ? {version: '0', unread: 0, byCategory: {}, apps: []}
                : []
    return route.fulfill({json})
  })
  await page.goto(listUrl)
  await expect(page.getByRole('row').filter({hasText: '原始申请'})).toBeVisible()
  return {records, writes}
}

async function openSelectedRecordForEdit(page: Page, title: string) {
  await page.getByRole('row').filter({hasText: title}).getByRole('checkbox').first().check()
  await page.getByRole('button', {name: '编辑', exact: true}).click()
}

for (const dark of [false, true]) test(`子表新增输入不被父列表迟到响应清空（${dark ? '夜间' : '浅色'}）`, async ({page}) => {
  await setupRecords(page, {
    listForm: {
      ...form, layout: {
        items: [
          {type: 'FIELD', name: 'title'},
          {type: 'SUBFORM', formName: 'purchase_item', referenceField: 'purchase_id'},
        ]
      } as typeof form.layout
    }
  })
  if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))
  const childPath = `${root}/forms/purchase_item/records`
  const childForm = {
    name: 'purchase_item', label: '采购明细', displayField: 'name', builtin: false,
    fields: [
      {name: 'name', label: '明细名称', type: 'TEXT', required: true},
      {name: 'quantity', label: '数量', type: 'NUMBER', config: {defaultValue: 2}},
      {name: 'purchase_id', label: '采购单', type: 'TEXT'},
    ],
    layout: {items: []}, viewTabs: [],
  }
  let release!: () => void
  const pending = new Promise<void>(resolve => {
    release = resolve
  })
  let listStarted = false
  let listFinished = false
  const writes: Record<string, unknown>[] = []
  await page.route(`**${root}/forms/purchase_item**`, async route => {
    const url = new URL(route.request().url())
    if (url.pathname === `${root}/forms/purchase_item`) return route.fulfill({json: childForm})
    if (url.pathname === childPath && route.request().method() === 'POST') {
      expect(url.searchParams.get('mainFormName')).toBe('purchase')
      expect(url.searchParams.get('mainRecordId')).toBe('first')
      expect(url.searchParams.get('referenceField')).toBe('purchase_id')
      const payload = route.request().postDataJSON()
      writes.push(payload)
      return route.fulfill({status: 201, json: {...payload, id: 'item-created'}})
    }
    listStarted = true
    await pending
    await route.fulfill({json: {list: [{id: 'item-old', name: '原有明细', quantity: 1}], total: 1}})
    listFinished = true
  })
  await openSelectedRecordForEdit(page, '原始申请')
  const parent = page.getByRole('dialog', {name: '编辑采购申请', includeHidden: true})
  await expect(parent.getByPlaceholder('请输入申请事由')).toHaveValue('原始申请')
  await expect.poll(() => listStarted).toBe(true)
  await parent.getByRole('button', {name: '新增', exact: true}).click()
  const child = page.getByRole('dialog', {name: '新建采购明细'})
  const name = child.getByPlaceholder('请输入明细名称')
  const quantity = child.getByPlaceholder('请输入数量')
  try {
    await expect(quantity).toHaveValue('2')
    await name.fill('新采购的键盘')
    await quantity.fill('0')
  } finally {
    release()
  }
  await expect.poll(() => listFinished).toBe(true)
  await expect(parent.getByText('原有明细', {exact: true})).toBeVisible()
  await expect(name).toHaveValue('新采购的键盘')
  await expect(quantity).toHaveValue('0')
  await child.getByRole('button', {name: '保存', exact: true}).click()
  await expect(child).not.toBeVisible()
  expect(writes).toEqual([{name: '新采购的键盘', quantity: 0}])
  await parent.getByRole('button', {name: '新增', exact: true}).click()
  await expect(name).toHaveValue('')
  await expect(quantity).toHaveValue('2')
})

for (const dark of [false, true]) test(`网格线和主显列在横向滚动与单元格编辑时可见（${dark ? '夜间' : '浅色'}）`, async ({page}) => {
  await setupRecords(page)
  if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))
  const scroll = page.locator('.record-list-scroll')
  const row = scroll.locator('tbody tr').first()
  const primary = row.locator('.record-list-primary')
  const normalRowHeight = (await row.boundingBox())!.height
  expect(normalRowHeight).toBeLessThanOrEqual(38)
  expect((await scroll.locator('thead tr').boundingBox())!.height).toBeLessThanOrEqual(38)
  const before = {
    primary: (await primary.boundingBox())!,
    middle: (await row.locator('td').nth(2).boundingBox())!}
  expect(await scroll.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
  expect(await scroll.evaluate(el => el.getBoundingClientRect().height - el.clientHeight)).toBeGreaterThan(0)
  await scroll.evaluate(el => {el.scrollLeft = el.scrollWidth})
  await expect.poll(() => scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
  expect((await primary.boundingBox())!.x).toBeCloseTo(before.primary.x, 0)
  expect((await row.locator('td').nth(2).boundingBox())!.x).toBeLessThan(before.middle.x)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await row.getByRole('checkbox').check()
  await expect(row).toHaveAttribute('data-selected', 'true')
  await page.mouse.move(0, 0)
  expect(await primary.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(
    await row.locator('td').nth(2).evaluate(el => getComputedStyle(el).backgroundColor))
  for (const cell of [scroll.locator('thead th').nth(2), row.locator('td').nth(2)]) {
    await expect(cell).toHaveCSS('border-right-width', '1px')
    await expect(cell).toHaveCSS('border-bottom-width', '1px')
  }
  await expect(scroll.getByRole('columnheader', {name: '操作', exact: true})).toHaveCount(0)
  const pencil = primary.getByRole('button', {name: '编辑单元格：申请事由', exact: true})
  await expect(pencil).toHaveCSS('opacity', '0')
  await primary.hover()
  await expect(pencil).toHaveCSS('opacity', '1')
  await expect(row.getByRole('button', {name: '编辑单元格：申请金额', exact: true})).toHaveCSS('opacity', '0')
  await page.screenshot({path: `artifacts/record-grid-hover-${dark ? 'dark' : 'light'}.png`, animations: 'disabled'})
  await pencil.click()
  await expect(row.getByPlaceholder('请输入申请事由')).toHaveValue('原始申请')
  expect((await row.boundingBox())!.height).toBeLessThanOrEqual(normalRowHeight + 2)
  await expect(row.locator('td').nth(2)).toHaveCSS('border-right-width', '1px')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.screenshot({path: `artifacts/record-cell-edit-${dark ? 'dark' : 'light'}.png`, animations: 'disabled'})
})

test('拖动表头竖线和使用方向键可以单独调整列宽', async ({page}) => {
  await setupRecords(page)
  const head = page.locator('thead th[data-field="amount"]')
  const neighbor = page.locator('thead th[data-field="approved"]')
  const handle = head.getByRole('separator', {name: '调整申请金额列宽'})
  const before = (await head.boundingBox())!.width
  const neighborWidth = (await neighbor.boundingBox())!.width
  const grip = (await handle.boundingBox())!
  const x = grip.x + grip.width / 2
  const y = grip.y + grip.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 72, y + 15, {steps: 6})
  await page.mouse.up()
  expect((await head.boundingBox())!.width).toBeCloseTo(before + 72, 0)
  expect((await neighbor.boundingBox())!.width).toBeCloseTo(neighborWidth, 0)
  await expect(head).toHaveAttribute('aria-sort', 'none')
  const body = page.locator('tbody tr').first().locator('td[data-field="amount"]')
  expect((await body.boundingBox())!.width).toBeCloseTo(before + 72, 0)
  await handle.focus()
  await page.keyboard.press('ArrowLeft')
  expect((await body.boundingBox())!.width).toBeCloseTo(before + 56, 0)
})

test('字段较少时表格填满内容区且无需横向滚动', async ({page}) => {
  await setupRecords(page, {listForm: {...form, fields: form.fields.slice(0, 2)}})
  const scroll = page.locator('.record-list-scroll')
  expect(await scroll.evaluate(el => el.scrollWidth === el.clientWidth)).toBe(true)
  const selection = (await scroll.locator('tbody .record-list-selection').first().boundingBox())!
  const primary = (await scroll.locator('tbody .record-list-primary').first().boundingBox())!
  expect(selection.width).toBe(40)
  expect(primary.x).toBeCloseTo(selection.x + selection.width, 0)
})

test('表头排序箭头位于文字右侧，三次点击取消排序', async ({page}) => {
  await setupRecords(page)
  const header = page.locator('thead th').filter({hasText: '申请事由'})
  const sortRequest = (order?: 'ASC' | 'DESC') => page.waitForRequest(request => {
    if (new URL(request.url()).pathname !== viewPath) return false
    const query = request.postDataJSON()
    return order
      ? query.sortField === 'title' && query.sortOrder === order
      : !query.sortField && !query.sortOrder
  })

  let next = sortRequest('ASC')
  await header.click()
  await next
  await expect(header.locator('svg.lucide-arrow-down')).toBeVisible()

  const text = await header.evaluate(el => {
    const range = document.createRange()
    range.selectNodeContents(el.querySelector('span')!.firstChild!)
    const rect = range.getBoundingClientRect()
    return {right: rect.right, top: rect.top, bottom: rect.bottom}
  })
  const icon = (await header.locator('svg').boundingBox())!
  expect(icon.x).toBeGreaterThan(text.right)
  expect(icon.y).toBeLessThan(text.bottom)
  expect(icon.y + icon.height).toBeGreaterThan(text.top)

  next = sortRequest('DESC')
  await header.click()
  await next
  await expect(header.locator('svg.lucide-arrow-up')).toBeVisible()

  next = sortRequest()
  await header.click()
  await next
  await expect(header.locator('svg')).toHaveCount(0)
})

test('勾选后默认以居中对话框编辑，等待记录加载并回填全部字段', async ({page}) => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  await setupRecords(page, {pending})
  await openSelectedRecordForEdit(page, '原始申请')
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByRole('heading', {name: '编辑采购申请'})).toBeVisible()
  try {
    await expect(drawer).toHaveCSS('animation-name', 'dialog-in')
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
  await page.getByRole('button', {name: '清空选择'}).click()
  await openSelectedRecordForEdit(page, '另一条申请')
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

test('通过更多菜单切换详情的抽屉、对话框和全屏，并保留未保存的修改', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'})
  const {writes} = await setupRecords(page)
  const {width, height} = page.viewportSize()!
  const openingFrames = await page.evaluateHandle(() => {
    const frames: { animation: string; x: number; y: number; right: number }[] = []
    document.addEventListener('animationstart', event => {
      const panel = event.target
      if (!(panel instanceof HTMLElement) || panel.getAttribute('role') !== 'dialog'
        || panel.getAttribute('data-state') !== 'open') return
      const {x, y, width, height, right} = panel.getBoundingClientRect()
      frames.push({animation: event.animationName, x: Math.round(x + width / 2), y: Math.round(y + height / 2), right})
    })
    return frames
  })
  const centerEntries = async () => (await openingFrames.jsonValue()).filter(frame =>
    frame.animation === 'dialog-in' && frame.x === width / 2 && frame.y === height / 2).length
  const rightSlides = async () => (await openingFrames.jsonValue()).filter(frame => frame.animation === 'enter' && frame.right > width + 1).length
  await page.getByRole('row').getByRole('button', {name: '原始申请', exact: true}).click()
  await expect.poll(centerEntries).toBe(1)
  const detail = page.getByRole('dialog')
  const more = detail.getByRole('button', {name: '更多'})
  const modes = page.getByRole('menu').getByRole('group', {name: '展示方式'})
  const mode = (name: string) => modes.getByRole('menuitemradio', {name})
  const switchTo = async (current: string, next: string) => {
    await more.click()
    await expect(mode(current)).toBeChecked()
    await mode(next).click()
    await expect(modes).toBeHidden()
  }
  const title = detail.getByPlaceholder('请输入申请事由')
  const aside = detail.getByRole('complementary', {name: '记录动态'})
  const isCentered = async () => {
    const box = await detail.boundingBox()
    const viewport = page.viewportSize()!
    return !!box && box.x > 0 && box.y > 0
      && Math.abs(box.x * 2 + box.width - viewport.width) < 1
      && Math.abs(box.y * 2 + box.height - viewport.height) < 1
  }

  await expect(modes).toBeHidden()
  await detail.getByRole('button', {name: '展开记录动态'}).click()
  await more.click()
  await expect(mode('对话框')).toBeChecked()
  await mode('对话框').press('ArrowLeft')
  await expect(mode('抽屉')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(modes).toBeHidden()
  await expect.poll(rightSlides).toBe(1)
  await expect(aside).toBeVisible()
  await detail.getByRole('button', {name: '编辑', exact: true}).click()
  await title.fill('切换时保留的申请')
  await switchTo('抽屉', '对话框')
  await expect.poll(centerEntries).toBe(2)
  await expect.poll(isCentered).toBe(true)
  await expect(title).toHaveValue('切换时保留的申请')

  await switchTo('对话框', '全屏')
  await expect.poll(() => detail.boundingBox()).toEqual({x: 0, y: 0, width, height})
  await detail.getByRole('heading', {name: '编辑采购申请', exact: true}).locator('..')
    .locator('button:has(> .lucide-x)').click()
  const discard = page.getByRole('dialog', {name: '放弃未保存的修改'})
  await discard.getByRole('button', {name: '继续编辑'}).click()
  await expect(title).toHaveValue('切换时保留的申请')

  await switchTo('全屏', '抽屉')
  await expect.poll(rightSlides).toBe(2)
  await expect.poll(async () => {
    const box = await detail.boundingBox()
    return !!box && box.x > 0 && box.y === 0 && box.height === height && box.x + box.width === width
  }).toBe(true)
  await page.setViewportSize({width: 390, height: 844})
  await page.emulateMedia({reducedMotion: 'reduce'})
  await more.click()
  await expect(mode('抽屉')).toBeChecked()
  await expect(modes).toHaveText('')
  const positions = await modes.getByRole('menuitemradio').evaluateAll(items => items.map(item => {
    const {top, left} = item.getBoundingClientRect()
    return {top, left}
  }))
  expect(positions).toHaveLength(3)
  expect(new Set(positions.map(({top}) => top)).size).toBe(1)
  expect(positions[0].left).toBeLessThan(positions[1].left)
  expect(positions[1].left).toBeLessThan(positions[2].left)
  await mode('对话框').click()
  await expect.poll(isCentered).toBe(true)
  await expect(detail).toHaveCSS('animation-name', 'none')
  expect(writes).toEqual([])
  await detail.getByRole('button', {name: '保存', exact: true}).click()
  await expect(page.getByRole('dialog', {name: '切换时保留的申请', exact: true})).toBeVisible()
  await expect(aside).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({title: '切换时保留的申请'})
})

for (const mode of ['对话框', '全屏']) test(`关闭${mode}时不触发抽屉入场动画`, async ({page}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'})
  await setupRecords(page)
  await page.getByRole('row').getByRole('button', {name: '原始申请', exact: true}).click()
  const detail = page.getByRole('dialog', {name: '原始申请', exact: true})
  await detail.getByRole('button', {name: '更多'}).click()
  await page.getByRole('menuitemradio', {name: mode}).click()
  await expect(page.getByRole('menu')).toBeHidden()
  const closingAnimations = await detail.evaluateHandle(panel => {
    const animations: string[] = []
    panel.addEventListener('animationstart', event => {
      if (event.target === panel && event instanceof AnimationEvent && panel.getAttribute('data-state') === 'closed') {
        animations.push(event.animationName)
      }
    })
    return animations
  })

  if (mode === '全屏') await page.keyboard.press('Escape')
  else await detail.getByRole('heading', {name: '原始申请', exact: true}).locator('..')
    .locator('button:has(> .lucide-x)').click()
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  expect(await closingAnimations.jsonValue()).toEqual([])
  await page.getByRole('row').getByRole('button', {name: '另一条申请', exact: true}).click()
  await expect(page.getByRole('dialog', {name: '另一条申请', exact: true}))
    .toHaveCSS('animation-name', mode === '全屏' ? 'fullscreen-in' : 'dialog-in')
})

test('记录加载失败时显示错误并禁止保存空表单', async ({page}) => {
  const {writes} = await setupRecords(page, {failLoad: true})
  await openSelectedRecordForEdit(page, '原始申请')
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('记录读取失败', {exact: true})).toBeVisible()
  await expect(drawer.getByRole('button', {name: '保存', exact: true})).toBeDisabled()
  expect(writes).toHaveLength(0)
})

test('单元格离开时自动保存，校验和失败重试只提交当前字段', async ({page}) => {
  const {writes} = await setupRecords(page, {
    failSave: true, listForm: {
      ...form,
      fields: form.fields.map(field => field.name === 'optional' ? {...field, config: {updatable: false}} : field),
    }
  })
  const [first, second] = [page.locator('tbody tr').nth(0), page.locator('tbody tr').nth(1)]
  const titleCell = first.locator('td[data-field="title"]')
  const pencil = titleCell.getByRole('button', {name: '编辑单元格：申请事由', exact: true})
  const title = first.getByPlaceholder('请输入申请事由')
  const amount = first.getByPlaceholder('请输入申请金额')

  await titleCell.hover()
  await pencil.click()
  await expect(title).toBeFocused()
  await expect(amount).toHaveCount(0)
  await expect(first.getByRole('button', {name: '编辑单元格：补充信息'})).toHaveCount(0)
  await expect(second.getByPlaceholder('请输入申请事由')).toHaveCount(0)
  await expect(page.getByRole('button', {name: '保存', exact: true})).toHaveCount(0)
  await title.fill('取消的草稿')
  await title.press('Escape')
  await expect(first.getByRole('button', {name: '原始申请', exact: true})).toBeVisible()
  expect(writes).toEqual([])

  await titleCell.hover()
  await pencil.click()
  await title.fill('')
  await title.press('Enter')
  await expect(page.getByText('申请事由不能为空')).toBeVisible()
  expect(writes).toEqual([])
  await title.fill('  行内更新  ')
  await first.locator('td[data-field="amount"]').click()
  await expect(page.getByText('记录保存失败', {exact: true})).toBeVisible()
  await expect(title).toHaveValue('  行内更新  ')
  await title.press('Tab')
  await expect(first.getByRole('button', {name: '行内更新', exact: true})).toBeVisible()
  const noteCell = first.locator('td[data-field="note"]')
  await noteCell.hover()
  await noteCell.getByRole('button', {name: '编辑单元格：备注', exact: true}).click()
  const note = page.getByRole('dialog', {name: '编辑备注'}).locator('textarea')
  await expect(note).toBeFocused()
  await note.fill('新增备注')
  await first.locator('td[data-field="amount"]').click()
  await expect(first.getByText('新增备注', {exact: true})).toBeVisible()
  const category = first.locator('td[data-field="category"]')
  await category.hover()
  await category.getByRole('button', {name: '选择选项：分类'}).click()
  await expect(page.getByRole('listbox')).toBeVisible()
  expect(writes).toHaveLength(3)
  await page.getByRole('option', {name: '无', exact: true}).click()
  await expect(category.getByRole('combobox')).toHaveCount(0)
  expect(writes).toEqual([{title: '  行内更新  '}, {title: '  行内更新  '}, {note: '新增备注'}, {category: null}])
  await expect(second).toContainText('另一条申请')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('引用与日期图标一次点击就打开各自的选择器', async ({page}) => {
  await page.addInitScript(() => {
    const showPicker = HTMLInputElement.prototype.showPicker
    HTMLInputElement.prototype.showPicker = function () {
      showPicker.call(this)
      this.dataset.pickerOpened = 'true'
    }
  })
  const {writes} = await setupRecords(page, {
    listForm: {
      ...form,
      fields: [...form.fields, {name: 'start_date', label: '开始日期', type: 'DATE'}],
    }
  })
  const row = page.locator('tbody tr').nth(1)
  const supplier = row.locator('td[data-field="supplier"]')
  const pickSupplier = supplier.getByRole('button', {name: '选择引用：供应商'})
  await expect(pickSupplier.locator('svg.lucide-square-arrow-out-up-right')).toHaveCount(1)
  const dialog = page.getByRole('dialog', {name: '请选择供应商'})
  await supplier.hover()
  await pickSupplier.click()
  await expect(dialog.getByRole('grid')).toBeVisible()
  await dialog.getByText('供应商甲', {exact: true}).click()
  await dialog.getByRole('button', {name: '取消', exact: true}).click()
  await expect(dialog).toBeHidden()
  expect(writes).toEqual([])

  await supplier.hover()
  await pickSupplier.click()
  await dialog.getByText('供应商甲', {exact: true}).click()
  await dialog.getByRole('button', {name: '确定', exact: true}).click()
  await expect(supplier.getByText('供应商甲', {exact: true})).toBeVisible()

  const date = row.locator('td[data-field="start_date"]')
  await date.hover()
  await date.getByRole('button', {name: '选择日期：开始日期'}).click()
  const input = date.locator('input[type="date"]')
  await expect(input).toHaveAttribute('data-picker-opened', 'true')
  await input.fill('2026-11-26')
  await expect(input).toHaveValue('2026-11-26')
  await row.locator('td[data-field="amount"]').click()
  await expect(date).toHaveText('2026-11-26')
  expect(writes).toEqual([{supplier: 'supplier-1'}, {start_date: '2026-11-26'}])
})

test('审批中的记录不能行内保存', async ({page}) => {
  const {writes} = await setupRecords(page, {locked: true})
  const row = page.locator('tbody tr').first()
  await row.locator('td[data-field="title"]').hover()
  await row.getByRole('button', {name: '编辑单元格：申请事由', exact: true}).click()
  const locked = row.getByText('审批中，已锁定')
  await expect(locked).toBeVisible()
  await expect(row.getByPlaceholder('请输入申请事由')).toHaveCount(0)
  await locked.press('Escape')
  expect(writes).toEqual([])
})

for (const sorted of [false, true]) test(`保存单元格后${sorted ? '按显式排序刷新' : '保持无显式排序的记录位置'}`, async ({page}) => {
  const {writes} = await setupRecords(page, {
    listForm: {
      ...form,
      viewTabs: form.viewTabs.map(view => ({...view, sort: sorted ? {field: 'amount', order: 'ASC'} : null})),
    }
  })
  const rows = page.locator('tbody tr')
  const amount = rows.nth(1).locator('td[data-field="amount"]')
  await expect(page.locator('thead th[data-field="amount"]')).toHaveAttribute('aria-sort', sorted ? 'ascending' : 'none')
  await amount.hover()
  await amount.getByRole('button', {name: '编辑单元格：申请金额'}).click()
  await amount.getByRole('spinbutton').fill('-18.5')
  const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === viewPath && response.ok())
  await amount.getByRole('spinbutton').press('Enter')
  await refreshed
  await expect(rows.nth(sorted ? 0 : 1)).toContainText('-18.5')
  await expect(rows.first()).toContainText(sorted ? '另一条申请' : '原始申请')
  expect(writes).toEqual([{amount: -18.5}])
})

for (const dark of [false, true]) test(`讨论行内回复与本人删除菜单（${dark ? '夜间' : '浅色'}）`, async ({page}) => {
  await setupRecords(page)
  if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))
  const discussionPath = `${recordsPath}/first/discussions`
  const makeItem = (id: string, authorId: string, authorName: string, content: string): RecordDiscussionItem => ({
    id, authorId, authorName, content, parentId: null, createdAt: '2026-10-29T10:00:00',
    canDelete: authorId === 'admin', replyCount: 0, replies: [],
  })
  let roots = [makeItem('mine', 'admin', 'Admin', '我的评论'), makeItem('other', 'member', '李娜', '同事的评论'),
    makeItem('no-avatar', 'guest', '王五', '没有头像的评论'), makeItem('broken-avatar', 'broken', '赵六', '头像失效的评论')]
  const nested = {...makeItem('reply', 'member', '李娜', '同事的回复'), parentId: 'mine'}
  roots[0].replies = [nested]
  roots[0].replyCount = 1
  let failSend = true
  const writes: Record<string, unknown>[] = []
  const avatarRequests: string[] = []
  await page.route('**/api/test-avatars/**', route => {
    expect(route.request().headers().authorization).toBe('Bearer record-edit-test')
    avatarRequests.push(route.request().url())
    if (route.request().url().endsWith('broken.png')) return route.fulfill({status: 404})
    // @ts-ignore
    return route.fulfill({
      contentType: 'image/png',
      body: readFileSync(new URL('../public/favicon.png', import.meta.url))
    })
  })
  await page.route(`**${root}/directory`, route => route.fulfill({
    json: {
      members: [{id: 'admin', name: 'Admin', avatar: '/api/test-avatars/admin.png'},
        {id: 'member', name: '李娜', avatar: '/api/test-avatars/member.png'},
        {id: 'guest', name: '王五'}, {id: 'broken', name: '赵六', avatar: '/api/test-avatars/broken.png'}],
      organizations: [],
    }
  }))
  await page.route(`**${discussionPath}**`, async route => {
    const method = route.request().method()
    if (method === 'DELETE') {
      expect(route.request().url()).toContain('/mine')
      roots = roots.filter(item => item.id !== 'mine')
      return route.fulfill({status: 204})
    }
    if (method === 'POST') {
      const payload = route.request().postDataJSON()
      if (failSend) {
        failSend = false
        return route.fulfill({status: 500, json: {message: '发送失败，请重试'}})
      }
      writes.push(payload)
      const created = {
        ...makeItem('new', 'admin', 'Admin', payload.content), parentId: payload.parentId,
        replyToName: '李娜'
      }
      roots[0].replies.push(created)
      roots[0].replyCount++
      return route.fulfill({status: 201, json: created})
    }
    return route.fulfill({
      json: {
        list: roots,
        total: roots.reduce((n, item) => n + 1 + item.replies.length, 0),
        rootTotal: roots.length
      }
    })
  })
  await page.getByRole('row').filter({hasText: '原始申请'}).click()
  await expect(page.getByRole('button', {name: '展开记录动态'})).toHaveText('5条讨论')
  await page.getByRole('button', {name: '展开记录动态'}).click()
  const aside = page.getByRole('complementary', {name: '记录动态'})
  await aside.getByRole('tab', {name: /讨论/}).click()
  const mine = aside.locator('article').filter({hasText: '我的评论'})
  const other = aside.locator('article').filter({hasText: '同事的评论'})
  const reply = aside.locator('article').filter({hasText: '同事的回复'})
  for (const item of [mine, other, reply]) {
    await expect(item.locator('img')).toHaveJSProperty('naturalWidth', 100)
  }
  await expect(aside.locator('article').filter({hasText: '没有头像的评论'}).getByRole('img', {name: '王五的头像'})).toHaveText('王')
  await expect.poll(() => avatarRequests.some(url => url.endsWith('broken.png'))).toBe(true)
  const brokenAvatar = aside.locator('article').filter({hasText: '头像失效的评论'}).getByRole('img', {name: '赵六的头像'})
  await expect(brokenAvatar).toHaveText('赵')
  await expect(brokenAvatar.locator('img')).toHaveCount(0)
  await expect(other.getByRole('button', {name: '更多'})).toHaveCount(0)
  await expect(reply.getByRole('button', {name: '更多'})).toHaveCount(0)
  await expect(aside.getByRole('menuitem', {name: '删除评论'})).toHaveCount(0)
  const mainDraft = aside.getByRole('textbox', {name: '添加讨论'})
  await mainDraft.fill('保留主评论草稿')
  await reply.getByRole('button', {name: '回复', exact: true}).click()
  const composer = reply.getByRole('textbox', {name: '回复 李娜', exact: true})
  await expect(composer).toBeFocused()
  await expect(composer).toHaveAttribute('placeholder', '回复 李娜 的讨论')
  await expect(reply.getByRole('button', {name: '取消回复'})).toHaveCount(0)
  await expect(reply.getByText('回复 李娜', {exact: true})).toHaveCount(0)
  await composer.fill('回复的草稿 @李')
  await expect(reply.getByRole('button').filter({hasText: '李娜'})).toBeVisible()
  await composer.press('Enter')
  await expect(composer).toHaveValue('回复的草稿 @李娜 ')
  await page.screenshot({path: test.info().outputPath('inline-reply.png')})
  await reply.getByRole('button', {name: '发送', exact: true}).click()
  await expect(composer).toHaveValue('回复的草稿 @李娜 ')
  await reply.getByRole('button', {name: '发送', exact: true}).click()
  await expect(composer).toHaveCount(0)
  expect(writes).toEqual([expect.objectContaining({
    content: '回复的草稿 @李娜',
    parentId: 'mine',
    replyToId: 'reply',
    mentionedUserIds: ['member']
  })])
  await expect(mainDraft).toHaveValue('保留主评论草稿')
  await other.getByRole('button', {name: '回复', exact: true}).click()
  await expect(other.getByRole('textbox', {name: '回复 李娜'})).toBeFocused()
  await other.getByRole('button', {name: '回复', exact: true}).click()
  await expect(other.getByRole('textbox')).toHaveCount(0)
  await other.getByRole('button', {name: '回复', exact: true}).click()
  await expect(other.getByRole('textbox', {name: '回复 李娜'})).toBeFocused()
  await mine.getByRole('button', {name: '回复', exact: true}).click()
  await expect(other.getByRole('textbox')).toHaveCount(0)
  await expect(mine.getByRole('textbox')).toHaveAttribute('placeholder', '回复 Admin 的讨论')
  await mine.getByRole('button', {name: '回复', exact: true}).click()
  await expect(mine.getByRole('textbox')).toHaveCount(0)
  await mine.getByRole('button', {name: '更多'}).click()
  await page.screenshot({path: test.info().outputPath('delete-menu.png')})
  await page.getByRole('menuitem', {name: '删除评论'}).click()
  await expect(page.getByText(/条回复会一并删除/)).toBeVisible()
  await page.getByRole('button', {name: '删除', exact: true}).click()
  await expect(mine).toHaveCount(0)
  await expect(reply).toHaveCount(0)
  await expect(other).toBeVisible()
  await expect(aside.getByRole('tab', {name: /讨论/})).toHaveText('讨论3')
  await page.getByRole('button', {name: '收起记录动态'}).click()
  await expect(aside).toHaveCount(0)
  await expect(page.getByRole('button', {name: '展开记录动态'})).toHaveText('3条讨论')
  await page.screenshot({path: test.info().outputPath('collapsed-discussion-count.png')})
  await page.getByRole('button', {name: '展开记录动态'}).click()
  await expect(aside).toBeVisible()
})

test('收起的讨论数量随记录切换，零条时只展示展开图标', async ({page}) => {
  await setupRecords(page)
  await page.route(`**${recordsPath}/*/discussions*`, route => route.fulfill({
    json: {
      list: [], total: route.request().url().includes('/first/') ? 4 : 0, rootTotal: 0,
    }
  }))
  await page.getByRole('row').filter({hasText: '原始申请'}).click()
  await expect(page.getByRole('button', {name: '展开记录动态'})).toHaveText('4条讨论')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const countLoaded = page.waitForResponse(response => response.url().includes('/second/discussions'))
  await page.getByRole('row').filter({hasText: '另一条申请'}).click()
  await countLoaded
  await expect(page.getByRole('button', {name: '展开记录动态'})).toHaveText('')
  await expect(page.getByText('0条讨论', {exact: true})).toHaveCount(0)
  await expect(page.getByText('4条讨论', {exact: true})).toHaveCount(0)
  await page.getByRole('button', {name: '展开记录动态'}).click()
  await expect(page.getByRole('complementary', {name: '记录动态'})).toBeVisible()
})

test('新建选择的展示方式在详情、编辑和刷新后继续使用', async ({page}) => {
  const {writes} = await setupRecords(page)
  await page.getByRole('button', {name: '新建', exact: true}).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toHaveCSS('animation-name', 'dialog-in')
  await drawer.getByPlaceholder('请输入申请事由').fill('新建申请')
  await drawer.getByPlaceholder('请输入申请金额').fill('12')
  await drawer.getByRole('button', {name: '更多'}).click()
  await expect(page.getByRole('menuitemradio', {name: '对话框'})).toBeChecked()
  await page.getByRole('menuitemradio', {name: '全屏'}).click()
  await expect(drawer.getByPlaceholder('请输入申请事由')).toHaveValue('新建申请')
  await drawer.getByRole('button', {name: '保存', exact: true}).click()
  await expect(drawer.getByRole('heading', {name: '新建申请', exact: true})).toBeVisible()
  await expect(drawer).toHaveCSS('animation-name', 'fullscreen-in')
  await expect(drawer.getByText('12', {exact: true})).toBeVisible()
  expect(writes).toHaveLength(1)

  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await openSelectedRecordForEdit(page, '另一条申请')
  await expect(drawer.getByRole('heading', {name: '编辑采购申请'})).toBeVisible()
  await expect(drawer).toHaveCSS('animation-name', 'fullscreen-in')

  await page.reload()
  await page.getByRole('row').getByRole('button', {name: '原始申请', exact: true}).click()
  await expect(page.getByRole('dialog', {name: '原始申请', exact: true})).toHaveCSS('animation-name', 'fullscreen-in')
})

test('同源标签页共享记录展示方式', async ({page, context}) => {
  await setupRecords(page)
  const otherPage = await context.newPage()
  await setupRecords(otherPage)
  await otherPage.getByRole('row').getByRole('button', {name: '另一条申请', exact: true}).click()
  const otherDetail = otherPage.getByRole('dialog', {name: '另一条申请', exact: true})
  await expect(otherDetail).toHaveCSS('animation-name', 'dialog-in')

  await page.getByRole('row').getByRole('button', {name: '原始申请', exact: true}).click()
  await page.getByRole('dialog').getByRole('button', {name: '更多'}).click()
  await page.getByRole('menuitemradio', {name: '全屏'}).click()
  await expect(otherDetail).toHaveCSS('animation-name', 'fullscreen-in')
})

for (const dark of [false, true]) test('高级查询气泡框组合条件与清空（' + (dark ? '夜间' : '浅色') + '）', async ({page}) => {
  await setupRecords(page)
  if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.getByRole('button', {name: '高级查询', exact: true}).click()
  const panel = page.getByRole('dialog', {name: '高级查询条件'})
  await expect(panel).toBeVisible()
  await panel.getByRole('button', {name: '添加条件'}).click()
  await panel.getByRole('button', {name: '应用查询'}).click()
  await expect(panel.getByRole('alert')).toContainText('请填写')
  await panel.getByRole('combobox', {name: '查询字段 1'}).click()
  await page.getByRole('option', {name: '申请金额', exact: true}).click()
  await panel.getByRole('spinbutton').fill('0')
  await panel.getByRole('button', {name: '添加条件'}).click()
  await panel.getByRole('combobox', {name: '查询字段 2'}).click()
  await page.getByRole('option', {name: '已确认', exact: true}).click()
  await panel.getByRole('combobox', {name: '条件关系'}).click()
  await page.getByRole('option', {name: '任一条件', exact: true}).click()
  await page.screenshot({path: 'test-results/query-' + (dark ? 'dark' : 'light') + '.png'})
  const requested = page.waitForRequest(request => {
    return new URL(request.url()).pathname === viewPath && !!request.postDataJSON().filter
  })
  await panel.getByRole('button', {name: '应用查询'}).click()
  expect((await requested).postDataJSON()).toMatchObject({
    page: 1,
    filter: {_or: [{amount: {_eq: 0}}, {approved: {_eq: false}}]}
  })
  await expect(panel).not.toBeVisible()
  await expect(page.getByText('已启用高级查询：2 个条件（任一满足）')).toBeVisible()
  await page.getByRole('button', {name: '高级查询', exact: true}).click()
  await expect(panel.getByRole('spinbutton')).toHaveValue('0')
  await panel.getByRole('spinbutton').fill('42')
  await panel.getByRole('button', {name: '取消', exact: true}).click()
  await page.getByRole('button', {name: '高级查询', exact: true}).click()
  await expect(panel.getByRole('spinbutton')).toHaveValue('0')
  const cleared = page.waitForRequest(request => new URL(request.url()).pathname === viewPath && !request.postDataJSON().filter)
  await panel.getByRole('button', {name: '清空查询'}).click()
  await cleared
  await expect(page.getByText('已启用高级查询：')).toHaveCount(0)
})

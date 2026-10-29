import {test, expect, type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'
import type {RecordDiscussionItem} from '../src/services/recordDiscussions'

// 验证滚动条实际占位；Chromium 无头模式默认隐藏原生滚动条。
test.use({launchOptions: {ignoreDefaultArgs: ['--hide-scrollbars']}})

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

async function setupRecords(page: Page, {pending, failLoad = false, listForm = form}: {
  pending?: Promise<void>; failLoad?: boolean; listForm?: typeof form
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

for (const dark of [false, true]) test(`列表横向滚动保持主显字段和操作可见（${dark ? '夜间' : '浅色'}）`, async ({page}) => {
  await setupRecords(page)
  if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))
  const scroll = page.locator('.record-list-scroll')
  const row = scroll.getByRole('row').filter({hasText: '原始申请'})
  const primary = row.locator('.record-list-primary')
  const actions = row.locator('.record-list-actions')
  const before = {primary: (await primary.boundingBox())!, actions: (await actions.boundingBox())!,
    middle: (await row.locator('td').nth(2).boundingBox())!}
  expect(await scroll.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
  expect(await scroll.evaluate(el => el.getBoundingClientRect().height - el.clientHeight)).toBeGreaterThan(0)
  await scroll.evaluate(el => {el.scrollLeft = el.scrollWidth})
  await expect.poll(() => scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
  expect((await primary.boundingBox())!.x).toBeCloseTo(before.primary.x, 0)
  expect((await actions.boundingBox())!.x).toBeCloseTo(before.actions.x, 0)
  expect((await row.locator('td').nth(2).boundingBox())!.x).toBeLessThan(before.middle.x)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await row.getByRole('checkbox').check()
  await expect(row).toHaveAttribute('data-selected', 'true')
  await page.mouse.move(0, 0)
  expect(await primary.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(
    await row.locator('td').nth(2).evaluate(el => getComputedStyle(el).backgroundColor))
  await page.screenshot({path: `artifacts/record-fixed-columns-${dark ? 'dark' : 'light'}.png`})
  await row.getByTitle('编辑', {exact: true}).click()
  await expect(page.getByRole('dialog').getByPlaceholder('请输入申请事由')).toHaveValue('原始申请')
})

test('字段较少时表格填满内容区且无需横向滚动', async ({page}) => {
  await setupRecords(page, {listForm: {...form, fields: form.fields.slice(0, 2)}})
  const scroll = page.locator('.record-list-scroll')
  expect(await scroll.evaluate(el => el.scrollWidth === el.clientWidth)).toBe(true)
  const selection = (await scroll.locator('tbody .record-list-selection').first().boundingBox())!
  const primary = (await scroll.locator('tbody .record-list-primary').first().boundingBox())!
  expect(selection.width).toBe(48)
  expect(primary.x).toBeCloseTo(selection.x + selection.width, 0)
})

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

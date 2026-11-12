import {test, expect, type Page} from '@playwright/test'
import type {AppNav, AppNavInput, AppNavOrderInput} from '../src/services/appNavigation'

async function setup(page: Page) {
  const entry = (id: string, name: string, parentId: string): AppNav => ({
    id, name, parentId, type: 'ENTRY', iconName: 'Link', destination: {type: 'LINK', id: 'https://example.com'},
    pageRoute: `/apps/nav-test/${id}`, children: [], visibility: [],
  })
  const navs: AppNav[] = [{
    id: 'top', name: '首页', type: 'GROUP', children: [
      entry('current', '应用说明', 'top'), entry('other', '其他页面', 'top'),
      {
        id: 'group',
        name: '业务分组',
        type: 'GROUP',
        parentId: 'top',
        iconName: 'Folder',
        children: [entry('child', '分组子菜单', 'group')]
      },
    ]
  }, {id: 'empty-top', name: '空白顶部', type: 'GROUP', children: []}]
  const writes: Array<{ method: string; id?: string; input?: Partial<AppNavInput> }> = []
  const orders: AppNavOrderInput[] = []
  let failDelete = false
  let failSave = false
  let failDestinations = false
  let failOrder = false
  const find = (id: string, nodes = navs): AppNav | undefined => {
    for (const nav of nodes) {
      if (nav.id === id) return nav
      const found = find(id, nav.children)
      if (found) return found
    }
  }
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'nav-actions-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const root = '/api/apps/nav-test'
    if (path === root) return route.fulfill({
      json: {
        id: 'nav-test',
        name: '导航测试应用',
        owner: 'admin',
        iconName: 'Boxes'
      }
    })
    if (path === `${root}/navigation/destinations`) {
      if (failDestinations) return route.fulfill({status: 500, json: {message: '选项加载失败'}})
      return route.fulfill({
        json: {
          builtIn: [{type: 'BUILTIN', id: 'files', label: '文件'}],
          forms: [{type: 'FORM', id: 'orders', label: '订单'}]
        }
      })
    }
    if (path === `${root}/directory`) return route.fulfill({
      json: {
        members: [{id: 'u1', name: '张三'}],
        roles: [],
        organizations: []
      }
    })
    if (path === `${root}/navigation` && req.method() === 'GET') return route.fulfill({json: navs})
    if (path === `${root}/navigation` && req.method() === 'POST') {
      const input = req.postDataJSON() as AppNavInput
      const saved: AppNav = {
        ...input,
        id: `new-${writes.length}`,
        children: [],
        pageRoute: `/apps/nav-test/new-${writes.length}`
      }
      writes.push({method: req.method(), input})
      ;(input.parentId ? find(input.parentId)!.children : navs).push(saved)
      return route.fulfill({json: saved})
    }
    if (path === `${root}/navigation/order` && req.method() === 'PUT') {
      if (failOrder) return route.fulfill({status: 500, json: {message: '分组排序保存失败，请重试'}})
      const input = req.postDataJSON() as AppNavOrderInput
      orders.push(input)
      const sorted = input.root.map(id => find(id)!)
      navs.splice(0, navs.length, ...sorted)
      return route.fulfill({json: navs})
    }
    const id = path.match(/\/navigation\/([^/]+)$/)?.[1]
    if (id && ['PUT', 'PATCH', 'DELETE'].includes(req.method())) {
      if (req.method() === 'DELETE') {
        if (failDelete) return route.fulfill({status: 500, json: {message: '删除失败，请重试'}})
        const nav = find(id)!
        const siblings = nav.parentId ? find(nav.parentId)!.children : navs
        siblings.splice(siblings.indexOf(nav), 1)
        writes.push({method: req.method(), id})
        return route.fulfill({status: 204})
      }
      if (failSave) return route.fulfill({status: 500, json: {message: '保存失败，请重试'}})
      const input = req.postDataJSON() as Partial<AppNavInput>
      Object.assign(find(id)!, input)
      writes.push({method: req.method(), id, input})
      return route.fulfill({json: find(id)})
    }
    if (path === '/api/notifications/summary') return route.fulfill({
      json: {
        version: '0',
        unread: 0,
        byCategory: {},
        apps: []
      }
    })
    if (path === '/api/notifications') return route.fulfill({json: {list: [], total: 0}})
    return route.fulfill({json: []})
  })
  await page.route('https://example.com/**', route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: '<p>链接内容</p>'
  }))
  await page.goto('/#/apps/nav-test/current', {waitUntil: 'domcontentloaded'})
  await expect(page.locator('aside').getByRole('link', {name: '应用说明', exact: true})).toBeVisible()
  return {
    navs, writes, orders, errors, failOrder: (value: boolean) => {
      failOrder = value
    }, failDelete: (value: boolean) => {
      failDelete = value
    },
    failSave: (value: boolean) => {
      failSave = value
    }, failDestinations: (value: boolean) => {
      failDestinations = value
    }
  }
}

async function more(page: Page, name: string, action: string, top = false) {
  const scope = top ? page.locator('header').first() : page.locator('aside')
  if (top) await scope.getByRole('link', {name, exact: true}).click()
  const button = scope.getByRole('button', {name: `更多操作：${name}`, exact: true})
  await button.hover()
  await button.click()
  await page.getByRole('menuitem', {name: action, exact: true}).click()
}

test('悬浮更多不跳转，编辑回填与失败重试，顶部菜单独立编辑', async ({page}) => {
  const state = await setup(page)
  const button = page.locator('aside').getByRole('button', {name: '更多操作：其他页面', exact: true})
  await expect(button).toHaveCSS('opacity', '0')
  await page.locator('aside').getByRole('link', {name: '其他页面', exact: true}).hover()
  await expect(button).toHaveCSS('opacity', '1')
  await page.locator('header').getByRole('link', {name: '导航测试应用', exact: true}).hover()
  await expect(button).toHaveCSS('opacity', '0')
  await page.locator('aside').getByRole('link', {name: '其他页面', exact: true}).click()
  await page.locator('header').getByRole('link', {name: '导航测试应用', exact: true}).hover()
  await expect(button).toHaveCSS('opacity', '0')
  await page.locator('aside').getByRole('link', {name: '应用说明', exact: true}).click()
  await more(page, '其他页面', '编辑')
  await expect(page).toHaveURL(/\/current$/)
  const editor = page.getByRole('dialog', {name: '编辑菜单', exact: true})
  await expect(editor.getByPlaceholder('请输入名称')).toHaveValue('其他页面')
  await expect(editor.getByPlaceholder('https://example.com')).toHaveValue('https://example.com')
  await editor.getByPlaceholder('请输入名称').fill('修改后的页面')
  state.failSave(true)
  await editor.getByRole('button', {name: '保存', exact: true}).click()
  await expect(editor.getByRole('alert')).toContainText('保存失败')
  state.failSave(false)
  await editor.getByRole('button', {name: '保存', exact: true}).click()
  await expect(editor).not.toBeVisible()
  await expect(page.locator('aside').getByRole('link', {name: '修改后的页面'})).toBeVisible()
  await more(page, '空白顶部', '编辑', true)
  await expect(page).toHaveURL(/top=empty-top$/)
  const topEditor = page.getByRole('dialog', {name: '编辑一级菜单', exact: true})
  await expect(topEditor.getByPlaceholder('请输入名称')).toHaveValue('空白顶部')
  await topEditor.getByPlaceholder('请输入名称').fill('新的顶部')
  await topEditor.getByRole('button', {name: '保存', exact: true}).click()
  await expect(page.locator('header').getByRole('link', {name: '新的顶部'})).toBeVisible()
  expect(state.writes.map(w => w.id)).toEqual(['other', 'empty-top'])
  expect(state.errors).toEqual([])
})

test('分组更多位于折叠按钮左侧，悬浮不会改变折叠按钮的位置', async ({page}) => {
  const state = await setup(page)
  const sidebar = page.locator('aside')
  const arrow = sidebar.getByRole('button', {name: '展开分组：业务分组', exact: true})
  const moreButton = sidebar.getByRole('button', {name: '更多操作：业务分组', exact: true})
  const before = (await arrow.boundingBox())!
  await sidebar.getByRole('button', {name: '业务分组', exact: true}).hover()
  await expect(moreButton).toHaveCSS('opacity', '1')
  const moreRect = (await moreButton.boundingBox())!
  const after = (await arrow.boundingBox())!
  expect(moreRect.x + moreRect.width).toBeLessThanOrEqual(after.x)
  expect(after.x).toBe(before.x)
  expect(after.width).toBe(before.width)
  await arrow.click()
  await expect(sidebar.getByRole('link', {name: '分组子菜单', exact: true})).toBeVisible()
  await sidebar.getByRole('button', {name: '折叠分组：业务分组', exact: true}).click()
  await expect(sidebar.getByRole('link', {name: '分组子菜单', exact: true})).not.toBeVisible()
  expect(state.errors).toEqual([])
})

test('左侧更多按钮颜色柔和，弹出菜单后移开鼠标仍隐藏，支持明暗模式和键盘操作', async ({page}) => {
  const state = await setup(page)
  const link = page.locator('aside').getByRole('link', {name: '其他页面', exact: true})
  const button = page.locator('aside button[aria-label="更多操作：其他页面"]')
  for (const dark of [false, true]) {
    if (dark) await page.getByTitle('切换到夜间模式', {exact: true}).click()
    await link.hover()
    await expect(button).toHaveCSS('opacity', '1')
    const colors = await button.evaluate((element) => {
      const color = getComputedStyle(element).color
      const root = getComputedStyle(document.body).color
      return {color, root}
    })
    expect(colors.color).not.toBe(colors.root)
    await page.screenshot({path: `artifacts/sidebar-more-${dark ? 'dark' : 'light'}.png`})
    await button.click()
    await page.getByRole('menuitem', {name: '编辑', exact: true}).hover()
    await expect(button).toHaveCSS('opacity', '0')
    await page.mouse.click(800, 80)
    await expect(page.getByRole('menuitem', {name: '编辑', exact: true})).not.toBeVisible()
    await expect(button).toHaveCSS('opacity', '0')
  }
  await link.focus()
  await page.keyboard.press('Tab')
  await expect(button).toBeFocused()
  await expect(button).toHaveCSS('opacity', '1')
  expect(state.errors).toEqual([])
})

test('duck栏新建支持二级选项、自定义链接校验、分组和分组内新增', async ({page}) => {
  const state = await setup(page)
  const newButton = page.getByRole('button', {name: '新建菜单或分组', exact: true})
  await expect(page.getByRole('toolbar', {name: 'duck栏'}).getByRole('button', {
    name: '新建菜单或分组',
    exact: true
  })).toBeVisible()
  await expect(page.locator('aside').getByRole('button', {name: '新建菜单或分组', exact: true})).toHaveCount(1)
  await expect(page.locator('aside svg.lucide-settings')).toHaveCount(0)
  for (const [category, item, type, id] of [['系统内置', '文件', 'BUILTIN', 'files'], ['表单', '订单', 'FORM', 'orders']]) {
    await newButton.click()
    await page.getByRole('menuitem', {name: category, exact: true}).hover()
    await page.getByRole('menuitem', {name: item, exact: true}).click()
    const editor = page.getByRole('dialog', {name: '新增菜单', exact: true})
    await expect(editor.getByPlaceholder('请输入名称')).toHaveValue(item)
    await editor.getByRole('button', {name: '保存', exact: true}).click()
    await expect(editor).not.toBeVisible()
    expect(state.writes.at(-1)?.input).toMatchObject({parentId: 'top', type: 'ENTRY', destination: {type, id}})
  }
  await newButton.click()
  await page.getByRole('menuitem', {name: '自定义链接', exact: true}).click()
  const editor = page.getByRole('dialog', {name: '新增菜单', exact: true})
  await editor.getByPlaceholder('请输入名称').fill('帮助链接')
  await editor.getByPlaceholder('https://example.com').fill('javascript:alert(1)')
  await expect(editor.getByRole('button', {name: '保存', exact: true})).toBeDisabled()
  await editor.getByPlaceholder('https://example.com').fill('https://example.com/help')
  await editor.getByRole('button', {name: '保存', exact: true}).click()
  await expect(editor).not.toBeVisible()
  await newButton.click()
  await page.getByRole('menuitem', {name: '分组', exact: true}).click()
  const groupEditor = page.getByRole('dialog', {name: '新增分组', exact: true})
  await groupEditor.getByPlaceholder('请输入名称').fill('新分组')
  await groupEditor.getByRole('button', {name: '保存', exact: true}).click()
  await expect(groupEditor).not.toBeVisible()
  expect(state.writes.at(-1)?.input).toMatchObject({parentId: 'top', type: 'GROUP', destination: null})
  await more(page, '业务分组', '新增菜单')
  await expect(editor).toBeVisible()
  await editor.getByPlaceholder('请输入名称').fill('新的子菜单')
  await editor.getByRole('combobox').first().click()
  await page.getByRole('option', {name: '文件', exact: true}).click()
  await editor.getByRole('button', {name: '保存', exact: true}).click()
  await expect(editor).not.toBeVisible()
  expect(state.writes.at(-1)?.input).toMatchObject({parentId: 'group', type: 'ENTRY'})
  expect(state.errors).toEqual([])
})

test('左侧、子菜单和顶部授权保存与回填，删除失败重试及删除当前菜单后跳转', async ({page}) => {
  const state = await setup(page)
  await page.locator('aside').getByRole('button', {name: '业务分组', exact: true}).click()
  for (const [name, id, top] of [['应用说明', 'current', false], ['分组子菜单', 'child', false], ['空白顶部', 'empty-top', true]] as const) {
    await more(page, name, '授权', top)
    const dialog = page.getByRole('dialog', {name: `菜单授权 · ${name}`, exact: true})
    await dialog.getByRole('button', {name: '选择用户、角色或组织'}).click()
    await page.getByRole('checkbox', {name: '张三', exact: true}).click()
    await page.keyboard.press('Escape')
    await dialog.getByRole('button', {name: '保存', exact: true}).click()
    await expect(dialog).not.toBeVisible()
    expect(state.writes.at(-1)).toMatchObject({method: 'PATCH', id, input: {visibility: [{type: 'USER', id: 'u1'}]}})
    await more(page, name, '授权', top)
    await expect(dialog.getByRole('button', {name: '移除张三'})).toBeVisible()
    await dialog.getByRole('button', {name: '取消', exact: true}).click()
  }
  await page.locator('header').getByRole('link', {name: '首页', exact: true}).click()
  await more(page, '业务分组', '删除')
  const confirmation = page.getByRole('dialog', {name: '删除菜单', exact: true})
  await expect(confirmation).toContainText('分组内的菜单也会一并删除')
  await confirmation.getByRole('button', {name: '取消', exact: true}).click()
  await more(page, '空白顶部', '删除', true)
  await confirmation.getByRole('button', {name: '删除', exact: true}).click()
  await expect(confirmation).not.toBeVisible()
  await expect(page.locator('header').getByRole('link', {name: '空白顶部'})).toHaveCount(0)
  await more(page, '应用说明', '删除')
  state.failDelete(true)
  await confirmation.getByRole('button', {name: '删除', exact: true}).click()
  await expect(confirmation.getByRole('alert')).toContainText('删除失败')
  state.failDelete(false)
  await confirmation.getByRole('button', {name: '删除', exact: true}).click()
  await expect(page).toHaveURL(/\/other$/)
  await expect(page.locator('aside').getByRole('link', {name: '应用说明', exact: true})).toHaveCount(0)
  expect(state.errors).toEqual([])
})

test('二级选项加载失败后重新打开重试，明暗主题操作可见', async ({page}) => {
  const state = await setup(page)
  state.failDestinations(true)
  const newButton = page.getByRole('button', {name: '新建菜单或分组', exact: true})
  await newButton.click()
  await page.getByRole('menuitem', {name: '表单', exact: true}).hover()
  await expect(page.getByRole('menuitem', {name: '选项加载失败', exact: true})).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  state.failDestinations(false)
  await newButton.click()
  await page.getByRole('menuitem', {name: '表单', exact: true}).hover()
  await expect(page.getByRole('menuitem', {name: '订单', exact: true})).toBeVisible()
  await page.screenshot({path: 'artifacts/nav-create-light.png'})
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.getByTitle('切换到夜间模式', {exact: true}).click()
  await newButton.click()
  await page.getByRole('menuitem', {name: '表单', exact: true}).hover()
  await expect(page.getByRole('menuitem', {name: '订单', exact: true})).toBeVisible()
  await expect(page.getByRole('menuitem', {name: '自定义链接', exact: true})).toHaveCSS('color', 'rgb(250, 250, 250)')
  await page.screenshot({path: 'artifacts/nav-create-dark.png'})
  expect(state.errors).toEqual([])
})

test('倒三角只随选中项显示，顶部新增父级正确，折叠分组更多操作可用', async ({page}) => {
  const state = await setup(page)
  const header = page.locator('header').first()
  await expect(header.getByRole('button', {name: '更多操作：首页', exact: true})).toBeVisible()
  await expect(header.getByRole('button', {name: '更多操作：空白顶部', exact: true})).toHaveCount(0)
  await more(page, '空白顶部', '新增菜单', true)
  const editor = page.getByRole('dialog', {name: '新增菜单', exact: true})
  await editor.getByPlaceholder('请输入名称').fill('顶部的新菜单')
  await editor.getByRole('combobox').first().click()
  await page.getByRole('option', {name: '自定义链接', exact: true}).click()
  await editor.getByPlaceholder('https://example.com').fill('https://example.com/top')
  await editor.getByRole('button', {name: '保存', exact: true}).click()
  await expect(editor).not.toBeVisible()
  expect(state.writes.at(-1)?.input).toMatchObject({parentId: 'empty-top'})
  await expect(header.getByRole('button', {name: '更多操作：空白顶部', exact: true})).toBeVisible()
  await expect(header.getByRole('button', {name: '更多操作：首页', exact: true})).toHaveCount(0)
  await header.getByRole('link', {name: '首页', exact: true}).click()
  await page.locator('aside button:has(svg.lucide-chevrons-left)').click()
  await page.locator('aside button:has(svg.lucide-folder)').hover()
  await page.getByRole('button', {name: '更多操作：分组子菜单', exact: true}).click()
  await page.getByRole('menuitem', {name: '编辑', exact: true}).click()
  await expect(page.getByRole('dialog', {name: '编辑菜单', exact: true})).toBeVisible()
  expect(state.errors).toEqual([])
})

test('空应用可从 duck栏创建顶部菜单，再新增左侧菜单', async ({page}) => {
  const state = await setup(page)
  state.navs.splice(0)
  await page.goto('/#/apps/nav-test')
  await page.reload()
  const newButton = page.getByRole('toolbar', {name: 'duck栏'}).getByRole('button', {
    name: '新建菜单或分组',
    exact: true
  })
  await newButton.click()
  await expect(page.getByRole('menuitem', {name: '自定义链接', exact: true})).toBeDisabled()
  await page.getByRole('menuitem', {name: '顶部菜单', exact: true}).click()
  const topEditor = page.getByRole('dialog', {name: '新增一级菜单', exact: true})
  await topEditor.getByPlaceholder('请输入名称').fill('新的导航')
  await topEditor.getByRole('button', {name: '保存', exact: true}).click()
  await expect(topEditor).not.toBeVisible()
  await expect(page.locator('header').getByRole('link', {name: '新的导航', exact: true})).toBeVisible()
  expect(state.writes.at(-1)?.input).toMatchObject({type: 'GROUP', parentId: null})
  await newButton.click()
  await page.getByRole('menuitem', {name: '自定义链接', exact: true}).click()
  const editor = page.getByRole('dialog', {name: '新增菜单', exact: true})
  await editor.getByPlaceholder('请输入名称').fill('首页链接')
  await editor.getByPlaceholder('https://example.com').fill('https://example.com')
  await editor.getByRole('button', {name: '保存', exact: true}).click()
  await expect(editor).not.toBeVisible()
  expect(state.writes.at(-1)?.input?.parentId).toBe(state.navs[0].id)
  expect(state.errors).toEqual([])
})

test('顶部文字和选中标记居中，倒三角不影响宽度', async ({page}) => {
  const state = await setup(page)
  state.navs[0].name = '质量总览'
  state.navs[1].name = '基础数据'
  await page.reload()
  const header = page.locator('header').first()
  const geometry = (name: string) => header.getByRole('link', {name, exact: true}).evaluate((link) => {
    const tab = link.parentElement!
    const label = link.querySelector('span')!.getBoundingClientRect()
    const tabRect = tab.getBoundingClientRect()
    const marker = tab.querySelector(':scope > span')!.getBoundingClientRect()
    return {
      textX: label.x + label.width / 2, textY: label.y + label.height / 2,
      centerX: tabRect.x + tabRect.width / 2, centerY: tabRect.y + tabRect.height / 2,
      markerX: marker.x + marker.width / 2, width: tabRect.width
    }
  })
  const before = await geometry('质量总览')
  const otherBefore = await geometry('基础数据')
  expect(Math.abs(before.textX - before.centerX)).toBeLessThan(1)
  expect(Math.abs(before.textY - before.centerY)).toBeLessThan(1)
  expect(Math.abs(before.textX - before.markerX)).toBeLessThan(1)
  await page.screenshot({path: 'artifacts/top-nav-centered-light.png'})
  await header.getByRole('link', {name: '基础数据', exact: true}).click()
  await expect(header.getByRole('button', {name: '更多操作：基础数据', exact: true})).toBeVisible()
  const after = await geometry('质量总览')
  const otherAfter = await geometry('基础数据')
  expect(after.width).toBe(before.width)
  expect(otherAfter.width).toBe(otherBefore.width)
  expect(Math.abs(otherAfter.textX - otherAfter.centerX)).toBeLessThan(1)
  expect(Math.abs(otherAfter.textX - otherAfter.markerX)).toBeLessThan(1)
  await page.getByTitle('切换到夜间模式', {exact: true}).click()
  await page.screenshot({path: 'artifacts/top-nav-centered-dark.png'})
  expect(state.errors).toEqual([])
})

test('顶部可在此后添加同级分组，支持取消、中间插入、末尾插入和刷新保序', async ({page}) => {
  const state = await setup(page)
  await more(page, '首页', '在此后添加分组', true)
  const dialog = page.getByRole('dialog', {name: '新增分组', exact: true})
  await expect(dialog.getByRole('button', {name: '保存', exact: true})).toBeDisabled()
  await dialog.getByPlaceholder('请输入名称').fill('取消的分组')
  await dialog.getByRole('button', {name: '取消', exact: true}).click()
  expect(state.writes).toHaveLength(0)
  for (const [anchor, name, index] of [['首页', '中间分组', 1], ['空白顶部', '末尾分组', 3]] as const) {
    await more(page, anchor, '在此后添加分组', true)
    await dialog.getByPlaceholder('请输入名称').fill(name)
    await dialog.getByRole('button', {name: '保存', exact: true}).click()
    await expect(dialog).not.toBeVisible()
    expect(state.navs[index].name).toBe(name)
    expect(state.writes.at(-1)?.input).toMatchObject({type: 'GROUP', parentId: null, destination: null})
    expect(state.orders.at(-1)?.root).toEqual(state.navs.map(nav => nav.id))
    expect(state.orders.at(-1)?.children.top).toEqual(['current', 'other', 'group'])
    await page.reload()
    await expect(page.locator('header nav a')).toHaveText(state.navs.map(nav => nav.name))
  }
  expect(state.errors).toEqual([])
})

test('在此后添加分组排序失败后可重试，保留修改且不重复新增', async ({page}) => {
  const state = await setup(page)
  await more(page, '首页', '在此后添加分组', true)
  const dialog = page.getByRole('dialog', {name: '新增分组', exact: true})
  await dialog.getByPlaceholder('请输入名称').fill('新的分组')
  state.failOrder(true)
  await dialog.getByRole('button', {name: '保存', exact: true}).click()
  await expect(dialog.getByRole('alert')).toContainText('分组排序保存失败')
  await expect(dialog.getByRole('alert')).toContainText('关闭弹窗会保留该分组')
  expect(state.writes.filter(write => write.method === 'POST')).toHaveLength(1)
  const createdId = state.navs.at(-1)!.id
  await dialog.getByPlaceholder('请输入名称').fill('修改后的分组')
  state.failOrder(false)
  await dialog.getByRole('button', {name: '保存', exact: true}).click()
  await expect(dialog).not.toBeVisible()
  expect(state.writes.filter(write => write.method === 'POST')).toHaveLength(1)
  expect(state.writes.at(-1)).toMatchObject({method: 'PUT', id: createdId, input: {name: '修改后的分组'}})
  expect(state.navs.map(nav => nav.name)).toEqual(['首页', '修改后的分组', '空白顶部'])
  await page.reload()
  await expect(page.locator('header nav a')).toHaveText(['首页', '修改后的分组', '空白顶部'])
  expect(state.errors).toEqual([])
})

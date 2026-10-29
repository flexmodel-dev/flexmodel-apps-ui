import {test, expect} from '@playwright/test'
import type {DirectorySelection} from '../src/types/directory'

test('菜单行独立授权使用弹窗局部更新并支持多选、取消、回填、失败重试及清空', async ({page}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const root = '/api/apps/menu-test'
  const child = {id: 'child', name: '文件', type: 'ITEM', target: {type: 'LINK', id: 'https://example.com'},
    parentId: 'top', pageRoute: '/apps/menu-test/child', children: [], members: [] as DirectorySelection[]}
  const menus = [{id: 'top', name: '团队', type: 'GROUP', children: [child], members: []}]
  const writes: DirectorySelection[][] = []
  let fail = false
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'menu-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
  })
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === `${root}/menus/child` && request.method() === 'PATCH') {
      if (fail) return route.fulfill({status: 500, json: {message: '授权保存失败'}})
      child.members = (request.postDataJSON() as { members: DirectorySelection[] }).members
      writes.push(child.members)
      return route.fulfill({json: child})
    }
    if (path === `${root}/menus`) return route.fulfill({json: menus})
    if (path === `${root}/menus/targets`) return route.fulfill({json: {builtIn: [], forms: []}})
    if (path === `${root}/directory`) return route.fulfill({json: {
      members: [{id: 'u1', name: '张三'}, {id: 'u2', name: '李四'}],
      roles: [{id: 'r1', name: '经理'}], organizations: [{id: 'o1', name: '销售部'}],
    }})
    if (path === root) return route.fulfill({
      json: {
        id: 'menu-test',
        projectId: 'menu-test',
        name: '测试应用',
        owner: 'admin',
        iconName: 'Boxes'
      }
    })
    if (path === '/api/notifications/summary') return route.fulfill({json: {version: '0', unread: 0, byCategory: {}, apps: []}})
    if (path === '/api/notifications') return route.fulfill({json: {list: [], total: 0}})
    return route.fulfill({json: []})
  })
  await page.route('https://example.com/**', route => route.fulfill({contentType: 'text/html', body: '<p>菜单页面</p>'}))
  await page.goto('/#/apps/menu-test/child', {waitUntil: 'domcontentloaded'})
  await expect(page.getByText('测试应用', {exact: true}).first()).toBeVisible()
  await page.locator('button').filter({has: page.locator('svg.lucide-settings')}).last().click()
  const editor = page.getByRole('dialog', {name: '菜单编辑', exact: true})
  await editor.getByRole('button', {name: '授权：文件', exact: true}).click()
  const popover = page.getByRole('dialog', {name: '菜单授权 · 文件', exact: true})
  await popover.getByRole('button', {name: '选择用户、角色或组织'}).click()
  await page.getByRole('checkbox', {name: '张三'}).click()
  await page.getByRole('checkbox', {name: '李四'}).click()
  await page.getByRole('tab', {name: '角色', exact: true}).click()
  await page.getByRole('checkbox', {name: '经理'}).click()
  await page.keyboard.press('Escape')
  await popover.getByRole('button', {name: '取消', exact: true}).click()
  expect(writes).toHaveLength(0)
  await editor.getByRole('button', {name: '授权：文件', exact: true}).click()
  await popover.getByRole('button', {name: '选择用户、角色或组织'}).click()
  await page.getByRole('checkbox', {name: '张三'}).click()
  await page.getByRole('checkbox', {name: '李四'}).click()
  await page.keyboard.press('Escape')
  fail = true
  await popover.getByRole('button', {name: '保存', exact: true}).click()
  await expect(popover.getByRole('alert')).toContainText('授权保存失败')
  fail = false
  await popover.getByRole('button', {name: '保存', exact: true}).click()
  await expect(popover).not.toBeVisible()
  expect(writes[0]).toEqual([{type: 'USER', id: 'u1'}, {type: 'USER', id: 'u2'}])
  await expect(editor.getByRole('button', {
    name: '授权：文件',
    exact: true
  })).toHaveAttribute('title', '授权（已设置 2 项）')
  await editor.getByRole('button', {name: '授权：文件', exact: true}).click()
  await expect(popover.getByRole('button', {name: '移除张三'})).toBeVisible()
  await page.screenshot({path: 'artifacts/menu-authorization-light.png', animations: 'disabled'})
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.screenshot({path: 'artifacts/menu-authorization-dark.png', animations: 'disabled'})
  await popover.getByRole('button', {name: '移除张三'}).click()
  await popover.getByRole('button', {name: '移除李四'}).click()
  await popover.getByRole('button', {name: '保存', exact: true}).click()
  await expect(popover).not.toBeVisible()
  expect(writes[1]).toEqual([])
  expect(errors).toEqual([])
})

test('设置页菜单管理支持弹窗授权', async ({page}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const root = '/api/apps/menu-test'
  const child = {
    id: 'child', name: '文件', type: 'ITEM', target: {type: 'LINK', id: 'https://example.com'},
    parentId: 'top', pageRoute: '/apps/menu-test/child', children: [], members: [] as DirectorySelection[]
  }
  const menus = [{id: 'top', name: '团队', type: 'GROUP', children: [child], members: []}]
  const writes: DirectorySelection[][] = []
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'menu-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
  })
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === `${root}/menus/child` && request.method() === 'PATCH') {
      child.members = (request.postDataJSON() as { members: DirectorySelection[] }).members
      writes.push(child.members)
      return route.fulfill({json: child})
    }
    if (path === `${root}/menus`) return route.fulfill({json: menus})
    if (path === `${root}/menus/targets`) return route.fulfill({json: {builtIn: [], forms: []}})
    if (path === `${root}/directory`) return route.fulfill({
      json: {
        members: [{id: 'u1', name: '张三'}, {id: 'u2', name: '李四'}],
        roles: [{id: 'r1', name: '经理'}], organizations: [{id: 'o1', name: '销售部'}],
      }
    })
    if (path === root) return route.fulfill({
      json: {
        id: 'menu-test',
        projectId: 'menu-test',
        name: '测试应用',
        owner: 'Admin',
        iconName: 'Boxes'
      }
    })
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
  await page.goto('/#/admin/apps/menu-test/settings/menus', {waitUntil: 'domcontentloaded'})
  await page.getByRole('button', {name: '授权：文件', exact: true}).click()
  const popover = page.getByRole('dialog', {name: '菜单授权 · 文件', exact: true})
  await popover.getByRole('button', {name: '选择用户、角色或组织'}).click()
  await page.getByRole('checkbox', {name: '张三'}).click()
  await page.keyboard.press('Escape')
  await popover.getByRole('button', {name: '保存', exact: true}).click()
  await expect(popover).not.toBeVisible()
  expect(writes).toEqual([[{type: 'USER', id: 'u1'}]])
  await expect(page.getByRole('button', {name: '授权：文件', exact: true}))
    .toHaveAttribute('title', '授权（已设置 1 项）')
  await page.screenshot({path: 'artifacts/settings-menu-authorization.png', animations: 'disabled'})
  expect(errors).toEqual([])
})

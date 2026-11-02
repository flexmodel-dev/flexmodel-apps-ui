import {test, expect, type Page} from '@playwright/test'

const appId = 'permission-ui'
const root = `/api/apps/${appId}`
const location = `/#/admin/apps/${appId}/forms/customer/data-permissions`

async function setup(page: Page, forbidden = false) {
  const errors: string[] = []
  const saved: Array<Record<string, any>> = []
  page.on('pageerror', error => errors.push(error.message))
  const fields = [{name: 'name', label: '名称', type: 'TEXT', builtin: false, required: true}, {name: 'owner_id', label: '所有者', type: 'REFERENCE', referenceForm: 'f_user', builtin: true}]
  const child = {name: 'contact', label: '联系人', description: '', fields, layout: {items: [{type: 'FIELD', name: 'name'}]}, viewTabs: [], builtin: false}
  const form = {...child, name: 'customer', label: '客户', layout: {items: [{type: 'FIELD', name: 'name'}, {type: 'SUBFORM', formName: 'contact', referenceField: 'customer_id'}]}}
  const forms: any[] = [form, child]
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'permissions-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
  })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path === `${root}/forms/customer/authorizations`) {
      if (forbidden) return route.fulfill({status: 403, json: {message: '只有应用所有者可以管理数据权限'}})
      if (method === 'POST') { const data = {...route.request().postDataJSON(), id: 'rule1', appId, formName: 'customer'}; saved.push(data); return route.fulfill({json: data}) }
      return route.fulfill({json: saved})
    }
    if (path === `${root}/directory`) return route.fulfill({json: {members: [{id: 'u1', name: '张三', role: '销售'}], roles: [{id: 'r1', name: '销售经理'}], organizations: [{id: 'o1', name: '销售部', parentId: ''}]}})
    if (path === `${root}/forms`) return route.fulfill({json: forms})
    if (path === `${root}/forms/customer`) return route.fulfill({json: form})
    if (path === root) return route.fulfill({json: {id: appId, projectId: appId, name: '客户应用', iconName: 'Boxes', owner: 'admin'}})
    if (path === '/api/notifications/summary') return route.fulfill({json: {version: '0', unread: 0, byCategory: {}, apps: []}})
    return route.fulfill({json: []})
  })
  return {saved, errors, forms, form}
}

test('多选公共目录、主子表开关、保存模型与新子表默认关闭', async ({page}) => {
  const state = await setup(page)
  await page.goto(location)
  await page.getByRole('button', {name: '新增规则'}).click()
  await page.getByLabel('规则名称').fill('销售管理')
  await page.getByRole('button', {name: '选择用户、角色或组织', exact: true}).click()
  await page.getByRole('checkbox').filter({hasText: '张三'}).click()
  await page.getByRole('tab', {name: '角色', exact: true}).click()
  await page.getByRole('checkbox').filter({hasText: '销售经理'}).click()
  await page.getByRole('tab', {name: '组织架构', exact: true}).click()
  await page.getByRole('checkbox').filter({hasText: '销售部'}).click()
  await page.keyboard.press('Escape')
  await page.getByLabel('含子组织').check()
  await page.getByLabel('本人', {exact: true}).check()
  const main = page.getByRole('tabpanel', {name: '客户 · 主表单', exact: true})
  await page.getByRole('tab', {name: '联系人 · 子表单', exact: true}).click()
  await expect(page.getByRole('tabpanel', {name: '联系人 · 子表单', exact: true}).getByLabel('查看全部字段')).not.toBeChecked()
  await page.getByRole('tab', {name: '客户 · 主表单', exact: true}).click()
  await main.getByLabel('查看全部字段').check()
  await main.getByLabel('修改全部业务字段').check()
  await expect(main.getByLabel('客户所有者修改')).toBeDisabled()
  await expect(main.getByLabel('客户所有者修改')).not.toBeChecked()
  await expect(main.getByLabel('客户所有者删除')).toBeDisabled()
  await main.getByRole('button', {name: '添加条件'}).click()
  await page.getByRole('button', {name: '保存', exact: true}).click()
  await expect(page.getByText('销售管理', {exact: true})).toBeVisible()
  expect(state.saved[0].subjects).toEqual([{type: 'USER', ids: ['u1']}, {type: 'ROLE', ids: ['r1']}, {type: 'ORGANIZATION', ids: ['o1'], includeChildren: true}])
  expect(state.saved[0].controls).toHaveLength(2)
  expect(state.saved[0].controls[1]).toMatchObject({formName: 'contact', readAll: false, writeAll: false, allowDelete: false})
  expect(state.saved[0].controls[0].condition).toEqual({name: {_eq: ''}})
  expect(state.saved[0].controls[0]).not.toHaveProperty('reference_field')
  await expect(page.getByText('当前仅保存权限配置，尚未参与运行时数据访问控制。', {exact: true})).toBeVisible()
  await expect(page.getByRole('button', {name: '启用数据权限', exact: true})).toHaveCount(0)
  state.forms.push({...state.forms[1], name: 'notes', label: '备注'})
  state.form.layout.items.push({type: 'SUBFORM', formName: 'notes', referenceField: 'customer_id'})
  await page.reload()
  await page.getByRole('button', {name: '编辑', exact: true}).click()
  await page.getByRole('tab', {name: '备注 · 子表单', exact: true}).click()
  const added = page.getByRole('tabpanel', {name: '备注 · 子表单', exact: true})
  await expect(added.getByLabel('查看全部字段')).not.toBeChecked()
  await expect(added.getByLabel('修改全部业务字段')).not.toBeChecked()
  await expect(added.getByLabel('允许删除')).not.toBeChecked()
  expect(state.errors).toEqual([])
})

test('暗色与手机配置无横向溢出', async ({page}) => {
  await setup(page)
  await page.setViewportSize({width: 390, height: 844})
  await page.goto(location)
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.getByRole('button', {name: '新增规则'}).click()
  await page.getByRole('tab', {name: '联系人 · 子表单', exact: true}).click()
  await expect(page.getByRole('tabpanel', {name: '联系人 · 子表单', exact: true}).getByLabel('查看全部字段')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({path: 'artifacts/data-permissions-mobile-dark.png', fullPage: true})
})

test('无管理权限时显示后端错误并禁止创建配置', async ({page}) => {
  await setup(page, true)
  await page.goto(location)
  await expect(page.getByRole('alert')).toContainText('只有应用所有者')
  await expect(page.getByRole('button', {name: '新增规则'})).toBeDisabled()
})

import {test, expect} from '@playwright/test'

for (const dark of [false, true]) {
  test(`目录编辑、权限与删除（${dark ? '夜间' : '浅色'}）`, async ({page}) => {
    let name = '资料'
    let deleted = false
    const writes: unknown[] = []
    const errors: string[] = []
    page.on('pageerror', error => { errors.push(error.message); console.log(error.stack) })
    await page.addInitScript(dark => {
      localStorage.setItem('flexmodel-apps.auth.token', 'files-test')
      localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
      localStorage.setItem('night', String(dark))
    }, dark)
    await page.route('**/api/**', async route => {
      const req = route.request()
      const url = new URL(req.url())
      const path = decodeURIComponent(url.pathname)
      if (path.endsWith('/buckets/default/folder')) {
        if (req.method() === 'PUT') {
          const body = req.postDataJSON()
          writes.push(body)
          if (body.name === '冲突') return route.fulfill({status: 400, json: {message: '目标位置已存在同名文件或目录'}})
          name = body.name
          return route.fulfill({status: 204})
        }
        return route.fulfill({json: []})
      }
      if (path.includes('/buckets/default/objects/')) {
        deleted = true
        return route.fulfill({status: 204})
      }
      if (path.endsWith('/buckets/default/objects')) {
        const prefix = url.searchParams.get('prefix')
        const objects = !prefix && !deleted ? [{name, path: name, type: 'folder'}, {name: '子目录', path: `${name}/子目录`, type: 'folder'}].slice(0, 1)
          : prefix === name ? [{name: '子目录', path: `${name}/子目录`, type: 'folder'}]
            : prefix === 'file_app/' ? [{name: '表单附件', path: 'file_app/orders', type: 'folder'}] : []
        return route.fulfill({json: objects})
      }
      const app = {id: 'file_app', projectId: 'file_app', name: '文件验证', enabled: true, primaryColor: 'blue'}
      const json = path === '/api/apps/file_app' ? app : path === '/api/apps' ? [app]
        : path.endsWith('/menus') ? [{id: 'files', type: 'ITEM', name: '文件', target: {type: 'BUILTIN', id: 'files'}, children: []}]
          : path.endsWith('/buckets') ? [{name: 'default'}]
            : path.endsWith('/directory') ? {members: [{id: 'alice', name: '张三'}], roles: [], organizations: []}
              : path.endsWith('/summary') ? {version: '0', unread: 0, byCategory: {}, apps: []}
                : path === '/api/notifications' ? {list: [], total: 0} : []
      await route.fulfill({json})
    })
    await page.goto('/#/apps/file_app/files')
    const edit = page.getByRole('button', {name: '编辑目录：资料', exact: true})
    await expect(edit).toBeAttached()
    await expect(edit.locator('..')).toHaveCSS('opacity', '0')
    await edit.locator('../..').hover()
    await expect(edit.locator('..')).toHaveCSS('opacity', '1')
    await expect(page.getByRole('button', {name: '编辑目录：全部文件'})).toHaveCount(0)
    await edit.locator('../..').getByRole('button').first().click()
    await edit.click()
    const dialog = page.getByRole('dialog', {name: '编辑目录', exact: true})
    await dialog.getByRole('textbox').fill('冲突')
    await dialog.getByRole('button', {name: '保存', exact: true}).click()
    await expect(dialog.getByRole('alert')).toContainText('同名')
    await dialog.getByRole('textbox').fill('项目资料')
    await dialog.getByRole('button', {name: '选择用户、角色或组织'}).click()
    await page.getByText('张三', {exact: true}).click()
    await page.keyboard.press('Escape')
    await page.screenshot({path: `artifacts/files-edit-${dark ? 'dark' : 'light'}.png`})
    await dialog.getByRole('button', {name: '保存', exact: true}).click()
    await expect(dialog).toHaveCount(0)
    expect(writes.at(-1)).toEqual({name: '项目资料', members: [{type: 'USER', id: 'alice'}]})
    await expect(page.getByText('项目资料', {exact: true}).first()).toBeVisible()
    await expect(page.getByRole('button', {name: '编辑目录：项目资料'})).toBeAttached()
    const remove = page.getByRole('button', {name: '删除目录：项目资料', exact: true})
    await remove.locator('../..').hover()
    await expect(remove.locator('..')).toHaveCSS('opacity', '1')
    await expect(page.getByText('目标位置已存在同名文件或目录', {exact: true})).toHaveCount(0)
    await page.screenshot({path: `artifacts/files-${dark ? 'dark' : 'light'}.png`})
    await remove.click()
    await page.getByRole('dialog').getByRole('button', {name: '删除', exact: true}).click()
    await expect(remove).toHaveCount(0)
    await page.getByText('附件', {exact: true}).click()
    await expect(page.getByText('表单附件', {exact: true}).first()).toBeVisible()
    await expect(page.getByRole('button', {name: /编辑目录：|删除目录：/})).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

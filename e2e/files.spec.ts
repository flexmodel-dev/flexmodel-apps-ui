import {test, expect} from '@playwright/test'

for (const dark of [false, true]) {
  test(`目录编辑、权限与删除（${dark ? '夜间' : '浅色'}）`, async ({page}) => {
    let name = '资料'
    let deleted = false
    let restricted = false
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
          restricted = body.members.length > 0
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
        const objects = !prefix && !deleted ? [{name, path: name, type: 'folder', restricted}]
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
    const row = edit.locator('../..')
    const count = row.locator('.tabular-nums')
    await expect(count).toBeVisible()
    await expect(row.getByRole('img', {name: '已配置权限'})).toHaveCount(0)
    const rowBox = await row.boundingBox()
    const countBox = await count.boundingBox()
    expect(rowBox!.x + rowBox!.width - countBox!.x - countBox!.width).toBeCloseTo(12, 0)
    await expect(edit.locator('..')).toHaveCSS('opacity', '0')
    await edit.locator('../..').hover()
    await expect(edit.locator('..')).toHaveCSS('opacity', '1')
    await expect(count).toBeHidden()
    await expect(page.getByRole('button', {name: '编辑目录：全部文件'})).toHaveCount(0)
    await edit.locator('../..').getByRole('button').first().click()
    await edit.hover()
    await expect(edit).not.toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')
    await edit.click()
    const dialog = page.getByRole('dialog', {name: '编辑目录', exact: true})
    const activeEdit = page.getByRole('button', {name: '编辑目录：资料', exact: true, includeHidden: true})
    await expect(activeEdit).toHaveAttribute('aria-expanded', 'true')
    await expect(activeEdit).not.toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')
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
    const updatedRow = remove.locator('../..')
    await expect(updatedRow.getByRole('img', {name: '已配置权限'})).toBeVisible()
    await expect(updatedRow.locator('.tabular-nums')).toBeHidden()
    const editButton = page.getByRole('button', {name: '编辑目录：项目资料'})
    expect(await editButton.evaluate(el => getComputedStyle(el).color)).toBe(await remove.evaluate(el => getComputedStyle(el).color))
    expect(await editButton.evaluate(el => getComputedStyle(el).color)).not.toBe(await updatedRow.evaluate(el => getComputedStyle(el).color))
    const editBox = await editButton.boundingBox()
    const removeBox = await remove.boundingBox()
    expect(removeBox!.x - editBox!.x - editBox!.width).toBe(0)
    await expect(page.getByText('目标位置已存在同名文件或目录', {exact: true})).toHaveCount(0)
    await page.screenshot({path: `artifacts/files-${dark ? 'dark' : 'light'}.png`})
    await remove.click()
    const activeDelete = page.getByRole('button', {name: '删除目录：项目资料', exact: true, includeHidden: true})
    await expect(activeDelete).toHaveAttribute('aria-expanded', 'true')
    await expect(activeDelete).not.toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')
    await page.getByRole('dialog').getByRole('button', {name: '删除', exact: true}).click()
    await expect(remove).toHaveCount(0)
    await page.getByText('附件', {exact: true}).click()
    await expect(page.getByText('表单附件', {exact: true}).first()).toBeVisible()
    await expect(page.getByRole('button', {name: /编辑目录：|删除目录：/})).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

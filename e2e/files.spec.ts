import {test, expect} from '@playwright/test'

for (const dark of [false, true]) {
  test(`目录编辑、权限与删除（${dark ? '夜间' : '浅色'}）`, async ({page}) => {
    let name = '资料'
    let deleted = false
    let restricted = false
    let members: unknown[] = []
    const writes: unknown[] = []
    const moves: unknown[] = []
    let fileName = '说明.txt'
    let memberReads = 0
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
          members = body.members
          restricted = members.length > 0
          return route.fulfill({status: 204})
        }
        memberReads += 1
        return route.fulfill({json: members})
      }
      if (path.endsWith('/buckets/default/move')) {
        const body = req.postDataJSON()
        if (body.target === '冲突.txt') return route.fulfill({status: 400, json: {message: '目标位置已存在同名文件或目录'}})
        moves.push(body)
        fileName = body.target
        return route.fulfill({status: 204})
      }
      if (path.includes('/buckets/default/objects/')) {
        deleted = true
        return route.fulfill({status: 204})
      }
      if (path.endsWith('/buckets/default/objects')) {
        const prefix = url.searchParams.get('prefix')
        const objects = !prefix && !deleted ? [{name, path: name, type: 'folder', restricted}, {name: fileName, path: fileName, type: 'file'}]
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
    const sidebar = page.locator('aside')
    const viewport = page.locator('.file-viewport')
    const more = sidebar.getByRole('button', {name: '更多操作：资料', exact: true})
    await expect(more).toBeAttached()
    const row = more.locator('../..')
    const count = row.locator('.tabular-nums')
    await expect(count).toBeVisible()
    await expect(row.getByRole('img', {name: '已配置权限'})).toHaveCount(0)
    await expect(sidebar.getByRole('button', {name: /授权：/})).toHaveCount(0)
    const rowBox = await row.boundingBox()
    const countBox = await count.boundingBox()
    expect(rowBox!.x + rowBox!.width - countBox!.x - countBox!.width).toBeCloseTo(12, 0)
    await expect(more).toHaveCSS('opacity', '0')
    await row.hover()
    await expect(more).toHaveCSS('opacity', '1')
    await expect(count).toBeHidden()
    await expect(sidebar.getByRole('button', {name: '更多操作：全部文件'})).toHaveCount(0)
    await row.getByRole('button').first().click()
    await more.hover()
    await expect(page.getByRole('menu')).toHaveCount(1)
    await expect(more).toHaveCSS('padding', '6px')
    await expect(more).toHaveCSS('border-top-width', '0px')
    await expect(more.locator('svg')).toHaveCSS('width', '16px')
    await page.getByRole('menuitem', {name: '编辑', exact: true}).click()
    const dialog = page.getByRole('dialog', {name: '编辑', exact: true})
    await dialog.getByRole('textbox').fill('冲突')
    await dialog.getByRole('button', {name: '保存', exact: true}).click()
    await expect(dialog.getByRole('alert')).toContainText('同名')
    await dialog.getByRole('textbox').fill('项目资料')
    await dialog.getByRole('button', {name: '选择用户、角色或组织'}).click()
    await page.getByText('张三', {exact: true}).click()
    await page.keyboard.press('Escape')
    await page.screenshot({path: 'artifacts/files-edit-' + (dark ? 'dark' : 'light') + '.png'})
    await dialog.getByRole('button', {name: '保存', exact: true}).click()
    await expect(dialog).toHaveCount(0)
    expect(writes.at(-1)).toEqual({name: '项目资料', members: [{type: 'USER', id: 'alice'}]})
    await expect(sidebar.getByRole('img', {name: '已配置权限'})).toBeVisible()
    await page.getByRole('button', {name: '全部文件', exact: true}).click()
    const rightMore = viewport.getByRole('button', {name: '更多操作：项目资料', exact: true})
    await rightMore.hover()
    await expect(page.getByRole('menu')).toHaveCount(1)
    await expect(rightMore).toHaveCSS('padding', '6px')
    await expect(rightMore).toHaveCSS('border-top-width', '0px')
    await expect(rightMore.locator('svg')).toHaveCSS('width', '16px')
    await expect(sidebar.getByRole('button', {name: '更多操作：项目资料'})).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1')
    await page.screenshot({path: 'artifacts/files-menu-' + (dark ? 'dark' : 'light') + '.png'})
    await page.getByRole('menuitem', {name: '编辑', exact: true}).click()
    await expect(dialog.getByRole('textbox')).toHaveValue('项目资料')
    await expect(dialog.getByText('用户 · 张三')).toBeVisible()
    await dialog.getByRole('textbox').fill('项目归档')
    await dialog.getByRole('button', {name: '保存', exact: true}).click()
    await expect(dialog).toHaveCount(0)
    expect(writes.at(-1)).toEqual({name: '项目归档', members: [{type: 'USER', id: 'alice'}]})
    const readsBeforeFileEdit = memberReads
    await viewport.getByRole('button', {name: '更多操作：说明.txt'}).hover()
    await page.getByRole('menuitem', {name: '编辑', exact: true}).click()
    await expect(dialog.getByRole('textbox')).toHaveValue('说明.txt')
    await expect(dialog.getByRole('button', {name: '选择用户、角色或组织'})).toHaveCount(0)
    await dialog.getByRole('textbox').fill('冲突.txt')
    await dialog.getByRole('button', {name: '保存', exact: true}).click()
    await expect(dialog.getByRole('alert')).toContainText('同名')
    await dialog.getByRole('textbox').fill('文档.txt')
    await page.screenshot({path: 'artifacts/file-edit-' + (dark ? 'dark' : 'light') + '.png'})
    await dialog.getByRole('button', {name: '保存', exact: true}).click()
    await expect(dialog).toHaveCount(0)
    expect(moves.at(-1)).toEqual({source: '说明.txt', target: '文档.txt'})
    expect(memberReads).toBe(readsBeforeFileEdit)
    await expect(viewport.getByRole('button', {name: '更多操作：文档.txt'})).toBeAttached()
    const remove = sidebar.getByRole('button', {name: '更多操作：项目归档', exact: true})
    await remove.hover()
    await page.getByRole('menuitem', {name: '删除', exact: true}).click()
    await page.getByRole('dialog', {name: '删除', exact: true}).getByRole('button', {name: '删除', exact: true}).click()
    await expect(remove).toHaveCount(0)
    await page.getByText('附件', {exact: true}).click()
    await expect(page.getByText('表单附件', {exact: true}).first()).toBeVisible()
    await expect(sidebar.getByRole('button', {name: /更多操作：|授权：/})).toHaveCount(0)
    await viewport.getByRole('button', {name: '更多操作：表单附件'}).hover()
    await expect(page.getByRole('menuitem', {name: '编辑', exact: true})).toHaveCount(0)
    await expect(page.getByRole('menuitem', {name: '删除', exact: true})).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

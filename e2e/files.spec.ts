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

for (const dark of [false, true]) {
  test('文件排序与移除分享列表（' + (dark ? '夜间' : '浅色') + '）', async ({page}) => {
    const app = {id: 'sort_app', projectId: 'sort_app', name: '排序验证', enabled: true, primaryColor: 'blue'}
    const entries = [
      {name: 'B.txt', size: 10, lastModified: '2026-02-01T00:00:00Z'},
      {name: 'a.txt', size: 300, lastModified: '2026-01-01T00:00:00Z'},
      {name: 'C.txt', size: 20, lastModified: '2026-03-01T00:00:00Z'},
      {name: 'empty.txt', size: null, lastModified: null},
      {name: 'file10.txt', size: 0, lastModified: 'invalid'},
      {name: 'file2.txt', size: 25, lastModified: '2026-04-01T00:00:00Z'},
    ].map(item => ({...item, type: 'file', path: item.name}))
    let objectReads = 0
    await page.addInitScript(dark => {
      localStorage.setItem('flexmodel-apps.auth.token', 'sort-test')
      localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
      localStorage.setItem('night', String(dark))
    }, dark)
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      const path = url.pathname
      if (path.endsWith('/objects')) {
        objectReads += 1
        const prefix = url.searchParams.get('prefix')
        return route.fulfill({json: prefix === '目录' ? [] : [...entries, {name: '目录', path: '目录', type: 'folder'}]})
      }
      const json = path === '/api/apps/sort_app' ? app : path === '/api/apps' ? [app]
        : path.endsWith('/menus') ? [{id: 'files', type: 'ITEM', name: '文件', target: {type: 'BUILTIN', id: 'files'}, children: []}]
          : path.endsWith('/buckets') ? [{name: 'default'}]
            : path.endsWith('/summary') ? {version: '0', unread: 0, byCategory: {}, apps: []}
              : path === '/api/notifications' ? {list: [], total: 0} : []
      return route.fulfill({json})
    })
    await page.goto('/#/apps/sort_app/files')
    const names = page.locator('.file-viewport .group .truncate')
    await expect(names).toHaveText(['目录', ...entries.map(item => item.name)])
    await expect(page.locator('aside .tabular-nums')).toHaveText('0')
    await expect(page.getByRole('button', {name: '分享列表'})).toHaveCount(0)
    const readsBeforeSort = objectReads
    const options: Array<[string, string[]]> = [
      ['最近上传', ['file2.txt', 'C.txt', 'B.txt', 'a.txt', 'empty.txt', 'file10.txt']],
      ['最早上传', ['a.txt', 'B.txt', 'C.txt', 'file2.txt', 'empty.txt', 'file10.txt']],
      ['较大文件', ['a.txt', 'file2.txt', 'C.txt', 'B.txt', 'file10.txt', 'empty.txt']],
      ['文件名称 (A-Z)', ['a.txt', 'B.txt', 'C.txt', 'empty.txt', 'file2.txt', 'file10.txt']],
      ['文件名称 (Z-A)', ['file10.txt', 'file2.txt', 'empty.txt', 'C.txt', 'B.txt', 'a.txt']],
    ]
    for (const [label, expected] of options) {
      await page.getByRole('button', {name: '文件排序'}).click()
      await expect(page.getByRole('menuitem')).toHaveCount(5)
      await page.getByRole('menuitem', {name: label, exact: true}).click()
      await expect(names).toHaveText(['目录', ...expected])
      await expect(page.getByRole('button', {name: '文件排序'})).toContainText(label)
    }
    expect(objectReads).toBe(readsBeforeSort)
    await page.getByRole('button', {name: '文件排序'}).click()
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1')
    await page.screenshot({path: 'artifacts/files-sort-' + (dark ? 'dark' : 'light') + '.png'})
    await page.keyboard.press('Escape')
    await page.getByPlaceholder('搜索').fill('file')
    await expect(names).toHaveText(['file10.txt', 'file2.txt'])
    await page.getByPlaceholder('搜索').fill('')
    await page.getByText('附件', {exact: true}).click()
    await expect(names).toHaveText(['目录', ...options[4][1]])
    await expect(page.getByRole('button', {name: '上传文件'})).toBeDisabled()
  })
}

import {test, expect, type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'

const appId = 'attachment-app'
const root = `/api/apps/${appId}`
const recordsPath = `${root}/forms/orders/records`
const bucketPath = '/api/projects/storage-project/buckets'
const objectPrefix = `${bucketPath}/default/objects/${appId}/orders/`
const image = {name: '图,片.png', mimeType: 'image/png', buffer: readFileSync(new URL('../public/favicon.png', import.meta.url))}
const pdf = {name: '说明.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF')}
const zip = {name: '资料.zip', mimeType: 'application/zip', buffer: Buffer.from('zip bytes')}

async function setup(page: Page, {failName, pending, subform = false}: {failName?: string; pending?: Promise<void>; subform?: boolean} = {}) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const fields = [
    {name: 'title', label: '名称', type: 'TEXT', required: true},
    {name: 'files', label: '附件', type: 'FILE'},
    {name: 'photos', label: '图片', type: 'IMAGE'},
    {name: 'readonly', label: '只读附件', type: 'FILE'},
  ]
  const form = {name: 'orders', label: '订单', displayField: 'title', builtin: false, fields,
    layout: {items: [...fields.map(field => ({type: 'FIELD', name: field.name, readonly: field.name === 'readonly', width: 'HALF'})),
      ...(subform ? [{type: 'SUBFORM', formName: 'lines', referenceField: 'order_id', width: 'FULL'}] : [])]}, viewTabs: []}
  const child = {name: 'lines', label: '订单明细', builtin: false, fields: [{name: 'files', label: '明细附件', type: 'FILE'}],
    layout: {items: [{type: 'FIELD', name: 'files', width: 'FULL'}]}, viewTabs: []}
  const app = {id: appId, projectId: 'storage-project', name: '附件验证', enabled: true, primaryColor: 'blue'}
  let record: Record<string, unknown> = {id: 'first', title: '附件订单', files: null}
  const writes: Record<string, unknown>[] = []
  const uploads: {url: string; path: string; auth?: string; type?: string; bytes: Buffer | null}[] = []
  const reads: {url: string; auth?: string}[] = []
  const bucketCreates: unknown[] = []
  const childWrites: Record<string, unknown>[] = []
  const objects = new Map<string, Buffer>()
  let bucketExists = false
  let failed = false
  await page.addInitScript(() => {
    localStorage.setItem('flexmodel-apps.auth.token', 'attachment-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
  })
  await page.route('**/api/**', async route => {
    const request = route.request()
    const {pathname, search} = new URL(request.url())
    const method = request.method()
    if (pathname.endsWith('/approvals')) return route.fulfill({json: []})
    if (pathname === `${root}/forms/lines`) return route.fulfill({json: child})
    if (pathname === `${root}/forms/lines/records`) {
      if (method === 'POST') {
        childWrites.push(request.postDataJSON())
        return route.fulfill({json: {...request.postDataJSON(), id: 'line1'}})
      }
      return route.fulfill({json: {list: [], total: 0}})
    }
    if (pathname === bucketPath) {
      if (method === 'POST') {bucketExists = true; bucketCreates.push(request.postDataJSON())}
      return route.fulfill({json: method === 'POST' ? {name: 'default'} : bucketExists ? [{name: 'default'}] : []})
    }
    if (pathname.includes('/buckets/default/objects/')) {
      if (method === 'PUT') {
        await pending
        const path = decodeURIComponent(pathname.split('/objects/')[1])
        if (failName && path.endsWith(failName) && !failed) {
          failed = true
          return route.fulfill({status: 500, json: {message: '存储暂时不可用'}})
        }
        const url = `${pathname}?version=uploaded`
        const bytes = request.postDataBuffer()
        uploads.push({url, path, auth: request.headers().authorization, type: request.headers()['content-type'], bytes})
        objects.set(url, bytes ?? Buffer.alloc(0))
        return route.fulfill({json: {url, path, name: path.split('/').pop()}})
      }
      if (method === 'GET') {
        reads.push({url: pathname + search, auth: request.headers().authorization})
        return route.fulfill({contentType: 'application/octet-stream', body: objects.get(pathname + search) ?? image.buffer})
      }
      throw new Error(`不应删除存储对象：${method}`)
    }
    if (pathname.startsWith(recordsPath)) {
      if (method === 'POST' || method === 'PUT') {
        const input = request.postDataJSON()
        writes.push(input)
        record = {...record, ...input}
      }
      return route.fulfill({json: pathname === recordsPath && method === 'GET' ? {list: [record], total: 1} : record})
    }
    const json = pathname === root ? app : pathname === '/api/apps' ? [app]
      : pathname === `${root}/forms/orders` ? form : pathname === `${root}/forms` ? [form]
        : pathname === `${root}/menus` ? [{id: 'orders', type: 'ITEM', name: '订单', target: {type: 'FORM', id: 'orders'}, children: []}]
          : pathname === '/api/notifications/summary' ? {version: '0', unread: 0, byCategory: {}, apps: []}
            : pathname === '/api/notifications' ? {list: [], total: 0} : []
    return route.fulfill({json})
  })
  await page.goto(`/#/apps/${appId}/orders`)
  await expect(page.getByRole('row').filter({hasText: '附件订单'})).toBeVisible()
  return {errors, writes, uploads, reads, bucketCreates, childWrites}
}

async function edit(page: Page) {
  await page.getByRole('row').filter({hasText: '附件订单'}).getByTitle('编辑', {exact: true}).click()
  const drawer = page.getByRole('dialog', {name: '编辑订单', exact: true})
  await expect(drawer.getByPlaceholder('请输入名称')).toHaveValue('附件订单')
  return drawer
}

test('多文件按应用/表单路径上传，逗号分隔保存并回填，图片/PDF预览及下载可用', async ({page}) => {
  const {uploads, reads, writes, bucketCreates, errors} = await setup(page)
  let drawer = await edit(page)
  await expect(drawer.getByPlaceholder('请输入附件')).toHaveCount(0)
  await expect(drawer.locator('input[type=file]')).toHaveCount(2)
  await drawer.getByLabel('上传附件', {exact: true}).setInputFiles([image, pdf, zip])
  await expect(drawer.getByRole('button', {name: '移除 资料.zip', exact: true})).toBeVisible()
  expect(uploads).toHaveLength(3)
  expect(bucketCreates).toEqual([{name: 'default', description: '应用附件', visibility: 'PRIVATE'}])
  for (const upload of uploads) {
    expect(upload.url.startsWith(objectPrefix)).toBe(true)
    expect(upload.path.startsWith(`${appId}/orders/`)).toBe(true)
    expect(upload.auth).toBe('Bearer attachment-test')
    expect(upload.type).toBe('application/octet-stream')
    expect(upload.url).not.toContain(',')
  }
  expect(uploads[0].bytes).toEqual(image.buffer)
  await drawer.getByRole('button', {name: '预览 图,片.png', exact: true}).click()
  let preview = page.getByRole('dialog', {name: '图,片.png', exact: true})
  await expect(preview.getByRole('img')).toHaveJSProperty('naturalWidth', 100)
  await page.screenshot({path: 'artifacts/attachments-image-preview.png', animations: 'disabled'})
  await page.keyboard.press('Escape')
  await drawer.getByRole('button', {name: '预览 说明.pdf', exact: true}).click()
  preview = page.getByRole('dialog', {name: '说明.pdf', exact: true})
  await expect(preview.locator('iframe')).toHaveAttribute('src', /^blob:/)
  await page.keyboard.press('Escape')
  await expect(drawer.getByRole('button', {name: '预览 资料.zip', exact: true})).toHaveCount(0)
  const downloadEvent = page.waitForEvent('download')
  await drawer.getByRole('button', {name: '下载 资料.zip', exact: true}).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('资料.zip')
  expect(await download.failure()).toBeNull()
  await drawer.getByRole('button', {name: '保存', exact: true}).click()
  drawer = page.getByRole('dialog', {name: '附件订单', exact: true})
  await expect(drawer.getByRole('button', {name: '预览 图,片.png', exact: true})).toBeVisible()
  expect(writes[0].files).toBe(uploads.map(file => file.url).join(','))
  await expect(drawer.getByRole('button', {name: /^移除 /})).toHaveCount(0)
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.screenshot({path: 'artifacts/attachments-readonly-dark.png', animations: 'disabled'})
  await drawer.getByRole('button', {name: '编辑', exact: true}).click()
  drawer = page.getByRole('dialog', {name: '编辑订单', exact: true})
  await expect(drawer.getByRole('button', {name: /^移除 /})).toHaveCount(3)
  for (const name of ['图,片.png', '说明.pdf', '资料.zip']) await drawer.getByRole('button', {name: `移除 ${name}`, exact: true}).click()
  await drawer.getByRole('button', {name: '保存', exact: true}).click()
  expect(writes[1].files).toBeNull()
  expect(reads.length).toBeGreaterThan(2)
  expect(reads.every(read => read.auth === 'Bearer attachment-test')).toBe(true)
  expect(errors).toEqual([])
})

test('部分上传失败保留成功文件，重选可重试且同名文件不会覆盖', async ({page}) => {
  const {uploads, writes, errors} = await setup(page, {failName: '说明.pdf'})
  const drawer = await edit(page)
  await drawer.getByLabel('上传附件', {exact: true}).setInputFiles([image, pdf])
  await expect(drawer.getByRole('alert')).toContainText('说明.pdf：存储暂时不可用')
  await expect(drawer.getByRole('button', {name: '移除 图,片.png', exact: true})).toBeVisible()
  await drawer.getByLabel('上传附件', {exact: true}).setInputFiles([image, pdf])
  await expect(drawer.getByRole('button', {name: '移除 说明.pdf', exact: true})).toBeVisible()
  expect(uploads).toHaveLength(3)
  expect(uploads[0].path).not.toBe(uploads[1].path)
  await drawer.getByRole('button', {name: '保存', exact: true}).click()
  expect(String(writes[0].files).split(',')).toHaveLength(3)
  expect(errors).toEqual([])
})

test('多个字段上传时禁止提前保存，图片字段支持多选并限制为图片', async ({page}) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => {release = resolve})
  const {writes, uploads, errors} = await setup(page, {pending})
  const drawer = await edit(page)
  try {
    await drawer.getByLabel('上传附件', {exact: true}).setInputFiles(zip)
    await drawer.getByLabel('上传图片', {exact: true}).setInputFiles([image, {...image, name: '第二张.png'}])
    await expect(drawer.getByRole('button', {name: '保存', exact: true})).toBeDisabled()
    expect(writes).toHaveLength(0)
  } finally {release()}
  await expect(drawer.getByRole('button', {name: '保存', exact: true})).toBeEnabled()
  expect(uploads).toHaveLength(3)
  await drawer.getByLabel('上传图片', {exact: true}).setInputFiles(pdf)
  await expect(drawer.getByRole('alert')).toContainText('请选择图片文件')
  await page.setViewportSize({width: 375, height: 900})
  await page.screenshot({path: 'artifacts/attachments-mobile.png', animations: 'disabled'})
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
  await drawer.getByRole('button', {name: '保存', exact: true}).click()
  expect(String(writes[0].photos).split(',')).toHaveLength(2)
  expect(errors).toEqual([])
})

test('关闭上传中的新建表单后，迟到响应不会写入下一次新建', async ({page}) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => {release = resolve})
  const {writes, errors} = await setup(page, {pending})
  try {
    await page.getByRole('button', {name: '新建', exact: true}).click()
    const drawer = page.getByRole('dialog', {name: '新建订单', exact: true})
    await drawer.getByLabel('上传附件', {exact: true}).setInputFiles(zip)
    await expect(drawer.getByRole('button', {name: '保存', exact: true})).toBeDisabled()
    await drawer.getByRole('button', {name: '取消', exact: true}).click()
    await expect(drawer).not.toBeVisible()
    release()
    await page.getByRole('button', {name: '新建', exact: true}).click()
    await drawer.getByPlaceholder('请输入名称').fill('下一条订单')
    await expect(drawer.getByRole('button', {name: /^移除 /})).toHaveCount(0)
    await drawer.getByRole('button', {name: '保存', exact: true}).click()
    expect(writes[0].files).toBeNull()
    expect(errors).toEqual([])
  } finally {release()}
})

test('子表新增复用上传控件，使用子表标识作为上传目录', async ({page}) => {
  const {uploads, childWrites, errors} = await setup(page, {subform: true})
  const drawer = await edit(page)
  await drawer.getByRole('button', {name: '新增', exact: true}).click()
  const child = page.getByRole('dialog', {name: '新建订单明细', exact: true})
  await child.getByLabel('上传明细附件', {exact: true}).setInputFiles([image, zip])
  await expect(child.getByRole('button', {name: '移除 资料.zip', exact: true})).toBeVisible()
  expect(uploads).toHaveLength(2)
  expect(uploads.every(upload => upload.path.startsWith(`${appId}/lines/`))).toBe(true)
  await child.getByRole('button', {name: '保存', exact: true}).click()
  await expect(child).not.toBeVisible()
  expect(childWrites[0].files).toBe(uploads.map(upload => upload.url).join(','))
  expect(errors).toEqual([])
})

import {expect, type Page, test} from '@playwright/test'

const app = {
  id: 'package-ui',
  projectId: 'package-ui',
  name: '进销存管理',
  description: '采购、库存与供应商协同',
  iconName: 'Boxes',
  primaryColor: 'blue',
  enabled: true,
  owner: 'admin',
  createdAt: '2026-10-20 09:00:00',
  updatedAt: '2026-10-30 10:24:00',
}

const forms = [
  {name: 'f_product', label: '商品档案', fieldCount: 18, dataRows: 320, hiddenFieldCount: 2},
  {name: 'f_purchase_order', label: '采购订单', fieldCount: 22, dataRows: 156, hiddenFieldCount: 3},
  {name: 'f_purchase_order_item', label: '采购订单明细', fieldCount: 8, dataRows: 460, hiddenFieldCount: 0},
  {name: 'f_supplier', label: '供应商', fieldCount: 14, dataRows: 80, hiddenFieldCount: 1},
  {name: 'f_warehouse', label: '仓库', fieldCount: 9, dataRows: 12, hiddenFieldCount: 0},
  {name: 'f_stock_movement', label: '库存流水', fieldCount: 12, dataRows: 258, hiddenFieldCount: 1},
]
const totalRecords = forms.reduce((total, form) => total + form.dataRows, 0)
const totalFields = forms.reduce((total, form) => total + form.fieldCount, 0)

const resources = [
  {key: 'navigation', label: '导航', count: 12, detail: '父节点优先重建，节点 ID 重新分配', included: true},
  {key: 'workbenches', label: '工作台', count: 2, detail: '工作台 ID 重新生成，快捷入口重写', included: true},
  {key: 'approvals', label: '审批流程', count: 1, detail: '仅导入托管流程，部署后恢复启用', included: true},
  {key: 'authorizations', label: '数据权限', count: 3, detail: '规则 ID 重新生成', included: true},
  {key: 'records', label: '记录数据', count: totalRecords, detail: '保留业务主键与业务引用', included: true},
]

const template = {
  id: 'erp-system',
  name: 'ERP 管理系统',
  description: '企业资源计划管理应用：供应商与物料基础数据、采购订单主子表管理、订单审批流程与经营看板',
  category: '企业管理',
  iconName: 'Container',
  formCount: 4,
  includesData: true,
  exportedAt: '2026-10-30T09:56:31Z',
}

function previewOf(uploadId: string, invalid: boolean) {
  return {
    uploadId,
    planHash: `hash-${uploadId}`,
    expiresAt: Date.now() + 30 * 60 * 1000,
    status: invalid ? 'INVALID' : 'READY',
    source: {
      appId: 'demo-scm',
      appName: '进销存管理',
      description: '采购、库存与供应商协同',
      exportedAt: '2026-10-30 10:24',
      formatVersion: 1,
      flexmodelVersion: '0.9.0',
    },
    package: {
      fileName: invalid ? 'invalid.flexmodel.zip' : 'scm.flexmodel.zip',
      size: 3897344,
      hasData: true,
      totalRecords,
      totalFields
    },
    forms,
    resources,
    warnings: [
      '附件对象不复制，FILE/IMAGE 等字段保留源 URL，导入后依赖源环境可访问。',
      'owner_id / created_by / updated_by 归属导入人，created_at / updated_at 使用导入时间。',
      '身份成员按目标目录 ID 校验存在性，请核对两个实例的语义一致性。',
    ],
    issues: invalid ? [{
      code: 'DIRECTORY_MEMBER_MISSING',
      path: 'navigation[3].visibility[0].id',
      message: '导航「采购分析」引用的角色 role_sales_lead 在目标目录中不存在。',
    }] : [],
    defaultAppName: '进销存管理-副本',
  }
}

function templatePreviewOf() {
  const preview = previewOf('upload_template', false)
  return {
    ...preview,
    templateId: template.id,
    defaultAppName: template.name,
    package: {...preview.package, fileName: 'erp-system.flexmodel.zip', size: 35870},
    source: {...preview.source, appId: 'erp_system', appName: 'ERP管理系统'},
  }
}

async function setup(page: Page, dark = false, templates: unknown[] = [template]) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(({dark}) => {
    localStorage.setItem('flexmodel-apps.auth.token', 'package-ui-test')
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
    localStorage.setItem('night', String(dark))
  }, {dark})
  await page.route('**/api/**', async route => {
    const {pathname} = new URL(route.request().url())
    if (pathname === '/api/apps') return route.fulfill({json: [app]})
    if (pathname === `/api/apps/${app.id}`) return route.fulfill({json: app})
    if (pathname === '/api/notifications') return route.fulfill({json: {list: [], total: 0}})
    if (pathname === '/api/notifications/summary') {
      return route.fulfill({json: {version: '0', unread: 0, byCategory: {}, apps: []}})
    }
    if (pathname === `/api/apps/${app.id}/package-exports`) {
      return route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="app.flexmodel.zip"; filename*=UTF-8\'\'app.flexmodel.zip',
        },
        body: Buffer.from('mock-zip-content'),
      })
    }
    if (pathname === '/api/app-packages/templates' && route.request().method() === 'GET') {
      return route.fulfill({json: templates})
    }
    if (pathname === '/api/app-packages/templates/erp-system/imports' && route.request().method() === 'POST') {
      return route.fulfill({json: templatePreviewOf()})
    }
    if (pathname === '/api/app-packages/imports' && route.request().method() === 'POST') {
      const body = route.request().postDataBuffer()?.toString('latin1') ?? ''
      return route.fulfill({json: previewOf(`upload_${Date.now()}`, body.includes('invalid.flexmodel.zip'))})
    }
    if (/^\/api\/app-packages\/imports\/[^/]+\/commit$/.test(pathname)) {
      return route.fulfill({
        json: {
          uploadId: 'upload_committed',
          status: 'COMMITTED',
          appId: 'app_imported_1',
          appName: '进销存管理-副本',
          importedAt: '2026-10-30 17:30',
          totalRecords,
          forms: forms.map(form => ({name: form.name, label: form.label, count: form.dataRows})),
          error: null,
        }
      })
    }
    if (/^\/api\/app-packages\/imports\/[^/]+$/.test(pathname) && route.request().method() === 'GET') {
      return route.fulfill({json: previewOf('upload_status', false)})
    }
    return route.fulfill({json: []})
  })
  return errors
}

async function upload(page: Page, name: string) {
  await page.getByLabel('上传应用包文件').setInputFiles({
    name,
    mimeType: 'application/zip',
    buffer: Buffer.from('mock-package'),
  })
}

async function openExportDialog(page: Page) {
  await page.getByRole('button', {name: '更多操作'}).click()
  await page.getByRole('menuitem', {name: '导出应用'}).click()
  return page.getByRole('dialog')
}

test('导出弹窗确认数据范围并直接下载', async ({page}) => {
  const errors = await setup(page)
  await page.goto('/#/admin/apps')
  const dialog = await openExportDialog(page)
  await expect(dialog.getByRole('heading', {name: '导出应用'})).toBeVisible()
  await expect(dialog.getByRole('checkbox', {name: '包含记录数据'})).not.toBeChecked()
  await page.screenshot({path: 'artifacts/app-packages-export-light.png', animations: 'disabled'})

  await dialog.getByRole('checkbox', {name: '包含记录数据'}).click()
  await expect(dialog.getByRole('checkbox', {name: '包含记录数据'})).toBeChecked()
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', {name: '导出', exact: true}).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('.flexmodel.zip')
  await expect(dialog).toBeHidden()
  await expect(page.getByText('应用包已生成，下载已开始。')).toBeVisible()
  expect(errors).toEqual([])
})

test('应用列表更多菜单与基本设置均可直接打开导出弹窗', async ({page}) => {
  const errors = await setup(page)
  await page.goto('/#/admin/apps')
  let dialog = await openExportDialog(page)
  await expect(dialog.getByRole('heading', {name: '导出应用'})).toBeVisible()
  await expect(page).toHaveURL(/#\/admin\/apps$/)
  await dialog.getByRole('button', {name: '取消'}).click()
  await expect(dialog).toBeHidden()

  await page.goto(`/#/admin/apps/${app.id}/settings/basic`)
  await page.getByRole('button', {name: '导出应用'}).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', {name: '导出应用'})).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`#/admin/apps/${app.id}/settings/basic$`))
  await dialog.getByRole('button', {name: '取消'}).click()
  await expect(dialog).toBeHidden()
  expect(errors).toEqual([])
})

test('导入向导：上传、预览、确认并完成，INVALID 阻断确认', async ({page}) => {
  const errors = await setup(page)
  await page.goto('/#/admin/apps')
  await expect(page.getByText(app.name, {exact: true})).toBeVisible()
  await page.getByRole('button', {name: '导入应用'}).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', {name: '导入应用包'})).toBeVisible()
  await upload(page, 'scm.flexmodel.zip')
  await expect(dialog.getByText('校验通过')).toBeVisible()
  await expect(dialog.getByRole('heading', {name: '进销存管理'})).toBeVisible()
  await expect(dialog.getByLabel('新应用名称')).toHaveValue('进销存管理-副本')
  await expect(dialog.getByText('1,286').first()).toBeVisible()
  await page.screenshot({path: 'artifacts/app-packages-import-preview-light.png', animations: 'disabled'})
  await dialog.getByText('表单与记录').scrollIntoViewIfNeeded()
  await expect(dialog.getByText('隐藏字段').first()).toBeVisible()
  await page.screenshot({path: 'artifacts/app-packages-import-forms-light.png', animations: 'disabled'})

  await dialog.getByRole('button', {name: '确认导入'}).click()
  await expect(dialog.getByRole('heading', {name: '导入完成'})).toBeVisible()
  await expect(dialog.getByText(/已创建应用/)).toBeVisible()
  await page.screenshot({path: 'artifacts/app-packages-import-success-light.png', animations: 'disabled'})
  await dialog.getByRole('button', {name: '完成'}).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('button', {name: '导入应用'}).click()
  await upload(page, 'invalid.flexmodel.zip')
  await expect(dialog.getByText('存在阻断项')).toBeVisible()
  await expect(dialog.getByRole('button', {name: '确认导入'})).toBeDisabled()
  await expect(dialog.getByRole('alert')).toContainText('role_sales_lead')
  await page.screenshot({path: 'artifacts/app-packages-import-invalid-light.png', animations: 'disabled'})
  await dialog.getByRole('button', {name: '取消'}).click()
  expect(errors).toEqual([])
})

test('从模板创建：入口、画廊、预览直达与提交', async ({page}) => {
  const errors = await setup(page)
  await page.goto('/#/admin/apps')
  await page.getByRole('button', {name: '新建应用'}).click()
  await page.getByRole('menuitem', {name: '从模板创建'}).click()

  const gallery = page.getByRole('dialog')
  await expect(gallery.getByRole('heading', {name: '从模板创建应用'})).toBeVisible()
  await expect(gallery.getByText(template.name)).toBeVisible()
  await expect(gallery.getByText('4 个表单')).toBeVisible()
  await expect(gallery.getByText('含示例数据')).toBeVisible()
  await page.screenshot({path: 'artifacts/app-templates-gallery-light.png', animations: 'disabled'})

  await gallery.getByRole('button').filter({hasText: template.name}).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', {name: '创建应用'})).toBeVisible()
  await expect(dialog.getByRole('button', {name: '重新选择'})).toHaveCount(0)
  await expect(dialog.getByText('校验通过')).toBeVisible()
  await expect(dialog.getByLabel('新应用名称')).toHaveValue(template.name)
  await page.screenshot({path: 'artifacts/app-templates-preview-light.png', animations: 'disabled'})

  await dialog.getByRole('button', {name: '确认导入'}).click()
  await expect(dialog.getByRole('heading', {name: '创建完成'})).toBeVisible()
  await dialog.getByRole('button', {name: '完成'}).click()
  await expect(dialog).toBeHidden()
  expect(errors).toEqual([])
})

test('模板目录为空时隐藏从模板创建入口', async ({page}) => {
  const errors = await setup(page, false, [])
  await page.goto('/#/admin/apps')
  await page.getByRole('button', {name: '新建应用'}).click()
  await expect(page.getByRole('menuitem', {name: '空白应用'})).toBeVisible()
  await expect(page.getByRole('menuitem', {name: '从模板创建'})).toHaveCount(0)
  expect(errors).toEqual([])
})

test('夜间模式下导出弹窗与导入预览无回归', async ({page}) => {
  const errors = await setup(page, true)
  await page.goto('/#/admin/apps')
  const exportDialog = await openExportDialog(page)
  await expect(exportDialog.getByRole('heading', {name: '导出应用'})).toBeVisible()
  await page.screenshot({path: 'artifacts/app-packages-export-dark.png', animations: 'disabled'})
  await exportDialog.getByRole('button', {name: '取消'}).click()

  await page.getByRole('button', {name: '导入应用'}).click()
  await upload(page, 'scm.flexmodel.zip')
  await expect(page.getByRole('dialog').getByText('校验通过')).toBeVisible()
  await page.screenshot({path: 'artifacts/app-packages-import-preview-dark.png', animations: 'disabled'})
  expect(errors).toEqual([])
})

test('手机宽度下导出弹窗与导入预览不产生横向溢出', async ({page}) => {
  const errors = await setup(page)
  await page.setViewportSize({width: 390, height: 844})
  await page.goto('/#/admin/apps')
  const exportDialog = await openExportDialog(page)
  await expect(exportDialog.getByRole('heading', {name: '导出应用'})).toBeVisible()
  const exportBox = await exportDialog.boundingBox()
  expect(exportBox?.width ?? 0).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({path: 'artifacts/app-packages-export-mobile.png', animations: 'disabled'})
  await exportDialog.getByRole('button', {name: '取消'}).click()

  await page.getByRole('button', {name: '导入应用'}).click()
  await upload(page, 'scm.flexmodel.zip')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('校验通过')).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box?.width ?? 0).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({path: 'artifacts/app-packages-import-mobile.png', animations: 'disabled'})
  await dialog.getByText('表单与记录').scrollIntoViewIfNeeded()
  await expect(dialog.getByText('隐藏字段').last()).toBeVisible()
  await page.screenshot({path: 'artifacts/app-packages-import-mobile-forms.png', animations: 'disabled'})
  expect(errors).toEqual([])
})

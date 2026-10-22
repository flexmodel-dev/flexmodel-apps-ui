// Invoked by ApprovalFlowResourceTest while its isolated Quarkus/SQLite server is running.
import {chromium, expect} from '@playwright/test'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {resolve, dirname} from 'node:path'
import {mkdir} from 'node:fs/promises'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const api = process.env.APPROVAL_TEST_API
const token = process.env.APPROVAL_TEST_TOKEN
if (!api || !token) throw new Error('该测试由 Quarkus 集成测试提供独立后端和登录凭证')
const frontend = 'http://127.0.0.1:5183'
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5183', '--strictPort'], {
  cwd: root,
  env: {...process.env, VITE_API_TARGET: api},
  stdio: 'ignore',
  windowsHide: true
})
const errors = []
let browser

async function request(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(api + '/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    }, ...(body ? {body: JSON.stringify(body)} : {})
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(path + ': ' + response.status + ' ' + JSON.stringify(result))
  return result
}

try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(frontend)).ok) break
    } catch {
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  browser = await chromium.launch({headless: true})
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, locale: 'zh-CN'})
  await context.addInitScript(({token}) => {
    localStorage.setItem('flexmodel-apps.auth.token', token);
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
  }, {token})
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  const suffix = Date.now().toString(36), form = 'browser_approval_' + suffix
  await request('/apps/dev_test/forms', {name: form, label: '浏览器审批验收', createDisplayField: true})
  await request('/apps/dev_test/forms/' + form + '/layout', {
    items: [{
      type: 'FIELD',
      name: 'name',
      width: 'FULL'
    }]
  }, 'PUT')
  const record = await request('/apps/dev_test/forms/' + form + '/records', {name: '浏览器完整审批记录'})
  const menu = await request('/apps/dev_test/menus', {
    type: 'ITEM',
    name: '浏览器审批表单',
    target: {type: 'FORM', id: form}
  })
  const node = (key, type, config, order, incoming, outgoing) => ({
    key,
    type,
    incoming,
    outgoing,
    properties: {
      name: key, config, designer: {parent: '', order}, ...(type === 2 ? {
        form: {
          kind: 'app',
          name: form
        }
      } : {})
    }
  })
  const flow = await request('/apps/dev_test/approval-flows', {
    flow_name: '浏览器真实审批-' + suffix, flow_key: '', remark: '', status: 1, flow_model: JSON.stringify({
      flowElementList: [
        node('start', 2, {kind: 'start'}, 0, [], ['sequence_start']),
        node('review', 4, {
          kind: 'approval',
          signMode: 'all',
          rules: [{id: 'rule', source: 'initiator', values: [], scope: 'self', includeChildren: false}]
        }, 1, ['sequence_start'], ['sequence_review']),
        node('end', 3, {kind: 'end'}, 2, ['sequence_review'], []),
        {key: 'sequence_start', type: 1, incoming: ['start'], outgoing: ['review'], properties: {}},
        {key: 'sequence_review', type: 1, incoming: ['review'], outgoing: ['end'], properties: {}}
      ]
    })
  })
  await page.goto(frontend + '/#/admin/apps/dev_test/approvals/' + flow.flow_module_id + '/design')
  await page.locator('.approval-node[data-node-id="review"]').click()
  await page.getByRole('textbox', {name: '节点名称', exact: true}).fill('真实签核节点')
  await page.getByRole('button', {name: '保存草稿', exact: true}).click()
  await expect(page.getByText('流程草稿已保存到服务器', {exact: true})).toBeVisible()
  await page.reload()
  await expect(page.locator('.approval-node[data-node-id="review"]')).toContainText('真实签核节点')
  await page.getByTitle('流程操作', {exact: true}).click()
  await page.getByText('发布并启用', {exact: true}).click()
  await expect(page.getByText('流程已发布并启用', {exact: true})).toBeVisible()
  await mkdir(resolve(root, 'artifacts'), {recursive: true})
  await page.screenshot({animations: 'disabled', path: resolve(root, 'artifacts/approvals-backend-designer.png')})
  await page.goto(frontend + '/#/apps/dev_test/' + menu.id + '/view/' + record.id)
  await expect(page.getByRole('button', {name: '提交审批', exact: true})).toBeEnabled()
  await page.getByRole('button', {name: '提交审批', exact: true}).click()
  await page.getByRole('button', {name: '确认提交', exact: true}).click()
  await expect(page.getByText('记录已锁定', {exact: true})).toBeVisible({timeout: 15000})
  await expect(page.getByRole('button', {name: '编辑', exact: true})).toBeDisabled()
  await page.goto(frontend + '/#/approval/home')
  await expect(page.getByRole('button').filter({hasText: flow.flow_name})).toBeVisible({timeout: 20000})
  await page.getByRole('button').filter({hasText: flow.flow_name}).click()
  await expect(page.getByText('浏览器完整审批记录', {exact: true})).toBeVisible()
  await page.getByRole('textbox', {name: '审批意见', exact: true}).fill('浏览器实际后端验收')
  await page.getByRole('dialog').evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {
    })))
  })
  await page.screenshot({animations: 'disabled', path: resolve(root, 'artifacts/approvals-backend-signing.png')})
  await page.getByRole('button', {name: '同意', exact: true}).click()
  await expect(page.getByText('已通过', {exact: true})).toBeVisible({timeout: 20000})
  await page.getByRole('button', {name: 'Close', exact: true}).count().then(async count => {
    if (count) await page.getByRole('button', {name: 'Close', exact: true}).click()
  })
  await page.keyboard.press('Escape')
  await page.getByRole('button', {name: '我提交的', exact: true}).click()
  await expect(page.getByRole('button').filter({hasText: flow.flow_name})).toContainText('已通过')
  await page.setViewportSize({width: 1280, height: 800})
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('night', 'true')
  })
  await page.screenshot({animations: 'disabled', path: resolve(root, 'artifacts/approvals-backend-center-dark.png')})
  await page.goto(frontend + '/#/apps/dev_test/' + menu.id + '/view/' + record.id)
  await expect(page.getByRole('button', {name: '编辑', exact: true})).toBeEnabled()
  if (errors.length) throw new Error('浏览器异常: ' + errors.join('; '))
  console.log('PASS: 真实后端设计保存、发布、记录提交、待办签核、完成解锁及明暗桌面布局')
} finally {
  await browser?.close()
  server.kill()
}

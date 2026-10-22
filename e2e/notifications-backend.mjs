// Invoked by NotificationResourceTest against an isolated real backend; credentials stay in the environment.
import {chromium, expect} from '@playwright/test'
import {spawn} from 'node:child_process'
import {resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {mkdir} from 'node:fs/promises'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const api = process.env.NOTIFICATION_TEST_API, token = process.env.NOTIFICATION_TEST_TOKEN
if (!api || !token) throw Error('需要隔离后端与登录会话')
const frontend = 'http://127.0.0.1:5184'
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5184', '--strictPort'], {
  cwd: root,
  env: {...process.env, VITE_API_TARGET: api},
  stdio: 'ignore',
  windowsHide: true
})
let browser

async function request(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(api + '/api' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }, ...(body ? {body: JSON.stringify(body)} : {})
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw Error(path + ': ' + response.status + ' ' + JSON.stringify(result))
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
  const context = await browser.newContext({
    viewport: {width: 1440, height: 1000},
    locale: 'zh-CN',
    permissions: ['notifications']
  })
  const errors = [], streams = new Set()
  await context.addInitScript(({token}) => {
    if (location.origin === 'null') return
    localStorage.setItem('flexmodel-apps.auth.token', token);
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
    window.__focus = false;
    window.__alerts = [];
    window.__notificationErrors = []
    document.hasFocus = () => window.__focus
    // Headless Chromium reports denied for native Notification even when permissions.query is granted.
    // This spy verifies the app's API calls; it does not pretend to render an OS desktop popup.
    window.Notification = class {
      static get permission() {
        return localStorage.getItem('__notificationPermission') || 'default'
      }

      static async requestPermission() {
        localStorage.setItem('__notificationPermission', 'granted');
        return 'granted'
      }

      constructor(title, options) {
        if (this.constructor.permission !== 'granted') throw Error('未授权');
        window.__alerts.push({title, body: options?.body, tag: options?.tag});
        window.__lastNotification = this
      }

      close() {
      }
    }
  }, {token})
  context.on('page', page => {
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (request.url().includes('/api/notifications/stream')) streams.add(request)
    })
    page.on('requestfinished', request => streams.delete(request));
    page.on('requestfailed', request => streams.delete(request))
  })
  const page = await context.newPage()
  await page.goto(frontend + '/#/notifications');
  await expect(page.getByText('实时连接已建立')).toBeVisible()
  await page.getByRole('button', {name: '开启浏览器提醒'}).click()
  await expect(page.getByText('浏览器提醒已开启，页面在后台时显示系统通知')).toBeVisible()
  await page.evaluate(() => {
    window.__focus = true;
    window.dispatchEvent(new Event('focus'))
  })
  const sibling = await context.newPage();
  await sibling.goto(frontend + '/#/notifications')
  await expect(sibling.getByRole('heading', {name: '通知中心'})).toBeVisible()
  await expect.poll(() => streams.size).toBe(1)
  await page.bringToFront()
  await page.evaluate(() => {
    window.__focus = true;
    window.dispatchEvent(new Event('focus'))
  })
  const suffix = Date.now().toString(36), form = 'notice_browser_' + suffix
  await request('/apps/dev_test/forms', {name: form, label: '通知浏览器验收', createDisplayField: true})
  const record = await request('/apps/dev_test/forms/' + form + '/records', {name: '实时消息记录'})
  const rule = {id: 'initiator', source: 'initiator', values: [], scope: 'self', includeChildren: false}
  const configs = [{kind: 'start'}, {
    kind: 'notification',
    rules: [rule],
    titleTemplate: '实时节点-' + suffix,
    contentTemplate: '收到记录 {{record.name}}'
  }, {kind: 'approval', rules: [rule], signMode: 'all'}, {kind: 'end'}]
  const elements = []
  configs.forEach((config, i) => {
    const key = ['start', 'notify', 'review', 'end'][i]
    elements.push({
      key,
      type: i === 0 ? 2 : i === 3 ? 3 : 4,
      incoming: i ? ['sequence_' + ['start', 'notify', 'review', 'end'][i - 1]] : [],
      outgoing: i < 3 ? ['sequence_' + key] : [],
      properties: {
        name: key,
        config,
        designer: {parent: '', order: i, container: false}, ...(i === 0 ? {form: {kind: 'app', name: form}} : {})
      }
    })
    if (i < 3) elements.push({
      key: 'sequence_' + key,
      type: 1,
      incoming: [key],
      outgoing: [['start', 'notify', 'review', 'end'][i + 1]],
      properties: {conditionsequenceflow: '', defaultConditions: 'false'}
    })
  })
  const flow = await request('/apps/dev_test/approval-flows', {
    flow_name: '实时验收-' + suffix,
    flow_model: JSON.stringify({flowElementList: elements})
  })
  await request('/apps/dev_test/approval-flows/' + flow.flow_module_id + '/status', {
    status: 2,
    revision: flow.revision
  })
  const run = await request('/apps/dev_test/forms/' + form + '/records/' + record.id + '/approvals', {
    flowId: flow.flow_module_id,
    requestKey: 'notify-' + suffix
  })
  await expect(page.getByRole('status').getByText('实时节点-' + suffix, {exact: true})).toBeVisible({timeout: 20000})
  await expect(page.getByText('实时节点-' + suffix, {exact: true}).first()).toBeVisible()
  await expect.poll(async () => {
    const items = await request('/notifications?status=unread');
    return items.list.some(item => item.title === '实时节点-' + suffix)
  }).toBe(true)
  const notifications = await request('/notifications?status=all')
  const item = notifications.list.find(item => item.title === '实时节点-' + suffix)
  await page.goto(frontend + '/#/notifications?open=' + item.id)
  await expect(page.getByRole('dialog').filter({has: page.getByRole('heading', {name: item.title})})).toContainText('收到记录 实时消息记录')
  await expect.poll(async () => (await request('/notifications/' + item.id)).readAt).toBeTruthy()
  await expect.poll(async () => sibling.getByText(item.title, {exact: true}).count()).toBe(0)
  await page.keyboard.press('Escape')
  // Both tabs are in the background: the result must produce one system reminder.
  for (const tab of [page, sibling]) await tab.evaluate(() => {
    window.__focus = false;
    window.dispatchEvent(new Event('blur'));
    window.__alerts = []
  })
  await expect.poll(async () => (await request('/apps/dev_test/approval-instances/' + run.id)).tasks.some(task => task.status === 'PENDING' && task.user_id === 'admin'), {timeout: 15000}).toBe(true)
  const detail = await request('/apps/dev_test/approval-instances/' + run.id)
  const task = detail.tasks.find(task => task.status === 'PENDING' && task.user_id === 'admin')
  await request('/apps/dev_test/approval-tasks/' + task.id + '/decision', {
    decision: 'approve',
    comment: '',
    requestKey: 'decide-' + suffix
  })
  await expect.poll(async () => (await request('/apps/dev_test/approval-instances/' + run.id)).status).toBe('APPROVED')
  try {
    await expect.poll(async () => (await page.evaluate(() => window.__alerts.filter(item => item.body.startsWith('审批已通过')).length)) + (await sibling.evaluate(() => window.__alerts.filter(item => item.body.startsWith('审批已通过')).length)), {timeout: 15000}).toBe(1)
  } catch (error) {
    console.error('Notification diagnostics', JSON.stringify({
      pages: await Promise.all([page, sibling].map(tab => tab.evaluate(() => ({
        permission: Notification.permission,
        focused: document.hasFocus(),
        visibility: document.visibilityState,
        alerts: window.__alerts,
        errors: window.__notificationErrors,
        body: document.body.innerText.slice(-500)
      })))), inbox: await request('/notifications?status=all')
    }));
    throw error
  }
  const alerts = (await page.evaluate(() => window.__alerts)).concat(await sibling.evaluate(() => window.__alerts))
  expect(new Set(alerts.map(item => item.tag)).size).toBe(alerts.length)
  const systemPage = (await page.evaluate(() => window.__alerts.some(item => item.body.startsWith('审批已通过')))) ? page : sibling
  await systemPage.evaluate(() => window.__lastNotification.onclick())
  await expect(systemPage).toHaveURL(/notifications\?open=/)
  // Closing the connection owner hands the stream to the remaining page.
  const owner = [...streams][0].frame().page(), remaining = owner === page ? sibling : page
  await owner.close();
  await expect.poll(() => streams.size).toBe(1)
  await expect(remaining.getByText('实时连接已建立')).toBeVisible()
  await remaining.reload();
  await expect(remaining.getByText('实时连接已建立')).toBeVisible()
  expect(await remaining.evaluate(() => window.__alerts.length)).toBe(0)
  // Disconnect before producing new business messages; reconnect must restore them without popups.
  await context.setOffline(true)
  await remaining.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => streams.size).toBe(0)
  const offlineRecord = await request('/apps/dev_test/forms/' + form + '/records', {name: '离线补齐记录'})
  const offlineRun = await request('/apps/dev_test/forms/' + form + '/records/' + offlineRecord.id + '/approvals', {
    flowId: flow.flow_module_id,
    requestKey: 'offline-' + suffix
  })
  await expect.poll(async () => (await request('/notifications?status=all')).list.filter(item => item.instanceId === offlineRun.id).length, {timeout: 15000}).toBe(2)
  await context.setOffline(false)
  await remaining.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(remaining.getByText('实时连接已建立')).toBeVisible({timeout: 15000})
  await expect(remaining.getByText('收到记录 离线补齐记录', {exact: true})).toBeVisible()
  expect(await remaining.evaluate(() => window.__alerts.length)).toBe(0)
  await remaining.evaluate(() => localStorage.setItem('__notificationPermission', 'denied'))
  await remaining.reload()
  await expect(remaining.getByText('浏览器已禁用提醒，请在站点设置中开启')).toBeVisible()
  await expect(remaining.getByText('实时连接已建立')).toBeVisible()
  await expect(remaining.getByText('正在加载通知…')).not.toBeVisible()
  await mkdir(resolve(root, 'artifacts'), {recursive: true})
  await remaining.screenshot({path: resolve(root, 'artifacts/notifications-light.png'), fullPage: true})
  await remaining.getByTitle('切换到夜间模式').click()
  await remaining.screenshot({path: resolve(root, 'artifacts/notifications-dark.png'), fullPage: true})
  expect(errors).toEqual([])
  console.log('PASS: real approval/notification/SSE, foreground and background reminders, read sync, one tab stream, reconnect and screenshots')
} finally {
  await browser?.close();
  server.kill()
}

// Invoked by NotificationResourceTest against an isolated real backend; credentials stay in the environment.
import {expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {projectRoot, startFrontend, apiRequest, launchContext} from './harness.mjs'

const api = process.env.NOTIFICATION_TEST_API, token = process.env.NOTIFICATION_TEST_TOKEN,
  app = process.env.NOTIFICATION_TEST_APP
if (!api || !token || !app) throw Error('需要隔离后端与登录会话')
const {server, frontend} = await startFrontend(api, 5184)
const request = (path, body, method) => apiRequest(api, token, path, body, method)
let browser

try {
  const launched = await launchContext(token, {
    viewport: {width: 1440, height: 1000},
    permissions: ['notifications'],
  })
  browser = launched.browser
  const context = launched.context
  const errors = [], streams = new Set()
  await context.addInitScript(() => {
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
  })
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
  await request('/apps/' + app + '/forms', {name: form, label: '通知浏览器验收', createDisplayField: true})
  const record = await request('/apps/' + app + '/forms/' + form + '/records', {name: '实时消息记录'})
  const rule = {id: 'initiator', source: 'initiator', values: [], scope: 'self', includeChildren: false}
  const configs = [{
    kind: 'start',
    trigger: {type: 'MANUAL', formName: form, lockRecord: false}
  }, {
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
        designer: {parent: '', order: i, container: false}
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
  const flow = await request('/apps/' + app + '/flows', {
    name: '实时验收-' + suffix,
    model: {flowElementList: elements}
  })
  await request('/apps/' + app + '/flows/' + flow.id + '/publish', undefined, 'POST')
  const run = await request('/apps/' + app + '/flows/' + flow.id + '/instances', {
    recordId: record.id,
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
  await expect.poll(async () => (await request('/apps/' + app + '/flow-instances/' + run.id)).tasks.some(task => task.status === 'PENDING' && task.userId === 'admin'), {timeout: 15000}).toBe(true)
  const detail = await request('/apps/' + app + '/flow-instances/' + run.id)
  const task = detail.tasks.find(task => task.status === 'PENDING' && task.userId === 'admin')
  await request('/apps/' + app + '/flow-tasks/' + task.id + '/decisions', {
    decision: 'approve',
    comment: '',
    requestKey: 'decide-' + suffix
  })
  await expect.poll(async () => (await request('/apps/' + app + '/flow-instances/' + run.id)).status).toBe('SUCCEEDED')
  try {
    await expect.poll(async () => (await page.evaluate(() => window.__alerts.filter(item => item.body.startsWith('流程已完成')).length)) + (await sibling.evaluate(() => window.__alerts.filter(item => item.body.startsWith('流程已完成')).length)), {timeout: 15000}).toBe(1)
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
  const systemPage = (await page.evaluate(() => window.__alerts.some(item => item.body.startsWith('流程已完成')))) ? page : sibling
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
  await expect(remaining.getByText('实时连接已建立')).toHaveCount(0)
  const offlineRecord = await request('/apps/' + app + '/forms/' + form + '/records', {name: '离线补齐记录'})
  const offlineRun = await request('/apps/' + app + '/flows/' + flow.id + '/instances', {
    recordId: offlineRecord.id,
    requestKey: 'offline-' + suffix
  })
  await expect.poll(async () => (await request('/notifications?status=all')).list.filter(item => item.instanceId === offlineRun.id).length, {timeout: 15000}).toBe(2)
  await context.setOffline(false)
  await remaining.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(remaining.getByText('实时连接已建立')).toBeVisible({timeout: 40000})
  await expect(remaining.getByText('收到记录 离线补齐记录', {exact: true})).toBeVisible()
  expect(await remaining.evaluate(() => window.__alerts.length)).toBe(0)
  await remaining.evaluate(() => localStorage.setItem('__notificationPermission', 'denied'))
  await remaining.reload()
  await expect(remaining.getByText('浏览器已禁用提醒，请在站点设置中开启')).toBeVisible()
  await expect(remaining.getByText('实时连接已建立')).toBeVisible()
  await expect(remaining.getByText('正在加载通知…')).not.toBeVisible()
  await mkdir(resolve(projectRoot, 'artifacts'), {recursive: true})
  await remaining.screenshot({path: resolve(projectRoot, 'artifacts/notifications-light.png'), fullPage: true})
  await remaining.getByTitle('切换到夜间模式').click()
  await remaining.screenshot({path: resolve(projectRoot, 'artifacts/notifications-dark.png'), fullPage: true})
  expect(errors).toEqual([])
  console.log('PASS: real approval/notification/SSE, foreground and background reminders, read sync, one tab stream, reconnect and screenshots')
} finally {
  await browser?.close();
  server.kill()
}

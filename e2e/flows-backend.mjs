import {chromium} from '@playwright/test'
import {spawn} from 'node:child_process'
import {mkdirSync, createWriteStream} from 'node:fs'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const api = process.env.FLOW_TEST_API, token = process.env.FLOW_TEST_TOKEN, app = process.env.FLOW_TEST_APP
if (!api || !token || !app) throw new Error('Missing flow test environment')
const prefix = `/apps/${app}`
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function call(url, method = 'GET', body) {
  const response = await fetch(api + url, {
    method,
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  if (!response.ok) throw new Error(`${method} ${url}: ${response.status} ${await response.text()}`)
  return response.status === 204 ? null : response.json()
}

function model(trigger, tasks = []) {
  const nodes = [{id: 'start', kind: 'start', trigger}, ...tasks, {id: 'end', kind: 'end'}]
  const elements = []
  nodes.forEach((node, index) => {
    const {id, kind, ...config} = node
    elements.push({
      key: id,
      type: kind === 'start' ? 2 : kind === 'end' ? 3 : 4,
      incoming: index ? [`sequence_${nodes[index - 1].id}`] : [],
      outgoing: index < nodes.length - 1 ? [`sequence_${id}`] : [],
      properties: {
        name: kind === 'start' ? '开始' : kind === 'end' ? '结束' : id,
        config: {kind, ...config},
        designer: {parent: '', order: index, container: false}
      }
    })
    if (index < nodes.length - 1) elements.push({
      key: `sequence_${id}`,
      type: 1,
      incoming: [id],
      outgoing: [nodes[index + 1].id],
      properties: {conditionsequenceflow: '', defaultConditions: 'false'}
    })
  })
  return {flowElementList: elements}
}

async function create(name, trigger, tasks = []) {
  return call(`${prefix}/flows`, 'POST', {name, description: '真实浏览器闭环', model: model(trigger, tasks)})
}

async function waitFor(check, label) {
  const end = Date.now() + 30000
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await delay(200)
  }
  throw new Error(`Timed out: ${label}`)
}

mkdirSync(path.join(root, 'artifacts'), {recursive: true})
let server, browser, page
const base = 'http://127.0.0.1:5197'
try {
  try {
    await fetch(base)
  } catch {
    server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5197', '--strictPort'], {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const log = createWriteStream(path.join(root, 'artifacts/flows-vite.log'));
    server.stdout.pipe(log);
    server.stderr.pipe(log)
    await waitFor(async () => {
      try {
        return (await fetch(base)).ok
      } catch {
        return false
      }
    }, 'Vite startup')
  }
  const record = await call(`${prefix}/forms/orders/records`, 'POST', {name: '浏览器订单'})
  const manual = await create('浏览器人工流程', {type: 'MANUAL', formName: 'orders', lockRecord: false}, [
    {
      id: 'review',
      kind: 'approval',
      signMode: 'all',
      rules: [{id: 'admin', source: 'users', values: ['admin'], scope: 'self', includeChildren: false}]
    },
  ])
  await call(`${prefix}/flows/${manual.id}/publish`, 'POST')
  const run = await call(`${prefix}/flows/${manual.id}/instances`, 'POST', {
    recordId: record.id,
    requestKey: 'browser-manual'
  })
  await waitFor(async () => {
    const detail = await call(`${prefix}/flow-instances/${run.id}`);
    return detail.tasks.some(t => t.status === 'PENDING') && detail
  }, 'approval task')
  browser = await chromium.launch({headless: true})
  page = await browser.newPage({viewport: {width: 1440, height: 1000}})
  const errors = [];
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(({token}) => {
    localStorage.setItem('flexmodel-apps.auth.token', token);
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: '管理员', email: ''}))
  }, {token})
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/notifications/stream')) return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: ': workflow test\n\n'
    })
    try {
      const response = await route.fetch({url: api + url.pathname.replace(/^\/api/, '') + url.search})
      await route.fulfill({response})
    } catch {
      if (!page.isClosed()) await route.abort().catch(() => {
      })
    }
  })
  await page.goto(`${base}/#/approval/home`, {waitUntil: 'domcontentloaded'})
  await page.getByRole('button').filter({hasText: '浏览器人工流程'}).first().click()
  await page.getByRole('button', {name: '同意', exact: true}).last().click()
  await page.getByLabel('审批意见', {exact: true}).fill('真实浏览器同意')
  await page.getByRole('button', {name: '确认同意', exact: true}).click()
  await waitFor(async () => (await call(`${prefix}/flow-instances/${run.id}`)).status === 'SUCCEEDED', 'approval completion')
  await page.screenshot({path: path.join(root, 'artifacts/flows-manual-approved.png'), fullPage: true})

  const event = await create('浏览器数据事件', {type: 'DATA_EVENT', formName: 'orders', operations: ['CREATE']})
  await call(`${prefix}/flows/${event.id}/publish`, 'POST')
  const changed = await call(`${prefix}/forms/orders/records`, 'POST', {name: '事件订单'})
  const eventRun = await waitFor(async () => {
    const {list: runs} = await call(`${prefix}/flows/${event.id}/instances`);
    return runs.find(r => r.recordId === changed.id && r.status === 'SUCCEEDED')
  }, 'data event')
  const eventDetail = await call(`${prefix}/flow-instances/${eventRun.id}`)
  if (eventDetail.variables.record.name !== '事件订单' || eventDetail.variables.trigger.operation !== 'CREATE') throw new Error('Invalid event snapshot')

  const scheduled = await create('浏览器定时查询', {type: 'MANUAL', formName: 'orders', lockRecord: false}, [
    {
      id: 'query',
      kind: 'query',
      form: {kind: 'app', name: 'orders'},
      queryMode: 'many',
      conditions: [],
      assignments: [],
      match: 'all',
      output: 'ordersResult'
    },
    {
      id: 'review',
      kind: 'approval',
      signMode: 'all',
      rules: [{id: 'admin', source: 'users', values: ['admin'], scope: 'self', includeChildren: false}]
    },
  ])
  await page.goto(`${base}/#/admin/apps/${app}/workflow/${scheduled.id}/design`, {waitUntil: 'domcontentloaded'})
  await page.getByLabel('触发方式', {exact: true}).selectOption('SCHEDULE')
  if (await page.getByLabel('流程关联表单', {exact: true}).count()) throw new Error('Schedule must not ask for a form')
  await page.getByLabel('Cron 表达式', {exact: true}).fill('0/1 * * * * ?')
  await Promise.all([page.waitForResponse(r => r.url().includes('/cron-preview') && r.status() === 200), page.getByRole('button', {
    name: '预览未来五次执行时间',
    exact: true
  }).click()])
  await page.getByRole('button', {name: '保存草稿', exact: true}).click()
  await waitFor(async () => {
    const current = await call(`${prefix}/flows/${scheduled.id}`);
    return current.model.flowElementList.find(e => e.type === 2).properties.config.trigger.type === 'SCHEDULE' && current
  }, 'save schedule')
  await page.getByTitle('流程操作', {exact: true}).click()
  await page.getByRole('menuitem', {name: '发布新版本', exact: true}).click()
  const pending = await waitFor(async () => {
    const {list: runs} = await call(`${prefix}/flows/${scheduled.id}/instances`);
    return runs.find(r => r.status === 'WAITING')
  }, 'Quartz approval')
  await page.goto(`${base}/#/approval/home`, {waitUntil: 'domcontentloaded'})
  await page.getByRole('button').filter({hasText: '浏览器定时查询'}).first().click()
  await page.getByLabel('审批意见', {exact: true}).fill('查询结果已核对')
  await page.getByRole('button', {name: '同意', exact: true}).last().click()
  const scheduledRun = await waitFor(async () => {
    const run = await call(`${prefix}/flow-instances/${pending.id}`);
    return run.status === 'SUCCEEDED' && run
  }, 'Quartz approval completion')
  const detail = await call(`${prefix}/flow-instances/${scheduledRun.id}`)
  if (detail.recordId || 'record' in detail.variables || Object.keys(detail.variables.input).length) throw new Error('Schedule supplied business data')
  if (!Array.isArray(detail.variables.nodes.query) || detail.variables.nodes.query.length < 2) throw new Error('Query result is missing')
  await call(`${prefix}/flows/${scheduled.id}/enabled`, 'PUT', {enabled: false})
  await page.screenshot({path: path.join(root, 'artifacts/flows-scheduled-query.png'), fullPage: true})
  if (errors.length) throw new Error(errors.join('\n'))
  console.log('PASS: manual approval, Apps data event, schedule editor/preview/publication, actual Quartz firing, empty start and query output')
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({
    path: path.join(root, 'artifacts/flows-failure.png'),
    fullPage: true
  }).catch(() => {
  })
  console.error(String(error.message).replaceAll(token, '[redacted]'))
  process.exitCode = 1
} finally {
  await page?.unrouteAll({behavior: 'ignoreErrors'})
  await browser?.close()
  server?.kill()
}

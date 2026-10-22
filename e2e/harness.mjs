// E2E 通用引导：由 Java 集成测试触发的独立脚本共用。
// 启动 vite 前端、封装后端 API 请求、启动注入登录态的浏览器。
import {spawn} from 'node:child_process'
import {chromium} from '@playwright/test'
import {fileURLToPath} from 'node:url'
import {resolve, dirname} from 'node:path'

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 启动 vite dev server 并等待就绪，返回 server 句柄与前端地址 */
export async function startFrontend(api, port) {
  const frontend = `http://127.0.0.1:${port}`
  const server = spawn(process.execPath, [
    resolve(projectRoot, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort',
  ], {
    cwd: projectRoot,
    env: {...process.env, VITE_API_TARGET: api},
    stdio: 'ignore',
    windowsHide: true,
  })
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(frontend)).ok) break
    } catch {
    }
    await new Promise(done => setTimeout(done, 200))
  }
  return {server, frontend}
}

/** 携带登录令牌的后端 API 请求 */
export async function apiRequest(api, token, path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(api + '/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    }, ...(body ? {body: JSON.stringify(body)} : {}),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(path + ': ' + response.status + ' ' + JSON.stringify(result))
  return result
}

/** 启动浏览器并注入登录态；options 透传 newContext（viewport、permissions 等） */
export async function launchContext(token, options = {}) {
  const browser = await chromium.launch({headless: true})
  const context = await browser.newContext({
    viewport: {width: 1440, height: 900},
    locale: 'zh-CN',
    ...options,
  })
  await context.addInitScript(({token}) => {
    if (location.origin === 'null') return
    localStorage.setItem('flexmodel-apps.auth.token', token)
    localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: 'Admin'}))
  }, {token})
  return {browser, context}
}

import {expect, test} from '@playwright/test'

for (const failed of [false, true]) {
  test(`工具调用${failed ? '后模型失败' : '完成'}时统一刷新页面，保留助手`, async ({page}) => {
    const apps = [{id: 'existing', name: '已有应用', enabled: true}]
    let reads = 0
    let finish!: () => void
    let ready!: () => void
    const started = new Promise<void>(resolve => {
      ready = resolve
    })
    await page.addInitScript(() => {
      localStorage.setItem('flexmodel-apps.auth.token', 'test-token')
      localStorage.setItem('flexmodel-apps.auth.user', JSON.stringify({id: 'admin', name: '管理员'}))
    })
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/ai/conversations/chat/messages')) {
        await new Promise<void>(resolve => {
          finish = resolve;
          ready()
        })
        apps.push({id: 'created', name: 'AI 新建应用', enabled: true})
        const events = [
          {type: 'tool', content: 'create_app'},
          {type: 'tool', content: 'create_app_form'},
          failed ? {type: 'error', content: '后续模型失败'} : {
            type: 'done', conversation: {
              id: 'chat', robotId: 'assistant', messages: [
                {id: 'answer', role: 'assistant', content: '应用已创建', createdAt: '2026-11-06T10:00:00'},
              ]
            },
          },
        ]
        return route.fulfill({
          contentType: 'text/event-stream',
          body: events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('')
        })
      }
      if (path === '/api/ai/conversations') return route.fulfill({
        json: route.request().method() === 'POST'
          ? {id: 'chat', robotId: 'assistant', title: '对话', messages: []} : []
      })
      if (path === '/api/apps') {
        reads++;
        return route.fulfill({json: apps})
      }
      if (path === '/api/notifications/summary') return route.fulfill({
        json: {
          version: '0',
          unread: 0,
          apps: [],
          byCategory: {}
        }
      })
      if (path === '/api/notifications') return route.fulfill({json: {list: [], total: 0}})
      if (path === '/api/notifications/stream') return route.fulfill({
        contentType: 'text/event-stream',
        body: 'event: ready\ndata: {"version":"0"}\n\n'
      })
      return route.fulfill({json: []})
    })
    await page.goto('/#/admin/apps')
    await expect(page.getByRole('link', {name: /已有应用/})).toBeVisible()
    const before = reads
    await page.getByRole('button', {name: 'AI 助手', exact: true}).click()
    const composer = page.getByRole('textbox', {name: '消息内容'})
    await composer.fill('创建一个应用')
    await page.getByRole('button', {name: '发送消息', exact: true}).click()
    await started
    await composer.fill('下一条未发送的消息')
    finish()
    await expect(page.getByRole('link', {name: /AI 新建应用/})).toBeVisible()
    await expect(page.getByRole('button', {name: 'AI 助手', exact: true})).toHaveAttribute('aria-expanded', 'true')
    await expect(composer).toHaveValue('下一条未发送的消息')
    await expect(page.getByText(failed ? '后续模型失败' : '应用已创建', {exact: true})).toBeVisible()
    expect(reads).toBe(before + 1)
  })
}

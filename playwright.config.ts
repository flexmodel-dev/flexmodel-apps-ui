import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5182',
    viewport: {width: 1440, height: 900},
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5182 --strictPort',
    url: 'http://127.0.0.1:5182',
    reuseExistingServer: true,
    timeout: 60000,
  },
  projects: [
    {name: 'workflows', testMatch: 'workflows.spec.ts'},
    {name: 'records', testMatch: ['records.spec.ts', 'record-print.spec.ts', 'view-url.spec.ts']},
    {name: 'menus', testMatch: ['menu-permissions.spec.ts', 'nav-actions.spec.ts', 'quick-create.spec.ts']},
    {name: 'ai', testMatch: 'ai-refresh.spec.ts'},
    {name: 'apps-reorder', testMatch: 'apps-reorder.spec.ts'},
    {name: 'attachments', testMatch: 'attachments.spec.ts'},
    {name: 'fields', testMatch: 'field-config.spec.ts'},
    {name: 'files', testMatch: 'files.spec.ts'},
    {name: 'packages', testMatch: 'app-packages.spec.ts'},
    {name: 'permissions', testMatch: 'data-permissions.spec.ts'},
    {name: 'settings', testMatch: 'forms-settings.spec.ts'},
    {name: 'theme', testMatch: 'theme.spec.ts'},
    {name: 'transfers', testMatch: 'transfers.spec.ts'},
  ],
})

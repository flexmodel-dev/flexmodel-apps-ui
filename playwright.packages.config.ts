import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'app-packages.spec.ts',
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5183',
    viewport: {width: 1440, height: 900},
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5183 --strictPort',
    url: 'http://127.0.0.1:5183',
    reuseExistingServer: true,
    timeout: 60000,
  },
})

import {defineConfig} from '@playwright/test'
import config from './playwright.approvals.config'

export default defineConfig({
  ...config,
  testMatch: ['menu-permissions.spec.ts', 'nav-actions.spec.ts', 'quick-create.spec.ts']
})

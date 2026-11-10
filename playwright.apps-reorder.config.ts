import {defineConfig} from '@playwright/test'
import config from './playwright.approvals.config'

export default defineConfig({...config, testMatch: 'apps-reorder.spec.ts'})

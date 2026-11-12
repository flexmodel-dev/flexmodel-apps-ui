import {defineConfig} from '@playwright/test'
import config from './playwright.approvals.config'

export default defineConfig({...config, testMatch: ['records.spec.ts', 'record-print.spec.ts', 'view-url.spec.ts']})

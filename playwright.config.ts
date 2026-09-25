import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './browser-tests', timeout: 45000, use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000', browserName: 'chromium' }, reporter: [['list'], ['html', { open: 'never' }]] });

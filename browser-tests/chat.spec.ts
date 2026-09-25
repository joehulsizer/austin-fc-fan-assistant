import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { page.on('pageerror', error => console.error('Browser page error:', error.stack || error.message)); });

test('desktop conversation carries section and reset clears it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Need a hand at Q2/i })).toBeVisible();
  await page.getByRole('button', { name: /Food near me/i }).click();
  await expect(page.locator('.message.assistant').last()).toContainText('119', { timeout: 20000 });
  await expect(page.locator('.context-box')).toContainText('Section 123');
  await page.getByLabel('Ask a question').fill('What about drinks?');
  await page.getByLabel('Ask a question').press('Enter');
  await expect(page.locator('.message.assistant').last()).toContainText('Bar', { timeout: 20000 });
  await page.getByRole('button', { name: /Start over/i }).click();
  await expect(page.locator('.context-box')).toContainText('Section not set');
});

test('mobile Spanish question remains usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByLabel('Ask a question').fill('¿Dónde puedo encontrar comida vegetariana?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.message.assistant').last()).toContainText('122', { timeout: 20000 });
  await expect(page.locator('.message.assistant').last()).toContainText('Opciones');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBe(false);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('link', { name: 'Sources & freshness' })).toBeVisible();
});

test('question examples and source cards open in-site content', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /See questions that test/i }).click();
  await expect(page.getByRole('heading', { name: 'Questions to try' })).toBeVisible();
  await page.getByRole('link', { name: /I’m in section 123/i }).click();
  await expect(page.getByLabel('Ask a question')).toHaveValue('I’m in section 123. Where can I get vegan food?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.message.assistant').last()).toContainText('119', { timeout: 20000 });
  await page.locator('.card').first().click();
  await expect(page).toHaveURL(/\/guide\?topic=sections/);
  await expect(page.getByRole('heading', { name: 'Section guide' })).toBeVisible();
  expect(await page.locator('a[href^="http"]').count()).toBe(0);
});

test('in-site policy guide fits on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/guide?topic=policies&find=Bag%20Policy');
  await expect(page.getByRole('heading', { name: 'Bag Policy' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBe(false);
  expect(await page.locator('a[href^="http"]').count()).toBe(0);
});

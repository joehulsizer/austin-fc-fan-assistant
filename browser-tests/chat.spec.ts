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
  await expect(page.getByRole('img', { name: /Published Q2 Stadium section/i })).toBeVisible();
  expect(await page.getByRole('img', { name: /Published Q2 Stadium section/i }).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
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

test('in-site food guide shows the published burger and chicken locations', async ({ page }) => {
  await page.goto('/guide?topic=food');
  await expect(page.getByText('Impossible Good Burger (vegetarian)').first()).toBeVisible();
  await expect(page.getByText('Chicken tenders and wings')).toBeVisible();
  await expect(page.getByText('Section 135 East Side')).toBeVisible();
});

test('desktop menu starts collapsed and remembers expansion', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Expand menu' })).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveClass(/collapsed/);
  await page.getByRole('button', { name: 'Expand menu' }).click();
  await expect(page.getByRole('button', { name: 'Collapse menu' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sources & freshness' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Collapse menu' })).toBeVisible();
});

test('share creates a read-only link and explains who can see it', async ({ page }) => {
  await page.route('**/api/share', async route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ path: '/share/11111111-1111-4111-8111-111111111111' }) }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Share chat' }).click();
  await expect(page.getByText('Anyone with the link can read it.')).toBeVisible();
  await page.getByRole('button', { name: 'Create share link' }).click();
  await expect(page.locator('.share-error')).toContainText('Ask a question');
  await page.getByRole('button', { name: 'Close share panel' }).click();
  await page.getByRole('button', { name: /Food near me/i }).click();
  await expect(page.locator('.message.assistant').last()).toContainText('119', { timeout: 20000 });
  await page.getByRole('button', { name: 'Share chat' }).click();
  await page.getByRole('button', { name: 'Create share link' }).click();
  await expect(page.getByRole('textbox', { name: 'Share link' })).toHaveValue(/\/share\/11111111-1111-4111-8111-111111111111/);
});

test('a long conversation keeps sending the latest question within the API limit', async ({ page }) => {
  const lengths:number[]=[];
  await page.route('**/api/chat', async route => {
    const body=route.request().postDataJSON();
    lengths.push(body.messages.length);
    await route.fulfill({status:200,contentType:'application/x-ndjson',body:JSON.stringify({type:'meta',context:body.context,sources:[],cards:[],route:'stadium'})+'\n'+JSON.stringify({type:'delta',text:`Answered ${body.messages.at(-1).content}`})+'\n'});
  });
  await page.goto('/');
  for(let i=1;i<=10;i++){
    await page.getByLabel('Ask a question').fill(`Question ${i}`);
    await page.getByRole('button',{name:'Send message'}).click();
    await expect(page.locator('.message.assistant').last()).toContainText(`Answered Question ${i}`);
    await expect(page.getByLabel('Ask a question')).toBeEnabled();
  }
  expect(lengths).toHaveLength(10);
  expect(Math.max(...lengths)).toBeLessThanOrEqual(16);
  expect(lengths.at(-1)).toBe(16);
});

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
  await expect(page.locator('.message.assistant').last()).toContainText('beverage menu', { timeout: 20000 });
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
  await expect(page.getByText('Section 135 East Side').first()).toBeVisible();
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
  let sharedMessages: { cards?: unknown[]; sources?: unknown[] }[] = [];
  await page.route('**/api/share', async route => {
    sharedMessages = route.request().postDataJSON().messages;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ path: '/share/11111111-1111-4111-8111-111111111111' }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Share chat' }).click();
  await expect(page.getByText('Anyone with the link can read it.')).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create share link' }).click();
  await expect(page.locator('.share-error')).toContainText('Ask a question');
  await page.getByRole('button', { name: 'Close share panel' }).click();
  await page.getByRole('button', { name: /Food near me/i }).click();
  await expect(page.locator('.message.assistant').last()).toContainText('119', { timeout: 20000 });
  await page.getByRole('button', { name: 'Share chat' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create share link' }).click();
  await expect(page.getByRole('textbox', { name: 'Share link' })).toHaveValue(/\/share\/11111111-1111-4111-8111-111111111111/);
  expect(sharedMessages).toHaveLength(2);
  const savedCardCount=await page.evaluate(()=>JSON.parse(localStorage.getItem('austin-fc-fan-assistant-v1')!).messages.at(-1).cards.length);
  expect(sharedMessages[1].cards?.length).toBe(savedCardCount);
  expect(sharedMessages[1].sources?.length).toBeLessThanOrEqual(4);
});

test('a long conversation keeps sending the latest question within the API limit', async ({ page }) => {
  const lengths:number[]=[];
  await page.route('**/api/chat', async route => {
    const body=route.request().postDataJSON();
    lengths.push(body.messages.length);
    await route.fulfill({status:200,contentType:'application/x-ndjson',body:JSON.stringify({type:'meta',context:body.context,sources:[],cards:[],route:'stadium'})+'\n'+JSON.stringify({type:'delta',text:`Answered **${body.messages.at(-1).content}**`})+'\n'+JSON.stringify({type:'done'})+'\n'});
  });
  await page.goto('/');
  for(let i=1;i<=10;i++){
    await page.getByLabel('Ask a question').fill(`Question ${i}`);
    await page.getByRole('button',{name:'Send message'}).click();
    await expect(page.locator('.message.assistant').last()).toContainText(`Answered Question ${i}`);
    await expect(page.getByRole('button',{name:'Stop answer'})).toBeHidden({timeout:30000});
  }
  expect(lengths).toHaveLength(10);
  expect(Math.max(...lengths)).toBeLessThanOrEqual(16);
  expect(lengths.at(-1)).toBe(16);
  await expect(page.locator('.message.assistant').last().locator('.message-copy strong')).toHaveText('Question 10');
});

test('bilingual emergency, language switch and relevant source chips work on a phone', async({page})=>{
  await page.setViewportSize({width:375,height:812});await page.goto('/');
  await page.getByLabel('Ask a question').fill('Perdí a mi hijo de 6 años cerca de la sección 118');await page.getByLabel('Ask a question').press('Enter');
  const answer=page.locator('.message.assistant').last();await expect(answer).toContainText('inmediatamente');await expect(answer.locator('a[href="sms:3527583733"]')).toBeVisible();
  await expect(page.getByRole('button',{name:'Stop answer'})).toBeHidden({timeout:30000});await page.getByLabel('Ask a question').fill('What time do gates open?');await page.getByLabel('Ask a question').press('Enter');
  await expect(page.locator('.message.assistant').last()).toContainText('90 minutes');
  await expect(page.locator('.message.assistant').last().locator('.sources a')).toHaveCount(1);
  await expect(page.locator('.message.assistant').last().locator('.sources a')).toContainText('Gate Opening Times');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)).toBe(false);
  await page.screenshot({path:'test-results/mobile-safety-handoffs.png',fullPage:true});
});

test('seat ordering uses actual OrderNext and share retains handoffs',async({page})=>{
  let actions:{href:string}[]=[];
  await page.route('**/api/share',async route=>{actions=route.request().postDataJSON().messages.at(-1).actions;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({path:'/share/11111111-1111-4111-8111-111111111111'})});});
  await page.goto('/');await page.getByLabel('Ask a question').fill('Beer and hot dog delivered to my seat in 210');await page.getByLabel('Ask a question').press('Enter');
  const response=page.locator('.message.assistant').last();await expect(response).toContainText('eligible');await expect(response.locator('.handoffs a').first()).toHaveAttribute('href','https://austinfc.ordernext.com/');
  await expect(page.getByRole('button',{name:'Stop answer'})).toBeHidden({timeout:30000});await page.getByRole('button',{name:'Share chat'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create share link'}).click();await expect(page.getByRole('textbox',{name:'Share link'})).toHaveValue(/\/share\//);expect(actions.some(a=>a.href.includes('ordernext'))).toBe(true);
});

test('arrival planner generates a usable chat request with origin, event type, time and duration',async({page})=>{
  await page.goto('/guide?topic=travel');await page.getByLabel('Starting point').fill('UT Austin');await page.getByLabel('Start time (Austin time)').fill('19:30');await page.getByLabel('Travel duration / planning allowance (minutes)').fill('35');await page.getByRole('button',{name:'Build my arrival plan'}).click();
  await expect(page.getByLabel('Ask a question')).toHaveValue(/UT Austin.*19:30.*35 minutes/);await page.getByLabel('Ask a question').press('Enter');await expect(page.locator('.message.assistant').last()).toContainText('5:25');await expect(page.locator('.message.assistant').last().getByRole('link',{name:'Directions in Apple Maps',exact:false}).first()).toHaveAttribute('href',/maps.apple.com/);
});

test('a stalled response times out with retry and working support links',async({page})=>{
  await page.clock.install();
  await page.route('**/api/chat',()=>{});
  await page.goto('/');
  await page.getByLabel('Ask a question').fill('What is my wallet balance?');
  await page.getByRole('button',{name:'Send message'}).click();
  await expect(page.getByRole('button',{name:'Stop answer'})).toBeVisible();
  await page.clock.fastForward(61000);
  const response=page.locator('.message.assistant').last();
  await expect(response).toContainText('response took too long');
  await expect(response.locator('a[href="mailto:GuestServices@AustinFC.com"]')).toBeVisible();
  await expect(page.getByRole('button',{name:'Retry last question'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Stop answer'})).toBeHidden({timeout:30000});
});

test('the exact reported travel sequence gives distinct, focused answers',async({page})=>{
 await page.goto('/');
 const ask=async(q:string)=>{await page.getByLabel('Ask a question').fill(q);await page.getByLabel('Ask a question').press('Enter');await expect(page.getByRole('button',{name:'Stop answer'})).toBeHidden({timeout:30000});};
 await ask("I'm at UT, kickoff is 7:30, what's the fastest way to Q2?");
 const first=page.locator('.message.assistant').last();
 await expect(first.locator('.message-copy')).toContainText('northbound Rapid 803');await expect(first.locator('.message-copy')).toContainText('6:00 PM');
 await expect(first.locator('.message-copy')).not.toContainText('Bike Valet');await expect(first.locator('.message-copy')).not.toContainText('5:00');
 const firstText=await first.locator('.message-copy').innerText();
 await ask('Concert at Q2 next month, where do I park?');
 const second=page.locator('.message.assistant').last();
 await expect(second.locator('.message-copy')).toContainText('event-specific parking pass');await expect(second.locator('.message-copy')).toContainText('Which concert and date');
 await expect(second.locator('.message-copy')).not.toContainText('Rapid 803');await expect(second.locator('.message-copy')).not.toContainText('Red Line');
 await expect(second.locator('.sources a')).toHaveCount(1);await expect(second.locator('.sources a')).toContainText('parking and lot map');
 expect(await second.locator('.message-copy').innerText()).not.toEqual(firstText);
 await expect(second.locator('.handoffs a')).toHaveCount(1);await page.screenshot({path:'test-results/exact-user-sequence.png',fullPage:true});
 await second.locator('.card').click();await expect(page.getByRole('img',{name:/published parking map/})).toBeVisible();
});

test('public storage really shares a conversation and retains its answer and actions',async({page,browser})=>{
 test.skip(!process.env.PLAYWRIGHT_BASE_URL,'Requires deployed durable Blob storage');
 await page.goto('/');await page.getByLabel('Ask a question').fill('Where can I get Sprite near section 123?');await page.getByLabel('Ask a question').press('Enter');
 await expect(page.locator('.message.assistant').last().locator('.message-copy')).toContainText('Sprite',{timeout:30000});await expect(page.getByRole('button',{name:'Stop answer'})).toBeHidden({timeout:30000});
 await page.getByRole('button',{name:'Share chat'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create share link'}).click();
 const field=page.getByRole('textbox',{name:'Share link'});await expect(field).toHaveValue(/\/share\/[0-9a-f-]+/,{timeout:15000});
 const url=await field.inputValue();const fresh=await browser.newContext();const partner=await fresh.newPage();await partner.goto(url);
 await expect(partner.getByText('Sprite (published soda selection)').first()).toBeVisible();await expect(partner.locator('a[href="https://austinfc.ordernext.com/"]')).toBeVisible();
 await partner.reload();await expect(partner.getByText('Sprite (published soda selection)').first()).toBeVisible();await fresh.close();
});

test('four-message burst queues every message in order with fresh context',async({page})=>{
 const seen:{question:string;context:{section?:number}}[]=[];
 let release!:()=>void;const first=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/chat',async route=>{
  const body=route.request().postDataJSON(),question=body.messages.at(-1).content;seen.push({question,context:body.context});
  if(seen.length===1)await first;
  await route.fulfill({status:200,contentType:'application/x-ndjson',body:JSON.stringify({type:'meta',context:{...body.context,section:123},sources:[],cards:[],actions:[],route:'stadium'})+'\n'+JSON.stringify({type:'delta',text:`Completed ${question}`})+'\n'+JSON.stringify({type:'done'})+'\n'});
 });
 await page.goto('/');
 for(const question of ['Message one','Message two','Message three','Message four']){await page.getByLabel('Ask a question').fill(question);await page.getByLabel('Ask a question').press('Enter');}
 await expect(page.locator('.queued-messages')).toContainText('3 messages queued');
 await page.getByLabel('Ask a question').fill('Unsent draft stays here');
 release();await expect(page.locator('.message.assistant').last()).toContainText('Completed Message four');
 await expect(page.getByRole('button',{name:'Stop answer'})).toBeHidden();
 expect(seen.map(s=>s.question)).toEqual(['Message one','Message two','Message three','Message four']);
 expect(seen.slice(1).every(s=>s.context.section===123)).toBe(true);
 await expect(page.getByLabel('Ask a question')).toHaveValue('Unsent draft stays here');
 await expect(page.locator('.message.user')).toHaveCount(4);
});

test('reset during a pending response clears the queue and stale results',async({page})=>{
 await page.route('**/api/chat',()=>{});await page.goto('/');
 for(const question of ['Pending first','Pending second']){await page.getByLabel('Ask a question').fill(question);await page.getByLabel('Ask a question').press('Enter');}
 await expect(page.locator('.queued-messages')).toContainText('1 message queued');
 await page.getByRole('button',{name:/Start over/}).click();
 await expect(page.locator('.queued-messages')).toHaveCount(0);await expect(page.locator('.message.user')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:/Need a hand at Q2/})).toBeVisible();
});

test('share preview removes private contacts and requires explicit public-link review',async({page})=>{
 let snapshot='';await page.route('**/api/share',async route=>{snapshot=route.request().postData()!;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({path:'/share/11111111-1111-4111-8111-111111111111'})});});
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('austin-fc-fan-assistant-v1',JSON.stringify({context:{language:'en'},messages:[{id:'private-question',role:'user',content:'My phone is 512-555-1212 and email joe@example.com.'},{id:'answer',role:'assistant',content:'Ask GuestServices@AustinFC.com for help.'}]})));await page.reload();
 await page.getByRole('button',{name:'Share chat'}).click();await expect(page.getByRole('button',{name:'Create share link'})).toBeDisabled();
 await page.getByText('Preview the redacted copy').click();await expect(page.locator('.share-preview')).not.toContainText('512-555-1212');await expect(page.locator('.share-preview')).not.toContainText('joe@example.com');
 await expect(page.locator('.share-preview')).toContainText('[email removed]');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create share link'}).click();await expect(page.getByRole('textbox',{name:'Share link'})).toBeVisible();expect(snapshot).not.toMatch(/555-1212|joe@example/);
});

test('all guide topics render the correct page with JavaScript disabled at 390px',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),page=await context.newPage();
 const base=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3000';
 for(const [topic,title] of [['policies','Stadium policies'],['travel','Getting here'],['sections','Section guide'],['club','Matches & club'],['internal','Club knowledge']]){
  for(const path of [`/guide?topic=${topic}`,`/guide/${topic}`]){await page.goto(base+path);await expect(page.locator('h1')).toHaveText(title);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)).toBe(false);}
 }
 await page.screenshot({path:'test-results/mobile-390-no-javascript.png',fullPage:true});await context.close();
});

test('390px fan replies keep sources relevant and omit universal support buttons',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 for(const [question,source] of [['Can I bring a stroller?','Strollers'],['What are the camera rules at Q2?','Cameras'],['Can I bring my dog, he is an ESA?','Animals']]){
  await page.getByLabel('Ask a question').fill(question);await page.getByLabel('Ask a question').press('Enter');await expect(page.getByRole('button',{name:'Stop answer'})).toBeHidden({timeout:30000});
  const answer=page.locator('.message.assistant').last();await expect(answer.locator('.sources')).toContainText(source);await expect(answer.locator('.handoffs a')).toHaveCount(0);await expect(answer.locator('.sources')).not.toContainText('Alcohol Policy');
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)).toBe(false);await page.screenshot({path:'test-results/mobile-390-policy-sources.png',fullPage:true});
});

import {test,expect} from '@playwright/test';
const meta={type:'meta',context:{language:'en',section:118},sources:[],cards:[],actions:[],route:'stadium'};
const complete=(text:string)=>[meta,{type:'delta',text},{type:'done'}].map(x=>JSON.stringify(x)).join('\n')+'\n';
test('truncated streams display retry and cannot become a successful share',async({page})=>{
 await page.route('**/api/chat',r=>r.fulfill({contentType:'application/x-ndjson',body:JSON.stringify(meta)+'\n'+JSON.stringify({type:'delta',text:'Partial answer'})+'\n'}));
 await page.goto('/');await page.getByLabel('Ask a question').fill('What time do gates open?');await page.getByLabel('Ask a question').press('Enter');
 await expect(page.locator('.message.assistant').last()).toContainText('interrupted');await expect(page.getByRole('button',{name:'Retry this question',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Share chat'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create share link'}).click();await expect(page.locator('.share-error')).toContainText('wait for an answer');
});
test('a queued failure remains individually retryable after later messages succeed',async({page})=>{
 const seen:string[]=[];let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve});
 await page.route('**/api/chat',async r=>{const b=r.request().postDataJSON();seen.push(b.messages.at(-1).content);if(seen.length===1){await wait;await r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Test service outage'})});}else await r.fulfill({contentType:'application/x-ndjson',body:complete('Completed '+b.messages.at(-1).content)});});
 await page.goto('/');for(const q of ['First question','Second question']){await page.getByLabel('Ask a question').fill(q);await page.getByLabel('Ask a question').press('Enter');}release();
 await expect(page.locator('.message.assistant').last()).toContainText('Completed Second question');await expect(page.getByRole('button',{name:'Retry this question',exact:true})).toBeVisible();
 await page.getByLabel('Ask a question').fill('Unsent draft');await page.getByRole('button',{name:'Retry this question',exact:true}).click();await expect(page.locator('.message.assistant').last()).toContainText('Completed First question');expect(seen).toEqual(['First question','Second question','First question']);await expect(page.getByLabel('Ask a question')).toHaveValue('Unsent draft');
});
test('final NDJSON event without a newline is still read completely',async({page})=>{
 await page.route('**/api/chat',r=>r.fulfill({contentType:'application/x-ndjson',body:complete('Respuesta: sección 118.').trimEnd()}));await page.goto('/');await page.getByLabel('Ask a question').fill('Hola');await page.getByLabel('Ask a question').press('Enter');await expect(page.locator('.message.assistant').last()).toContainText('sección 118');await expect(page.getByRole('button',{name:'Retry this question',exact:true})).toBeHidden();
});

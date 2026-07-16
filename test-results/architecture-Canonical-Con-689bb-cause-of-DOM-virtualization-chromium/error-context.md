# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: architecture.spec.ts >> Canonical Context Architecture Invariants >> Invariant 2: Conversation length never decreases because of DOM virtualization
- Location: src\__tests__\e2e\architecture.spec.ts:118:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: worker.evaluate: Target page, context or browser has been closed
```

# Test source

```ts
  1   | import { test, expect } from './fixtures';
  2   | 
  3   | test.describe('Canonical Context Architecture Invariants', () => {
  4   | 
  5   |   test.beforeEach(async ({ context, page }, testInfo) => {
  6   |     // Use the test ID to make thread IDs unique
  7   |     const uniqueId = testInfo.title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20);
  8   |     const threadId = `test-thread-${uniqueId}`;
  9   |     
  10  |     // Route chatgpt.com to our mock HTML so the content script activates
  11  |     await context.route(`https://chatgpt.com/c/${threadId}`, route => {
  12  |       route.fulfill({
  13  |         contentType: 'text/html',
  14  |         body: `
  15  |           <!DOCTYPE html>
  16  |           <html>
  17  |             <head><title>Mock ChatGPT</title></head>
  18  |             <body>
  19  |               <main id="chat-container">
  20  |               </main>
  21  |             </body>
  22  |           </html>
  23  |         `
  24  |       });
  25  |     });
  26  |   });
  27  | 
  28  |   // Helper to inject a message into the DOM
  29  |   async function injectMessage(page: any, id: string, role: 'user' | 'assistant', text: string) {
  30  |     await page.evaluate(({ id, role, text }) => {
  31  |       const main = document.querySelector('main');
  32  |       const div = document.createElement('div');
  33  |       div.className = 'conversation-turn';
  34  |       div.setAttribute('data-message-author-role', role);
  35  |       div.setAttribute('data-message-id', id);
  36  |       div.innerText = text;
  37  |       main?.appendChild(div);
  38  |     }, { id, role, text });
  39  |   }
  40  |   
  41  |   // Helper to modify an existing message
  42  |   async function updateMessage(page: any, id: string, text: string) {
  43  |     await page.evaluate(({ id, text }) => {
  44  |       const msg = document.querySelector(`[data-message-id="${id}"]`) as HTMLElement;
  45  |       if (msg) msg.innerText = text;
  46  |     }, { id, text });
  47  |   }
  48  | 
  49  |   // Helper to remove messages from the DOM
  50  |   async function removeMessages(page: any, count: number) {
  51  |     await page.evaluate(({ count }) => {
  52  |       const msgs = document.querySelectorAll('.conversation-turn');
  53  |       for (let i = 0; i < count; i++) {
  54  |         if (msgs[i]) msgs[i].remove();
  55  |       }
  56  |     }, { count });
  57  |   }
  58  | 
  59  |   async function getBackgroundState(background: any) {
  60  |     return await background.evaluate(async () => {
  61  |       return await chrome.storage.local.get(null);
  62  |     });
  63  |   }
  64  |   
  65  |   async function getIDBConversationCount(background: any, conversationId: string) {
> 66  |     return await background.evaluate(async ({ conversationId }) => {
      |                             ^ Error: worker.evaluate: Target page, context or browser has been closed
  67  |       return new Promise<number>((resolve, reject) => {
  68  |         const req = indexedDB.open('ai-context-tracker-db', 1);
  69  |         req.onsuccess = () => {
  70  |           const db = req.result;
  71  |           const tx = db.transaction('conversations', 'readonly');
  72  |           const store = tx.objectStore('conversations');
  73  |           const getReq = store.get(conversationId);
  74  |           getReq.onsuccess = () => {
  75  |             resolve(getReq.result ? getReq.result.orderedMessageIds.length : 0);
  76  |           };
  77  |           getReq.onerror = () => reject(getReq.error);
  78  |         };
  79  |         req.onerror = () => reject(req.error);
  80  |       });
  81  |     }, { conversationId });
  82  |   }
  83  | 
  84  |   test('Invariant 1 & 6: Conversation length never decreases after page refresh & no new conv created', async ({ context, page }, testInfo) => {
  85  |     const uniqueId = testInfo.title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20);
  86  |     const threadId = `test-thread-${uniqueId}`;
  87  |     
  88  |     await page.goto(`https://chatgpt.com/c/${threadId}`);
  89  |     
  90  |     // Inject 10 messages
  91  |     for (let i = 0; i < 10; i++) {
  92  |       await injectMessage(page, `msg-${i}`, i % 2 === 0 ? 'user' : 'assistant', `Test message ${i}`);
  93  |     }
  94  |     
  95  |     // Wait for content mutation sync (debounced at 250ms in engine)
  96  |     await page.waitForTimeout(1000);
  97  |     
  98  |     const [background] = context.serviceWorkers();
  99  |     
  100 |     let count = await getIDBConversationCount(background, `chatgpt:${threadId}`);
  101 |     expect(count).toBe(10);
  102 |     
  103 |     // Hard refresh
  104 |     await page.reload();
  105 |     
  106 |     // Inject only the last 4 messages (simulating partial load)
  107 |     for (let i = 6; i < 10; i++) {
  108 |       await injectMessage(page, `msg-${i}`, i % 2 === 0 ? 'user' : 'assistant', `Test message ${i}`);
  109 |     }
  110 |     
  111 |     await page.waitForTimeout(1000);
  112 |     
  113 |     // Count should still be 10, not 4
  114 |     count = await getIDBConversationCount(background, `chatgpt:${threadId}`);
  115 |     expect(count).toBe(10);
  116 |   });
  117 | 
  118 |   test('Invariant 2: Conversation length never decreases because of DOM virtualization', async ({ context, page }, testInfo) => {
  119 |     const uniqueId = testInfo.title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20);
  120 |     const threadId = `test-thread-${uniqueId}`;
  121 |     await page.goto(`https://chatgpt.com/c/${threadId}`);
  122 |     
  123 |     // Inject 50 messages
  124 |     for (let i = 0; i < 50; i++) {
  125 |       await injectMessage(page, `msg-${i}`, 'user', `Message ${i}`);
  126 |     }
  127 |     await page.waitForTimeout(1000);
  128 |     
  129 |     const [background] = context.serviceWorkers();
  130 |     let count = await getIDBConversationCount(background, `chatgpt:${threadId}`);
  131 |     expect(count).toBe(50);
  132 |     
  133 |     // Remove the first 40 (DOM virtualization)
  134 |     await removeMessages(page, 40);
  135 |     await page.waitForTimeout(1000);
  136 |     
  137 |     // IDB should still hold 50
  138 |     count = await getIDBConversationCount(background, `chatgpt:${threadId}`);
  139 |     expect(count).toBe(50);
  140 |   });
  141 | 
  142 |   test('Invariant 3, 4, 5: UI Consistency, Summary Input, and Token Count derived from Canonical', async ({ context, page }, testInfo) => {
  143 |     const uniqueId = testInfo.title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20);
  144 |     const threadId = `test-thread-${uniqueId}`;
  145 |     await page.goto(`https://chatgpt.com/c/${threadId}`);
  146 |     
  147 |     for (let i = 0; i < 5; i++) {
  148 |       await injectMessage(page, `msg-${i}`, 'user', `Message ${i}`);
  149 |     }
  150 |     await page.waitForTimeout(1000);
  151 |     
  152 |     const [background] = context.serviceWorkers();
  153 |     const state = await getBackgroundState(background);
  154 |     
  155 |     // Ensure tokens are populated (from offscreen tiktoken)
  156 |     // Actually, 'local:appState' key in WXT holds the appState
  157 |     const rawAppState = state['local:appState'];
  158 |     expect(rawAppState).toBeDefined();
  159 |     
  160 |     // stats.turns should be 5
  161 |     expect(rawAppState.stats.turns).toBe(5);
  162 |     // tokenEstimate.count should be derived from all 5 messages
  163 |     expect(rawAppState.tokenEstimate.count).toBeGreaterThan(0);
  164 |     
  165 |     // Ensure the side panel and widget receive this state
  166 |     // We can evaluate in page context if the widget is mounted
```
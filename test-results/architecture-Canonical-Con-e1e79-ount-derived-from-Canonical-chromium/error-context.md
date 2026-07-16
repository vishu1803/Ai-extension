# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: architecture.spec.ts >> Canonical Context Architecture Invariants >> Invariant 3, 4, 5: UI Consistency, Summary Input, and Token Count derived from Canonical
- Location: src\__tests__\e2e\architecture.spec.ts:142:7

# Error details

```
Error: expect(received).toBeDefined()

Received: undefined
```

# Test source

```ts
  58  | 
  59  |   async function getBackgroundState(background: any) {
  60  |     return await background.evaluate(async () => {
  61  |       return await chrome.storage.local.get(null);
  62  |     });
  63  |   }
  64  |   
  65  |   async function getIDBConversationCount(background: any, conversationId: string) {
  66  |     return await background.evaluate(async ({ conversationId }) => {
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
> 158 |     expect(rawAppState).toBeDefined();
      |                         ^ Error: expect(received).toBeDefined()
  159 |     
  160 |     // stats.turns should be 5
  161 |     expect(rawAppState.stats.turns).toBe(5);
  162 |     // tokenEstimate.count should be derived from all 5 messages
  163 |     expect(rawAppState.tokenEstimate.count).toBeGreaterThan(0);
  164 |     
  165 |     // Ensure the side panel and widget receive this state
  166 |     // We can evaluate in page context if the widget is mounted
  167 |     const widgetTurns = await page.evaluate(() => {
  168 |       const turnCounter = document.querySelector('.turns-counter');
  169 |       return turnCounter ? (turnCounter as HTMLElement).innerText : null;
  170 |     });
  171 |     // Not explicitly testing innerText parsing here, just existence of synced data
  172 |   });
  173 | 
  174 |   test('Invariant 7: Streaming updates modify existing message instead of creating duplicates', async ({ context, page }, testInfo) => {
  175 |     const uniqueId = testInfo.title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20);
  176 |     const threadId = `test-thread-${uniqueId}`;
  177 |     await page.goto(`https://chatgpt.com/c/${threadId}`);
  178 |     
  179 |     // Simulate streaming by updating the same ID
  180 |     await injectMessage(page, 'msg-stream', 'assistant', 'S');
  181 |     await page.waitForTimeout(300);
  182 |     await updateMessage(page, 'msg-stream', 'Streaming...');
  183 |     await page.waitForTimeout(300);
  184 |     await updateMessage(page, 'msg-stream', 'Streaming complete.');
  185 |     await page.waitForTimeout(1000);
  186 |     
  187 |     const [background] = context.serviceWorkers();
  188 |     const count = await getIDBConversationCount(background, 'chatgpt:test-thread-id');
  189 |     
  190 |     // Should be EXACTLY 1 message, not 3.
  191 |     expect(count).toBe(1);
  192 |   });
  193 | 
  194 |   test('Invariant 8: Multiple tabs do not corrupt conversation state', async ({ context, page }, testInfo) => {
  195 |     const uniqueId = testInfo.title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20);
  196 |     const threadId = `test-thread-${uniqueId}`;
  197 |     // Open two pages pointing to same thread
  198 |     await page.goto(`https://chatgpt.com/c/${threadId}`);
  199 |     const page2 = await context.newPage();
  200 |     await page2.goto(`https://chatgpt.com/c/${threadId}`);
  201 |     
  202 |     // Inject rapidly across both pages
  203 |     await Promise.all([
  204 |       injectMessage(page, 'msg-a', 'user', 'From tab 1'),
  205 |       injectMessage(page2, 'msg-b', 'assistant', 'From tab 2'),
  206 |     ]);
  207 |     
  208 |     await page.waitForTimeout(1000);
  209 |     
  210 |     const [background] = context.serviceWorkers();
  211 |     const count = await getIDBConversationCount(background, 'chatgpt:test-thread-id');
  212 |     
  213 |     // Both should merge perfectly due to Web Locks
  214 |     expect(count).toBe(2);
  215 |   });
  216 | 
  217 |   test('Invariant 9: Service Worker suspension does not lose history', async ({ context, page }, testInfo) => {
  218 |     const uniqueId = testInfo.title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20);
  219 |     const threadId = `test-thread-${uniqueId}`;
  220 |     await page.goto(`https://chatgpt.com/c/${threadId}`);
  221 |     
  222 |     await injectMessage(page, 'msg-1', 'user', 'First message');
  223 |     await page.waitForTimeout(1000);
  224 |     
  225 |     let [background] = context.serviceWorkers();
  226 |     let count = await getIDBConversationCount(background, `chatgpt:${threadId}`);
  227 |     expect(count).toBe(1);
  228 |     
  229 |     // Stop the worker directly using CDP
  230 |     const session = await context.newCDPSession(page);
  231 |     await session.send('ServiceWorker.stopAllWorkers');
  232 |     await page.waitForTimeout(500); // Give it time to terminate
  233 |     
  234 |     // Trigger a new mutation which will wake up the SW
  235 |     await injectMessage(page, 'msg-2', 'assistant', 'Second message');
  236 |     await page.waitForTimeout(2000); // Wait for wake up and sync
  237 |     
  238 |     // SW restarts, meaning `sessionMessages` would be wiped if we still used it.
  239 |     // Since we use IDB, the count should be 2.
  240 |     // Wait for the new background worker reference
  241 |     [background] = context.serviceWorkers();
  242 |     if (!background) {
  243 |       background = await context.waitForEvent('serviceworker');
  244 |     }
  245 |     
  246 |     count = await getIDBConversationCount(background, `chatgpt:${threadId}`);
  247 |     expect(count).toBe(2);
  248 |   });
  249 | 
  250 |   test('Invariant 10: ConversationManager is the only component capable of mutating IndexedDB', async ({ page }, testInfo) => {
  251 |     const uniqueId = testInfo.title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20);
  252 |     const threadId = `test-thread-${uniqueId}`;
  253 |     await page.goto(`https://chatgpt.com/c/${threadId}`);
  254 |     
  255 |     // Try to open IndexedDB directly from the content script page context
  256 |     // This will either fail due to cross-origin isolation or prove isolation
  257 |     const success = await page.evaluate(async () => {
  258 |       return new Promise((resolve) => {
```
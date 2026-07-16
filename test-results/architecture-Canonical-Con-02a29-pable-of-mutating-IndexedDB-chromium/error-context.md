# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: architecture.spec.ts >> Canonical Context Architecture Invariants >> Invariant 10: ConversationManager is the only component capable of mutating IndexedDB
- Location: src\__tests__\e2e\architecture.spec.ts:250:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

# Test source

```ts
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
  259 |         const req = indexedDB.open('ai-context-tracker-db', 1);
  260 |         req.onsuccess = () => {
  261 |           resolve(true); // Shouldn't be able to read extension's DB from page!
  262 |         };
  263 |         req.onerror = () => {
  264 |           resolve(false);
  265 |         };
  266 |       });
  267 |     });
  268 |     
  269 |     // Ensure the web page cannot access the extension's database.
> 270 |     expect(success).toBe(false);
      |                     ^ Error: expect(received).toBe(expected) // Object.is equality
  271 |   });
  272 | 
  273 | });
  274 | 
```
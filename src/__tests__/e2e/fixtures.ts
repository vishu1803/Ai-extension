import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// Provide the extension path
const extensionPath = path.join(__dirname, '../../../.output/chrome-mv3');

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const pathToExtension = extensionPath;
    const context = await chromium.launchPersistentContext('', {
      headless: false, // Chrome extensions require headful mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    
    // Wait for extension background to initialize (if not already spawned)
    let [sw] = context.serviceWorkers();
    if (!sw) {
      await context.waitForEvent('serviceworker');
    }
    
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // For manifest v3:
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }

    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});
export const expect = test.expect;
